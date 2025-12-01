// POST /api/sessions - Create a new guest session
import { NextRequest } from 'next/server'
import { createGuestSession, getSessionByPlanAndNickname } from '@/lib/db/queries/sessions'
import { createSessionSchema } from '@/lib/utils/validation'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { ValidationError } from '@/lib/utils/errors'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = createSessionSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.errors)
    }

    // Check if session already exists for this plan and nickname
    const existingSession = await getSessionByPlanAndNickname(
      validation.data.planId,
      validation.data.nickname
    )

    if (existingSession) {
      // Return existing session instead of creating a new one
      return successResponse(existingSession)
    }

    // Create new session
    const session = await createGuestSession({
      plan_id: validation.data.planId,
      nickname: validation.data.nickname,
    })

    return successResponse(session, 201)
  } catch (error) {
    return handleError(error)
  }
}
