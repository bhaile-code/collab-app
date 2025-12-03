import Anthropic from '@anthropic-ai/sdk'
import type { Idea, Bucket } from '@/lib/types/database'
import { createBucket, updateBucket } from '@/lib/db/queries/buckets'
import { updateIdea } from '@/lib/db/queries/ideas'
import {
  cosineSimilarity,
  generateEmbedding,
  getBucketEmbeddingsCached,
  BUCKET_EMBEDDINGS_CACHE_PREFIX,
} from '@/lib/services/embeddings'
import { invalidateCache } from '@/lib/utils/cache'

// Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MIN_SIMILARITY = 0.35
const TIE_THRESHOLD = 0.05
const MIN_CONFIDENCE = 35
const MAX_CONFIDENCE = 95
const SIMILARITY_RANGE = 1 - MIN_SIMILARITY
const CONFIDENCE_SPAN = MAX_CONFIDENCE - MIN_CONFIDENCE

const USE_EMBEDDINGS_CLASSIFICATION =
  process.env.USE_EMBEDDINGS_CLASSIFICATION !== 'false'

const LOG_CLASSIFICATION_METRICS =
  process.env.LOG_CLASSIFICATION_METRICS === 'true'

let totalLLMCalls = 0
let totalCostUSD = 0

// Classification metrics (used for Phase 5 testing & observability)
let totalClassificationRequests = 0
let embeddingOnlyClassifications = 0
let tieBreakerClassifications = 0
let newBucketClassifications = 0
let llmFallbackClassifications = 0
let llmOnlyClassifications = 0

function getClassificationStats() {
  return {
    total: totalClassificationRequests,
    embedding_only: embeddingOnlyClassifications,
    tie_breaker: tieBreakerClassifications,
    new_bucket: newBucketClassifications,
    llm_fallback: llmFallbackClassifications,
    llm_only: llmOnlyClassifications,
  }
}

function trackLLMCost(inputTokens: number | null | undefined, outputTokens: number | null | undefined) {
  if (inputTokens == null || outputTokens == null) return

  totalLLMCalls++
  // Claude Haiku pricing: $0.25 per 1M input tokens, $1.25 per 1M output tokens
  const cost = (inputTokens * 0.25) / 1_000_000 + (outputTokens * 1.25) / 1_000_000
  totalCostUSD += cost

  console.log(`LLM call #${totalLLMCalls}: ${inputTokens} in + ${outputTokens} out = $${cost.toFixed(4)}`)
  console.log(`Total LLM cost: $${totalCostUSD.toFixed(2)}`)
}

function similarityToConfidence(similarity: number): number {
  if (similarity <= MIN_SIMILARITY) {
    return MIN_CONFIDENCE
  }

  const raw =
    MIN_CONFIDENCE +
    ((similarity - MIN_SIMILARITY) * CONFIDENCE_SPAN) / SIMILARITY_RANGE

  return Math.max(
    MIN_CONFIDENCE,
    Math.min(MAX_CONFIDENCE, Math.round(raw)),
  )
}

function extractJsonArray(text: string): any[] {
  // 1. Try direct parse
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // ignore
  }

  // 2. Try to extract first top-level JSON array substring
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = text.slice(start, end + 1)
    const parsed = JSON.parse(candidate)
    if (Array.isArray(parsed)) return parsed
  }

  throw new Error('Malformed JSON from LLM')
}

function extractJsonObject(text: string): any {
  // 1. Try direct parse
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch {
    // ignore
  }

  // 2. Try to extract first top-level JSON object substring
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = text.slice(start, end + 1)
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  }

  throw new Error('Malformed JSON from LLM')
}

export interface BucketPattern {
  bucketId: string
  bucketTitle: string
  keywords: string[]
}

/**
 * Analyzes 2+ ideas and creates appropriate buckets via LLM
 * Called when: First 2 ideas added to a plan with no buckets
 */
