// GET /api/ideas/:id - Get an idea
// PATCH /api/ideas/:id - Update an idea
// DELETE /api/ideas/:id - Delete an idea
import { NextRequest } from 'next/server'
import { getIdeaById, updateIdea, deleteIdea } from '@/lib/db/queries/ideas'
import { updateIdeaSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const idea = await getIdeaById(id)
    return successResponse(idea)
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate request body
    const validation = updateIdeaSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.errors)
    }

    // Update idea
    const idea = await updateIdea(id, validation.data)

    return successResponse(idea)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    await deleteIdea(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error)
  }
}
