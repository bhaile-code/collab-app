import Anthropic from '@anthropic-ai/sdk'
import type { Idea, Bucket } from '@/lib/types/database'
import { createBucket } from '@/lib/db/queries/buckets'
import { updateIdea } from '@/lib/db/queries/ideas'

// Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

let totalLLMCalls = 0
let totalCostUSD = 0

function trackLLMCost(inputTokens: number | null | undefined, outputTokens: number | null | undefined) {
  if (inputTokens == null || outputTokens == null) return

  totalLLMCalls++
  // Claude Haiku pricing: $0.25 per 1M input tokens, $1.25 per 1M output tokens
  const cost = (inputTokens * 0.25) / 1_000_000 + (outputTokens * 1.25) / 1_000_000
  totalCostUSD += cost

  console.log(`LLM call #${totalLLMCalls}: ${inputTokens} in + ${outputTokens} out = $${cost.toFixed(4)}`)
  console.log(`Total LLM cost: $${totalCostUSD.toFixed(2)}`)
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

/**
 * Classifies a single idea into existing buckets or creates a new one
 * Called when: Adding idea to plan that already has buckets
 */
export async function classifyIdeaIntoBucket(
  idea: Idea,
  existingBuckets: Bucket[],
  planContext?: string,
): Promise<{ bucketId: string; confidence: number; isNewBucket: boolean }> {
  const prompt = `You are analyzing a new idea for a planning board.

${planContext ? `PLAN CONTEXT: ${planContext}\n\n` : ''}NEW IDEA:
Title: ${idea.title}
Description: ${idea.description ?? '(no description)'}

EXISTING CATEGORIES:
${existingBuckets.map((b, i) => `${i + 1}. ${b.title}${b.description ? ' - ' + b.description : ''}`).join('\n')}

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
    console.log('LLM raw bucket classification response for idea', idea.id, ':', content.text)

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
      console.error('Failed to parse LLM classification JSON:', err, 'raw text:', content.text)
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
        ideaTitle: idea.title
      })
    }

    // Enhanced logging for debugging
    console.log('LLM classification decision:', {
      ideaTitle: idea.title,
      action: result.action,
      confidence: result.confidence,
      reasoning: result.reasoning,
      targetBucket: result.action === 'assign_existing'
        ? existingBuckets[result.existing_bucket_number! - 1]?.title
        : result.new_bucket?.title
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
      const newBucket = await createBucket({
        plan_id: idea.plan_id,
        title: spec.title,
        description: spec.description ?? null,
        accent_color: (spec.accent_color || 'gray') as Bucket['accent_color'],
        display_order: existingBuckets.length,
      })

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
