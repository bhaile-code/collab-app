 // GET /api/buckets/:id - Get a bucket
// PATCH /api/buckets/:id - Update a bucket
// DELETE /api/buckets/:id - Delete a bucket
import { NextRequest } from 'next/server'
import { getBucketById, updateBucket, deleteBucket } from '@/lib/db/queries/buckets'
import { updateBucketSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'
import { generateEmbedding, BUCKET_EMBEDDINGS_CACHE_PREFIX } from '@/lib/services/embeddings'
import { invalidateCache } from '@/lib/utils/cache'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const bucket = await getBucketById(id)
    return successResponse(bucket)
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate request body
    const validation = updateBucketSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.errors)
    }

    // Update bucket
    let bucket = await updateBucket(id, validation.data as any)

    // If title or description changed, regenerate embedding and invalidate cache
    if (validation.data.title !== undefined || validation.data.description !== undefined) {
      try {
        const text = `${bucket.title}${bucket.description ? '\n' + bucket.description : ''}`.trim()
        if (text) {
          const embedding = await generateEmbedding(text)
          bucket = await updateBucket(id, { embedding } as any)
        }
      } catch (error) {
        console.error('Failed to regenerate embedding for bucket', { bucketId: id }, error)
      }

      try {
        invalidateCache(`${BUCKET_EMBEDDINGS_CACHE_PREFIX}${bucket.plan_id}`)
      } catch (error) {
        console.error('Failed to invalidate bucket embeddings cache after bucket update', {
          bucketId: id,
          planId: bucket.plan_id,
        }, error)
      }
    }

    return successResponse(bucket)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    await deleteBucket(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error)
  }
}
