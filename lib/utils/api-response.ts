// API response formatting utilities
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { ApiErrorCode, ApiSuccessResponse, ApiErrorResponse } from '../types/api'
import { AppError } from './errors'

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  )
}

/**
 * Create an error response
 */
export function errorResponse(
  code: ApiErrorCode,
  message: string,
  details?: any,
  status = 400
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  )
}

/**
 * Handle errors and return appropriate response
 */
export function handleError(error: unknown): NextResponse<ApiErrorResponse> {
  console.error('API Error:', error)

  // Handle AppError instances
  if (error instanceof AppError) {
    const statusMap: Record<ApiErrorCode, number> = {
      [ApiErrorCode.VALIDATION_ERROR]: 400,
      [ApiErrorCode.NOT_FOUND]: 404,
      [ApiErrorCode.ALREADY_EXISTS]: 409,
      [ApiErrorCode.DATABASE_ERROR]: 500,
      [ApiErrorCode.INTERNAL_ERROR]: 500,
      [ApiErrorCode.UNAUTHORIZED]: 401,
    }

    return errorResponse(
      error.code,
      error.message,
      error.details,
      statusMap[error.code]
    )
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return errorResponse(
      ApiErrorCode.VALIDATION_ERROR,
      'Validation failed',
      error.errors,
      400
    )
  }

  // Handle generic errors
  if (error instanceof Error) {
    return errorResponse(
      ApiErrorCode.INTERNAL_ERROR,
      error.message,
      undefined,
      500
    )
  }

  // Unknown error
  return errorResponse(
    ApiErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    undefined,
    500
  )
}
