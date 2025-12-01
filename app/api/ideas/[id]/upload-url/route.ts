import { NextRequest } from 'next/server'
import { successResponse, handleError } from '@/lib/utils/api-response'
import { rateLimit } from '@/lib/utils/rate-limit'
import { generateSignedUploadUrl } from '@/lib/utils/file-upload-server'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: ideaId } = await params
    const { filename, contentType, size } = await request.json()

    // Rate limit uploads: 10 per minute per IP
    if (!rateLimit(request, 10, 60_000)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many uploads. Please try again later.',
          },
        }),
        { status: 429 },
      )
    }

    if (!filename || !contentType || typeof size !== 'number') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing or invalid file metadata',
          },
        }),
        { status: 400 },
      )
    }

    const uploadData = await generateSignedUploadUrl(
      ideaId,
      filename,
      contentType,
      size,
    )

    return successResponse(uploadData)
  } catch (error) {
    return handleError(error)
  }
}
