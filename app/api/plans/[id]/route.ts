// GET /api/plans/:id - Get a plan
// PATCH /api/plans/:id - Update a plan
// DELETE /api/plans/:id - Delete a plan
import { NextRequest } from 'next/server'
import { getPlanById, updatePlan, deletePlan } from '@/lib/db/queries/plans'
import { updatePlanSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const plan = await getPlanById(id)
    return successResponse(plan)
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate request body
    const validation = updatePlanSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.errors)
    }

    // Update plan
    const plan = await updatePlan(id, validation.data)

    return successResponse(plan)
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    await deletePlan(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error)
  }
}