export async function createEmergentBuckets(
  planId: string,
  ideas: Idea[],
  planContext?: string,
): Promise<Bucket[]> {
  const prompt = `You are analyzing ideas for a collaborative planning board.

${planContext ? `PLAN CONTEXT: ${planContext}\n\n` : ''}IDEAS:
${ideas
  .map((idea, i) => `${i + 1}. ${idea.title}\n   ${idea.description ?? ''}`)
  .join('\n\n')}

Based on the plan context and ideas, create between 1 and 3 semantic categories (buckets) that best organize these ideas.

Return ONLY a JSON array of bucket objects with this exact shape (no comments, no extra fields, no text before or after the JSON, no markdown or code fences):

[
  {
    "title": "Bucket Name",
    "description": "Brief description",
    "accent_color": "blue",
    "idea_assignments": [1, 2]
  }
]

Guidelines:
- Don't over-organize and keep it simple and intuitive
- Each bucket should have at least one idea assigned
- Use clear, specific names based on the content (e.g., "Venue Options", not "Ideas")
- Choose colors that make semantic sense
- Every idea must be assigned to exactly one bucket`

  try {
    const message = await anthropic.messages.create({
      // Using Claude Haiku for low-cost, fast classification
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Track cost if usage is available on the response
    const anyMessage = message as any
    if (anyMessage?.usage) {
      trackLLMCost(anyMessage.usage.input_tokens, anyMessage.usage.output_tokens)
    }

    const content = message.content[0]
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from LLM')
    }

    // Debug: log raw LLM response for emergent buckets
    console.log('LLM raw emergent bucket response for plan', planId, ':', content.text)

    let bucketSpecs: Array<{
      title: string
      description: string
      accent_color: string
      idea_assignments: number[]
    }>

    try {
      bucketSpecs = extractJsonArray(content.text)
    } catch (err) {
      console.error('Failed to parse LLM bucket JSON:', err, 'raw text:', content.text)
      throw new Error('Malformed JSON from LLM')
    }

    if (!Array.isArray(bucketSpecs) || bucketSpecs.length === 0) {
      throw new Error('LLM returned empty bucket list')
    }

    const createdBuckets: Bucket[] = []
    let updatedEmbeddings = false

    for (let i = 0; i < bucketSpecs.length; i++) {
      const spec = bucketSpecs[i]
      if (!spec?.title) continue

      const bucket = await createBucket({
        plan_id: planId,
        title: spec.title,
        description: spec.description ?? null,
        accent_color: (spec.accent_color || 'gray') as Bucket['accent_color'],
        display_order: i,
      })
      createdBuckets.push(bucket)

      // Best-effort embedding generation for emergent buckets
      try {
        const text = `${bucket.title}${bucket.description ? '\n' + bucket.description : ''}`.trim()
        if (text) {
          const embedding = await generateEmbedding(text)
          await updateBucket(bucket.id, { embedding } as any)
          updatedEmbeddings = true
        }
      } catch (error) {
        console.error('Failed to generate embedding for emergent bucket', {
          planId,
          bucketId: bucket.id,
          title: bucket.title,
        }, error)
      }

      // Assign ideas to this bucket
      for (const ideaIndex of spec.idea_assignments || []) {
        const idea = ideas[ideaIndex - 1]
        if (idea) {
          await updateIdea(idea.id, {
            bucket_id: bucket.id,
            confidence: 90, // High confidence for LLM assignments
          })
        }
      }
    }

    if (updatedEmbeddings) {
      try {
        invalidateCache(`${BUCKET_EMBEDDINGS_CACHE_PREFIX}${planId}`)
      } catch (error) {
        console.error('Failed to invalidate bucket embeddings cache after emergent bucket creation', {
          planId,
        }, error)
      }
    }

    if (createdBuckets.length === 0) {
      throw new Error('No buckets were created from LLM specs')
    }

    return createdBuckets
  } catch (error) {
    console.error('LLM classification failed, falling back to General bucket:', error)

    // Fallback: Create "General" bucket and assign all ideas
    const fallbackBucket = await createBucket({
      plan_id: planId,
      title: 'General',
      description: 'Uncategorized ideas',
      accent_color: 'gray',
      display_order: 0,
    })

    for (const idea of ideas) {
      await updateIdea(idea.id, {
        bucket_id: fallbackBucket.id,
        confidence: 50, // Lower confidence for fallback
      })
    }

    return [fallbackBucket]
  }
}

async function classifyWithLLM(
  idea: Idea,
  existingBuckets: Bucket[],
  planContext?: string,
): Promise<{ bucketId: string; confidence: number; isNewBucket: boolean }> {
  const prompt = `You are analyzing a new idea for a planning board.

${planContext ? `PLAN CONTEXT: ${planContext}\n\n` : ''}NEW IDEA:
Title: ${idea.title}
Description: ${idea.description ?? '(no description)'}

EXISTING CATEGORIES:
${existingBuckets
  .map(
    (b, i) =>
      `${i + 1}. ${b.title}${
        b.description ? ' - ' + b.description : ''
      }`,
  )
  .join('\n')}

TASK: Decide if this idea fits well into an existing category OR if it needs a new category.

DECISION CRITERIA:
- ASSIGN to existing category if:
  • Strong semantic overlap with category purpose (>70% match)
  • Idea clearly reinforces or extends the category theme
  • Does not dilute the category's focus

- CREATE new category if:
  • No existing category is a good semantic match (<70% confidence)
  • Idea represents a fundamentally different topic/theme
  • Assigning to existing category would confuse its purpose

Return ONLY a JSON object (no markdown, no code fences, no extra text):

{
  "action": "assign_existing" or "create_new",
  "reasoning": "Brief 1-2 sentence explanation of your decision",
  "confidence": 0-100,
  "existing_bucket_number": 2 (if action is "assign_existing", otherwise null),
  "new_bucket": {
    "title": "Category Name",
    "description": "Brief description",
    "accent_color": "blue"
  } (if action is "create_new", otherwise null)
}

IMPORTANT:
- confidence should reflect actual semantic similarity (vary between 40-95)
- Only use "assign_existing" if confidence is genuinely >70%
- Be willing to create new categories for better organization`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const anyMessage = message as any
    if (anyMessage?.usage) {
      trackLLMCost(anyMessage.usage.input_tokens, anyMessage.usage.output_tokens)
    }

    const content = message.content[0]
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from LLM')
    }

    // Debug: log raw LLM response for single-idea bucketing
    console.log(
      'LLM raw bucket classification response for idea',
      idea.id,
      ':',
      content.text,
    )

    let result: {
      action: 'assign_existing' | 'create_new'
      reasoning: string
      existing_bucket_number?: number
      new_bucket?: {
        title: string
        description: string
        accent_color: string
      }
      confidence: number
    }

    try {
      result = extractJsonObject(content.text)
    } catch (err) {
      console.error(
        'Failed to parse LLM classification JSON:',
        err,
        'raw text:',
        content.text,
      )
      throw new Error('Malformed JSON from LLM')
    }

    // Validation: Ensure reasoning field exists
    if (!result.reasoning || result.reasoning.length < 10) {
      console.warn('LLM returned insufficient reasoning:', result.reasoning)
    }

    // Validation: Check for suspicious low-confidence assignments
    if (result.action === 'assign_existing' && result.confidence < 70) {
      console.warn('Low confidence assignment detected:', {
        confidence: result.confidence,
        reasoning: result.reasoning,
        ideaTitle: idea.title,
      })
    }

    // Enhanced logging for debugging
    console.log('LLM classification decision:', {
      ideaTitle: idea.title,
      action: result.action,
      confidence: result.confidence,
      reasoning: result.reasoning,
      targetBucket:
        result.action === 'assign_existing'
          ? existingBuckets[result.existing_bucket_number! - 1]?.title
          : result.new_bucket?.title,
    })

    if (result.action === 'assign_existing' && typeof result.existing_bucket_number === 'number') {
      const index = result.existing_bucket_number - 1
      const bucket = existingBuckets[index] ?? existingBuckets[0]

      return {
        bucketId: bucket.id,
        confidence: result.confidence ?? 70,
        isNewBucket: false,
      }
    }

    if (result.action === 'create_new' && result.new_bucket) {
      const spec = result.new_bucket
      let newBucket = await createBucket({
        plan_id: idea.plan_id,
        title: spec.title,
        description: spec.description ?? null,
        accent_color: (spec.accent_color || 'gray') as Bucket['accent_color'],
        display_order: existingBuckets.length,
      })

      // Best-effort embedding generation for LLM-created bucket
      try {
        const text = `${newBucket.title}${newBucket.description ? '\n' + newBucket.description : ''}`.trim()
        if (text) {
          const embedding = await generateEmbedding(text)
          newBucket = await updateBucket(newBucket.id, { embedding } as any)
        }
      } catch (error) {
        console.error('Failed to generate embedding for LLM-created bucket', {
          planId: idea.plan_id,
          bucketId: newBucket.id,
          title: newBucket.title,
        }, error)
      }

      try {
        invalidateCache(`${BUCKET_EMBEDDINGS_CACHE_PREFIX}${idea.plan_id}`)
      } catch (error) {
        console.error('Failed to invalidate bucket embeddings cache after LLM-created bucket', {
          planId: idea.plan_id,
          bucketId: newBucket.id,
        }, error)
      }

      return {
        bucketId: newBucket.id,
        confidence: result.confidence ?? 75,
        isNewBucket: true,
      }
    }

    // If response is unusable, fall back to first bucket
    return {
      bucketId: existingBuckets[0].id,
      confidence: 40,
      isNewBucket: false,
    }
  } catch (error) {
    console.error('Classification failed:', error)

    // Try pattern matching as first fallback
    const patterns = await extractBucketPatterns(existingBuckets)
    const patternMatch = await attemptPatternMatch(idea, patterns)

    if (patternMatch) {
      console.log('Using pattern match fallback for idea:', idea.title, patternMatch)
      return {
        bucketId: patternMatch.bucketId,
        confidence: patternMatch.confidence,
        isNewBucket: false,
      }
    }

    // Ultimate fallback: first bucket with low confidence
    console.log('Using first bucket as final fallback for idea:', idea.title)
    return {
      bucketId: existingBuckets[0].id,
      confidence: 40,
      isNewBucket: false,
    }
  }
}

