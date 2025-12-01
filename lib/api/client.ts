import { ApiResponse, ApiErrorResponse } from '@/lib/types/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  const data: ApiResponse<T> = await response.json()

  if (!data.success) {
    const error = data as ApiErrorResponse
    throw new ApiError(
      error.error.message,
      error.error.code,
      error.error.details
    )
  }

  return data.data
}
