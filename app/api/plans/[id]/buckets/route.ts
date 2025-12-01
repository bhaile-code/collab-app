// GET /api/plans/:id/buckets - List all buckets for a plan
// POST /api/plans/:id/buckets - Create a new bucket
import { NextRequest } from 'next/server'
import { listBucketsByPlanId, createBucket, getNextDisplayOrder } from '@/lib/db/queries/buckets'
import { createBucketSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'

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

    // Create bucket
    const bucket = await createBucket({
      plan_id: planId,
      title: validation.data.title,
      description: validation.data.description || null,
      accent_color: validation.data.accentColor || 'gray',
      display_order: displayOrder,
    })

    return successResponse(bucket, 201)
  } catch (error) {
    return handleError(error)
  }
}