async function classifyWithLLMTieBreaker(
  idea: Idea,
  tiedBuckets: { bucket: Bucket; similarity: number }[],
  planContext?: string,
): Promise<{ bucketId: string }> {
  if (tiedBuckets.length === 1) {
    return { bucketId: tiedBuckets[0].bucket.id }
  }

  const prompt = `You are resolving a tie between multiple existing categories for a new idea on a planning board.

${planContext ? `PLAN CONTEXT: ${planContext}\n\n` : ''}NEW IDEA:
Title: ${idea.title}
Description: ${idea.description ?? '(no description)'}

TIED CATEGORIES:
${tiedBuckets
  .map(
    (entry, i) =>
      `${i + 1}. ${entry.bucket.title}${
        entry.bucket.description ? ' - ' + entry.bucket.description : ''
      } (similarity: ${entry.similarity.toFixed(3)})`,
  )
  .join('\n')}

TASK: Choose the single best existing category for this idea. Do NOT create new categories.

Return ONLY a JSON object (no markdown, no code fences, no extra text):

{
  "chosen_bucket_number": 1,
  "reasoning": "Brief 1-2 sentence explanation"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const anyMessage = message as any
    if (anyMessage?.usage) {
      trackLLMCost(anyMessage.usage.input_tokens, anyMessage.usage.output_tokens)
    }

    const content = message.content[0]
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from LLM tie-breaker')
    }

    console.log(
      'LLM raw tie-breaker response for idea',
      idea.id,
      ':',
      content.text,
    )

    const result = extractJsonObject(content.text) as {
      chosen_bucket_number?: number
      reasoning?: string
    }

    const index =
      typeof result.chosen_bucket_number === 'number'
        ? result.chosen_bucket_number - 1
        : 0

    const chosen = tiedBuckets[index] ?? tiedBuckets[0]

    console.log('LLM tie-breaker decision:', {
      ideaTitle: idea.title,
      chosenBucket: chosen.bucket.title,
      reasoning: result.reasoning,
    })

    return { bucketId: chosen.bucket.id }
  } catch (error) {
    console.error('Tie-breaker LLM failed, falling back to top-similarity bucket:', error)
    return { bucketId: tiedBuckets[0].bucket.id }
  }
}

async function createNewBucketForIdea(
  idea: Idea,
  existingBuckets: Bucket[],
  planContext?: string,
): Promise<{ bucketId: string; confidence: number }> {
  const prompt = `You are helping organize ideas for a collaborative planning board.

${planContext ? `PLAN CONTEXT: ${planContext}\n\n` : ''}NEW IDEA:
Title: ${idea.title}
Description: ${idea.description ?? '(no description)'}

EXISTING CATEGORIES (none are a good semantic match, we need a new one):
${existingBuckets
  .map(
    (b, i) =>
      `${i + 1}. ${b.title}${
        b.description ? ' - ' + b.description : ''
      }`,
  )
  .join('\n')}

TASK: Propose a single new category (bucket) that would best organize this idea, distinct from the existing ones.

Return ONLY a JSON object (no markdown, no code fences, no extra text):

{
  "title": "Category Name",
  "description": "Brief description",
  "accent_color": "blue"
}

Guidelines:
- The new category should be semantically coherent and not redundant with existing ones.
- Prefer clear, specific names based on the idea content.
- Choose an accent color that makes semantic sense.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const anyMessage = message as any
    if (anyMessage?.usage) {
      trackLLMCost(anyMessage.usage.input_tokens, anyMessage.usage.output_tokens)
    }

    const content = message.content[0]
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response type from LLM when creating new bucket')
    }

    console.log(
      'LLM raw new-bucket response for idea',
      idea.id,
      ':',
      content.text,
    )

    const spec = extractJsonObject(content.text) as {
      title?: string
      description?: string
      accent_color?: string
    }

    if (!spec.title) {
      throw new Error('LLM did not return a title for the new bucket')
    }

    let newBucket = await createBucket({
      plan_id: idea.plan_id,
      title: spec.title,
      description: spec.description ?? null,
      accent_color: (spec.accent_color || 'gray') as Bucket['accent_color'],
      display_order: existingBuckets.length,
    })

    // Best-effort embedding generation for new bucket
    try {
      const text = `${newBucket.title}${newBucket.description ? '\n' + newBucket.description : ''}`.trim()
      if (text) {
        const embedding = await generateEmbedding(text)
        newBucket = await updateBucket(newBucket.id, { embedding } as any)
      }
    } catch (error) {
      console.error('Failed to generate embedding for new bucket', {
        planId: idea.plan_id,
        bucketId: newBucket.id,
        title: newBucket.title,
      }, error)
    }

    try {
      invalidateCache(`${BUCKET_EMBEDDINGS_CACHE_PREFIX}${idea.plan_id}`)
    } catch (error) {
      console.error('Failed to invalidate bucket embeddings cache after new bucket creation', {
        planId: idea.plan_id,
        bucketId: newBucket.id,
      }, error)
    }

    return {
      bucketId: newBucket.id,
      confidence: 75,
    }
  } catch (error) {
    console.error(
      'Failed to create new bucket via LLM, falling back to LLM classification:',
      error,
    )

    const fallback = await classifyWithLLM(idea, existingBuckets, planContext)
    return {
      bucketId: fallback.bucketId,
      confidence: fallback.confidence,
    }
  }
}

