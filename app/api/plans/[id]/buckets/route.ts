 // GET /api/plans/:id/buckets - List all buckets for a plan
// POST /api/plans/:id/buckets - Create a new bucket
import { NextRequest } from 'next/server'
import { listBucketsByPlanId, createBucket, getNextDisplayOrder } from '@/lib/db/queries/buckets'
import { createBucketSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'
import { generateEmbedding, BUCKET_EMBEDDINGS_CACHE_PREFIX } from '@/lib/services/embeddings'
import { invalidateCache } from '@/lib/utils/cache'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: planId } = await params
    const buckets = await listBucketsByPlanId(planId)
    return successResponse(buckets)
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: planId } = await params
    const body = await request.json()

    // Validate request body
    const validation = createBucketSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.errors)
    }

    // Get next display order
    const displayOrder = await getNextDisplayOrder(planId)

    const title = validation.data.title
    const description = validation.data.description || null
    const accentColor = validation.data.accentColor || 'gray'

    // Best-effort embedding generation for the new bucket
    let embedding: number[] | undefined
    try {
      const text = `${title}${description ? '\n' + description : ''}`.trim()
      if (text) {
        embedding = await generateEmbedding(text)
      }
    } catch (error) {
      console.error('Failed to generate embedding for new bucket', { planId, title }, error)
    }

    // Create bucket (including embedding when available)
    const bucket = await createBucket({
      plan_id: planId,
      title,
      description,
      accent_color: accentColor,
      display_order: displayOrder,
      ...(embedding ? { embedding } : {}),
    })

    // Invalidate bucket embeddings cache for this plan so new bucket is included
    try {
      invalidateCache(`${BUCKET_EMBEDDINGS_CACHE_PREFIX}${planId}`)
    } catch (error) {
      console.error('Failed to invalidate bucket embeddings cache after bucket create', { planId }, error)
    }

    return successResponse(bucket, 201)
  } catch (error) {
    return handleError(error)
  }
}
