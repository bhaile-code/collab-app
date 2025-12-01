// Error handling utilities
import { ApiErrorCode } from '../types/api'

export class AppError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(ApiErrorCode.VALIDATION_ERROR, message, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`
    super(ApiErrorCode.NOT_FOUND, message)
    this.name = 'NotFoundError'
  }
}

export class AlreadyExistsError extends AppError {
  constructor(resource: string, details?: any) {
    super(ApiErrorCode.ALREADY_EXISTS, `${resource} already exists`, details)
    this.name = 'AlreadyExistsError'
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(ApiErrorCode.DATABASE_ERROR, message, details)
    this.name = 'DatabaseError'
  }
}
