// GET /api/buckets/:id - Get a bucket
// PATCH /api/buckets/:id - Update a bucket
// DELETE /api/buckets/:id - Delete a bucket
import { NextRequest } from 'next/server'
import { getBucketById, updateBucket, deleteBucket } from '@/lib/db/queries/buckets'
import { updateBucketSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'

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
    const bucket = await updateBucket(id, validation.data)

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
