import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { Bucket } from '@/lib/types/database'
import { listBucketsByPlanId, updateBucket } from '@/lib/db/queries/buckets'
import { getCached, setCache } from '@/lib/utils/cache'
import { validateVectorDimension } from '@/lib/db/pgvector'

const EMBEDDING_MODEL_NAME = 'text-embedding-3-small'

// 5-minute TTL for bucket embeddings
const BUCKET_CACHE_TTL_MS = 5 * 60 * 1000

// ---- Cost tracking ---------------------------------------------------------

let totalEmbeddingCalls = 0
let totalEmbeddingTokens = 0
let totalEmbeddingCostUSD = 0

// text-embedding-3-small pricing: $0.02 per 1M tokens (input only)
// https://openai.com/pricing (at time of implementation)
const EMBEDDING_PRICE_PER_1M_TOKENS_USD = 0.02

function trackEmbeddingCost(usage: any) {
  if (!usage) return

  const tokens: number | undefined =
    usage.totalTokens ??
    usage.inputTokens ??
    usage.promptTokens ??
    usage.tokens

  if (!tokens || typeof tokens !== 'number') {
    return
  }

  totalEmbeddingCalls += 1
  totalEmbeddingTokens += tokens

  const cost = (tokens * EMBEDDING_PRICE_PER_1M_TOKENS_USD) / 1_000_000
  totalEmbeddingCostUSD += cost

  console.log(
    `[embeddings] call #${totalEmbeddingCalls}: ${tokens} tokens ≈ $${cost.toFixed(
      6,
    )} (model=${EMBEDDING_MODEL_NAME}). Total ≈ $${totalEmbeddingCostUSD.toFixed(
      4,
    )}`,
  )
}

export function getEmbeddingStats() {
  return {
    totalEmbeddingCalls,
    totalEmbeddingTokens,
    totalEmbeddingCostUSD,
  }
}

// ---- Core embedding generation ---------------------------------------------

/**
 * Generate a normalized embedding vector for the given text using OpenAI.
 * - Uses text-embedding-3-small via Vercel AI SDK.
 * - Throws if OPENAI_API_KEY is not configured.
 * - Normalizes the vector to unit length for safe cosine similarity usage.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cleaned = text?.trim()
  if (!cleaned) {
    throw new Error('Cannot generate embedding for empty text')
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      'OPENAI_API_KEY is not set. Embedding generation is disabled and will throw.',
    )
    throw new Error('OPENAI_API_KEY is not configured')
  }

  try {
    const result = await embed({
      model: openai.embedding(EMBEDDING_MODEL_NAME),
      value: cleaned,
    })

    const anyResult = result as any
    trackEmbeddingCost(anyResult?.usage)

    const raw = (result as any).embedding as number[] | Float32Array

    if (!raw || typeof raw.length !== 'number') {
      throw new Error('Embedding provider returned invalid vector')
    }

    const arr = Array.from(raw, (v) => (typeof v === 'number' ? v : Number(v)))
    return normalizeVector(arr)
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    throw error instanceof Error
      ? error
      : new Error('Unknown error while generating embedding')
  }
}

// ---- Numeric helpers -------------------------------------------------------

/**
 * Compute cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]. For normalized embeddings it will typically be [0, 1].
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  // Defensive: Validate vector dimensions (expected: 1536 for text-embedding-3-small)
  const EXPECTED_DIM = 1536

  if (!Array.isArray(a) || !Array.isArray(b)) {
    console.error('[embeddings] cosineSimilarity received non-array input', {
      aType: typeof a,
      bType: typeof b,
      aIsArray: Array.isArray(a),
      bIsArray: Array.isArray(b)
    })
    throw new Error('cosineSimilarity requires array inputs')
  }

  if (a.length !== EXPECTED_DIM || b.length !== EXPECTED_DIM) {
    console.error('[embeddings] Malformed vector detected in cosineSimilarity', {
      aLength: a.length,
      bLength: b.length,
      expected: EXPECTED_DIM,
      aSample: a.slice(0, 5),
      bSample: b.slice(0, 5),
    })
    throw new Error(
      `Cannot compute cosine similarity for vectors of unexpected length: ${a.length} vs ${b.length} (expected ${EXPECTED_DIM})`,
    )
  }

  if (a.length !== b.length) {
    throw new Error(
      `Cannot compute cosine similarity for vectors of different length: ${a.length} vs ${b.length}`,
    )
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const va = a[i] ?? 0
    const vb = b[i] ?? 0
    dot += va * vb
    normA += va * va
    normB += vb * vb
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Normalize a vector to unit length. If the vector has zero norm,
 * returns a zero vector of the same length.
 */
export function normalizeVector(v: number[]): number[] {
  let norm = 0
  for (let i = 0; i < v.length; i++) {
    const val = v[i] ?? 0
    norm += val * val
  }

  if (norm === 0) {
    return v.map(() => 0)
  }

  const scale = 1 / Math.sqrt(norm)
  return v.map((val) => (val ?? 0) * scale)
}

// ---- Bucket embeddings w/ in-memory cache ---------------------------------

export const BUCKET_EMBEDDINGS_CACHE_PREFIX = 'bucket-embeddings:'

export type BucketEmbeddingMap = Map<string, number[]>

/**
 * Build the text representation used for bucket embeddings.
 * For now: title + description.
 */
function buildBucketEmbeddingText(bucket: Bucket): string {
  const parts = [bucket.title]
  if (bucket.description) {
    parts.push(bucket.description)
  }
  return parts.join('\n').trim()
}

/**
 * Returns a map of bucketId -> embedding for all buckets in a plan.
 * Results are cached in-memory for 5 minutes to avoid recomputing.
 *
 * This does NOT yet persist embeddings to the database; it is purely
 * an application-level cache built from bucket title/description.
 */
export async function getBucketEmbeddingsCached(
  planId: string,
): Promise<BucketEmbeddingMap> {
  const cacheKey = `${BUCKET_EMBEDDINGS_CACHE_PREFIX}${planId}`
  const cached = getCached<BucketEmbeddingMap>(cacheKey)
  if (cached) {
    return cached
  }

  const buckets = await listBucketsByPlanId(planId)
  const map: BucketEmbeddingMap = new Map()

  for (const bucket of buckets) {
    // Parse embedding from bucket (already parsed by listBucketsByPlanId)
    let embedding = bucket.embedding

    // Validate dimension if embedding exists
    if (embedding && !validateVectorDimension(embedding, 1536)) {
      console.error(
        '[embeddings] Invalid embedding dimension for bucket',
        { bucketId: bucket.id, title: bucket.title, dimension: embedding.length }
      )
      embedding = undefined
    }

    // If the bucket has no stored embedding yet, generate and persist it
    if (!embedding || !embedding.length) {
      const text = buildBucketEmbeddingText(bucket)
      if (!text) {
        continue
      }

      try {
        embedding = await generateEmbedding(text)

        try {
          await updateBucket(bucket.id, { embedding })
        } catch (persistError) {
          console.error(
            '[embeddings] Failed to persist bucket embedding to database',
            { bucketId: bucket.id, title: bucket.title },
            persistError,
          )
        }
      } catch (error) {
        console.error(
          'Failed to generate embedding for bucket',
          { bucketId: bucket.id, title: bucket.title },
          error,
        )
        // Continue with other buckets; classification layer can fall back if needed.
        continue
      }
    }

    if (embedding && embedding.length === 1536) {
      map.set(bucket.id, embedding)
    }
  }

  setCache(cacheKey, map, BUCKET_CACHE_TTL_MS)
  return map
}