/**
 * Classifies a single idea into existing buckets or creates a new one.
 * Embeddings-first flow:
 * 1) Generate idea embedding
 * 2) Compare against cached bucket embeddings
 * 3) Clear winner (>= MIN_SIMILARITY, no ties) → assign immediately
 * 4) Tie (within TIE_THRESHOLD) → LLM tie-breaker
 * 5) All < MIN_SIMILARITY → create new bucket via LLM
 * Falls back to full LLM classification on any embedding failure.
 */
export async function classifyIdeaIntoBucket(
  idea: Idea,
  existingBuckets: Bucket[],
  planContext?: string,
): Promise<{ bucketId: string; confidence: number; isNewBucket: boolean }> {
  totalClassificationRequests++

  if (!USE_EMBEDDINGS_CLASSIFICATION || existingBuckets.length === 0) {
    llmOnlyClassifications++

    if (LOG_CLASSIFICATION_METRICS) {
      console.log(
        '[classification] Using LLM-only classification (embeddings disabled or no buckets)',
        {
          ideaId: idea.id,
          ideaTitle: idea.title,
          stats: getClassificationStats(),
        },
      )
    }
    return classifyWithLLM(idea, existingBuckets, planContext)
  }

  try {
    const bucketEmbeddings = await getBucketEmbeddingsCached(idea.plan_id)

    if (!bucketEmbeddings || bucketEmbeddings.size === 0) {
      console.warn(
        '[classification] No bucket embeddings available; falling back to LLM classification',
      )
      return classifyWithLLM(idea, existingBuckets, planContext)
    }

    const ideaText = `${idea.title}\n${idea.description ?? ''}`
    const ideaEmbedding = await generateEmbedding(ideaText)

    const scored: { bucket: Bucket; similarity: number }[] = []

    for (const bucket of existingBuckets) {
      const bucketEmbedding = bucketEmbeddings.get(bucket.id)
      if (!bucketEmbedding) continue

      try {
        const similarity = cosineSimilarity(ideaEmbedding, bucketEmbedding)
        scored.push({ bucket, similarity })
      } catch (error) {
        console.error(
          '[classification] Failed to compute similarity for bucket',
          { bucketId: bucket.id, title: bucket.title },
          error,
        )
      }
    }

    if (!scored.length) {
      console.warn(
        '[classification] No valid bucket similarities; falling back to LLM classification',
      )
      return classifyWithLLM(idea, existingBuckets, planContext)
    }

    scored.sort((a, b) => b.similarity - a.similarity)

    const best = scored[0]
    const bestSim = best.similarity

    if (LOG_CLASSIFICATION_METRICS) {
      console.log('[classification] Embedding similarities for idea', idea.id, {
        ideaTitle: idea.title,
        bestBucket: best.bucket.title,
        bestSimilarity: bestSim,
        all: scored.slice(0, 5).map((s) => ({
          bucket: s.bucket.title,
          similarity: s.similarity,
        })),
      })
    }

    if (bestSim < MIN_SIMILARITY) {
      newBucketClassifications++

      console.log(
        '[classification] All bucket similarities below threshold; creating new bucket via LLM',
        {
          ideaId: idea.id,
          ideaTitle: idea.title,
          bestSimilarity: bestSim,
          stats: LOG_CLASSIFICATION_METRICS ? getClassificationStats() : undefined,
        },
      )
      const result = await createNewBucketForIdea(
        idea,
        existingBuckets,
        planContext,
      )
      return {
        bucketId: result.bucketId,
        confidence: result.confidence,
        isNewBucket: true,
      }
    }

    const tied = scored.filter(
      (entry) => bestSim - entry.similarity <= TIE_THRESHOLD,
    )

    if (tied.length > 1) {
      tieBreakerClassifications++

      console.log(
        '[classification] Tie detected between buckets; invoking LLM tie-breaker',
        {
          ideaId: idea.id,
          ideaTitle: idea.title,
          bestSimilarity: bestSim,
          tiedBuckets: tied.map((t) => ({
            bucketId: t.bucket.id,
            title: t.bucket.title,
            similarity: t.similarity,
          })),
          stats: LOG_CLASSIFICATION_METRICS ? getClassificationStats() : undefined,
        },
      )

      const tieResult = await classifyWithLLMTieBreaker(
        idea,
        tied,
        planContext,
      )

      const chosen =
        scored.find((s) => s.bucket.id === tieResult.bucketId) ?? best
      const confidence = similarityToConfidence(chosen.similarity)

      return {
        bucketId: chosen.bucket.id,
        confidence,
        isNewBucket: false,
      }
    }

    const confidence = similarityToConfidence(bestSim)

    embeddingOnlyClassifications++

    console.log('[classification] Embeddings clear winner', {
      ideaId: idea.id,
      ideaTitle: idea.title,
      bucketId: best.bucket.id,
      bucketTitle: best.bucket.title,
      similarity: bestSim,
      confidence,
      stats: LOG_CLASSIFICATION_METRICS ? getClassificationStats() : undefined,
    })

    return {
      bucketId: best.bucket.id,
      confidence,
      isNewBucket: false,
    }
  } catch (error) {
    llmFallbackClassifications++

    console.error(
      '[classification] Embeddings-based classification failed; falling back to LLM classification',
      error,
      LOG_CLASSIFICATION_METRICS ? { stats: getClassificationStats() } : undefined,
    )
    return classifyWithLLM(idea, existingBuckets, planContext)
  }
}

