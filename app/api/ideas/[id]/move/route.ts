// PATCH /api/ideas/:id/move - Move an idea to a different bucket
import { NextRequest } from 'next/server'
import { moveIdeaToBucket } from '@/lib/db/queries/ideas'
import { moveIdeaSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate request body
    const validation = moveIdeaSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.errors)
    }

    // Move idea to new bucket
    const idea = await moveIdeaToBucket(id, validation.data.bucketId)

    return successResponse(idea)
  } catch (error) {
    return handleError(error)
  }
}
