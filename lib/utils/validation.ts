// Zod validation schemas for API requests
import { z } from 'zod'

// ============================================================================
// PLAN SCHEMAS
// ============================================================================

export const createPlanSchema = z.object({
  planContext: z.string().min(10).max(500),
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
})

export const updatePlanSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
})

// ============================================================================
// IDEA SCHEMAS
// ============================================================================

const attachmentSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1),
  type: z.string().min(1),
  size: z.number().int().nonnegative(),
})

export const createIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  bucketId: z.string().uuid().optional(),
  location: z.string().optional(),
  date: z.string().optional(),
  budget: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  attachments: z.array(attachmentSchema).optional(),
})

export const updateIdeaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  location: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  confidence: z.number().min(0).max(100).optional(),
  attachments: z.array(attachmentSchema).optional(),
})

export const moveIdeaSchema = z.object({
  bucketId: z.string().uuid(),
})

// ============================================================================
// BUCKET SCHEMAS
// ============================================================================

const bucketColorSchema = z.enum([
  'blue',
  'green',
  'orange',
  'purple',
  'pink',
  'teal',
  'amber',
  'rose',
  'indigo',
  'emerald',
  'cyan',
  'red',
  'gray',
])

export const createBucketSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  accentColor: bucketColorSchema.optional(),
})

export const updateBucketSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  accentColor: bucketColorSchema.optional(),
  displayOrder: z.number().int().min(0).optional(),
})

// ============================================================================
// SESSION SCHEMAS
// ============================================================================

export const createSessionSchema = z.object({
  planId: z.string().uuid(),
  nickname: z.string().min(1).max(50),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean
  data?: T
  error?: z.ZodError
} {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error }
    }
    throw error
  }
}