/**
 * Extracts keywords from bucket titles/descriptions for pattern matching
 * Used for: Cost optimization after initial LLM calls
 */
export async function extractBucketPatterns(buckets: Bucket[]): Promise<BucketPattern[]> {
  return buckets.map((bucket) => {
    const text = `${bucket.title} ${bucket.description ?? ''}`.toLowerCase()
    const rawWords = text.split(/[^a-z0-9]+/g).filter(Boolean)

    const stopwords = new Set([
      'the',
      'and',
      'or',
      'for',
      'to',
      'of',
      'in',
      'on',
      'at',
      'a',
      'an',
      'ideas',
      'general',
    ])

    const keywords = Array.from(
      new Set(
        rawWords.filter((word) => word.length >= 3 && !stopwords.has(word)),
      ),
    )

    return {
      bucketId: bucket.id,
      bucketTitle: bucket.title,
      keywords,
    }
  })
}

/**
 * Attempts simple rule-based classification before calling LLM
 * Returns: bucketId + confidence or null if low confidence
 * (Future optimization: For Phase 3 this is a lightweight helper, can be expanded later)
 */
export async function attemptPatternMatch(
  idea: Idea,
  patterns: BucketPattern[],
): Promise<{ bucketId: string; confidence: number } | null> {
  const text = `${idea.title} ${idea.description ?? ''}`.toLowerCase()
  const words = new Set(text.split(/[^a-z0-9]+/g).filter(Boolean))

  let bestMatch: { bucketId: string; confidence: number } | null = null

  for (const pattern of patterns) {
    let score = 0
    for (const keyword of pattern.keywords) {
      if (words.has(keyword)) {
        score += 1
      }
    }

    if (score > 0) {
      const confidence = Math.min(50 + score * 10, 90) // simple heuristic
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { bucketId: pattern.bucketId, confidence }
      }
    }
  }

  // Only trust matches above a threshold
  if (bestMatch && bestMatch.confidence >= 70) {
    return bestMatch
  }

  return null
}
