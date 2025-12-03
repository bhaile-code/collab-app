// API request and response types

import { Plan, Bucket, Idea, GuestSession, BucketColor } from './database'

// ============================================================================
// STANDARD API RESPONSE FORMAT
// ============================================================================

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// ============================================================================
// PLAN ENDPOINTS
// ============================================================================

export interface CreatePlanRequest {
  description: string // User's description of the plan (10-500 chars)
  title?: string // Optional: override auto-generated title
}

export type CreatePlanResponse = ApiResponse<Plan>
export type GetPlanResponse = ApiResponse<Plan>
export type UpdatePlanResponse = ApiResponse<Plan>
export type DeletePlanResponse = ApiResponse<{ deleted: boolean }>

export interface UpdatePlanRequest {
  title?: string
  description?: string
}

// ============================================================================
// IDEA ENDPOINTS
// ============================================================================

export interface CreateIdeaRequest {
  title: string
  description: string
  bucketId?: string
  location?: string
  date?: string
  budget?: string
  confidence?: number
}

export interface UpdateIdeaRequest {
  title?: string
  description?: string
  location?: string
  date?: string
  budget?: string
  confidence?: number
  attachments?: {
    url: string
    filename: string
    type: string
    size: number
  }[]
}

export interface MoveIdeaRequest {
  bucketId: string
}

export type ListIdeasResponse = ApiResponse<Idea[]>
export type CreateIdeaResponse = ApiResponse<Idea>
export type GetIdeaResponse = ApiResponse<Idea>
export type UpdateIdeaResponse = ApiResponse<Idea>
export type DeleteIdeaResponse = ApiResponse<{ deleted: boolean }>
export type MoveIdeaResponse = ApiResponse<Idea>

// ============================================================================
// BUCKET ENDPOINTS
// ============================================================================

export interface CreateBucketRequest {
  title: string
  description?: string
  accentColor?: BucketColor
}

export interface UpdateBucketRequest {
  title?: string
  description?: string
  accentColor?: BucketColor
  displayOrder?: number
}

export type ListBucketsResponse = ApiResponse<Bucket[]>
export type CreateBucketResponse = ApiResponse<Bucket>
export type GetBucketResponse = ApiResponse<Bucket>
export type UpdateBucketResponse = ApiResponse<Bucket>
export type DeleteBucketResponse = ApiResponse<{ deleted: boolean }>

// ============================================================================
// SESSION ENDPOINTS
// ============================================================================

export interface CreateSessionRequest {
  planId: string
  nickname: string
}

export type CreateSessionResponse = ApiResponse<GuestSession>
export type GetSessionResponse = ApiResponse<GuestSession>

// ============================================================================
// ERROR CODES
// ============================================================================

export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
}
