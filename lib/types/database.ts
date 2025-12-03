// Database types for Supabase
// These will be auto-generated later via Supabase CLI
// For now, we'll define them manually based on our schema

export interface Plan {
  id: string
  title: string
  description: string | null // DEPRECATED: Not currently used
  plan_context: string | null // The user's description (used for title generation and classification)
  created_at: string
  updated_at: string
}

export interface GuestSession {
  id: string
  plan_id: string
  nickname: string
  created_at: string
  last_active: string
}

export interface Bucket {
  id: string
  plan_id: string
  title: string
  description: string | null
  accent_color: BucketColor
  display_order: number
  embedding?: number[]
  created_at: string
}

export interface Idea {
  id: string
  plan_id: string
  bucket_id: string | null
  title: string
  description: string
  location: string | null
  date: string | null
  budget: string | null
  confidence: number
  created_by: string | null
  created_at: string
  updated_at: string
  latitude: number | null
  longitude: number | null
  geocoded_place_name: string | null
  link_preview_json: LinkPreview | null
  embedding?: number[]
  attachments?: {
    url: string
    filename: string
    type: string
    size: number
  }[]
}

export type BucketColor =
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'pink'
  | 'teal'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'emerald'
  | 'cyan'
  | 'red'
  | 'gray'

// Database insert types (without auto-generated fields)
export type PlanInsert = Omit<Plan, 'id' | 'created_at' | 'updated_at'>
export type BucketInsert = Omit<Bucket, 'id' | 'created_at'>
export type IdeaInsert = Omit<Idea, 'id' | 'created_at' | 'updated_at'>
export type GuestSessionInsert = Omit<GuestSession, 'id' | 'created_at' | 'last_active'>

// Database update types (all fields optional)
export type PlanUpdate = Partial<Omit<Plan, 'id' | 'created_at' | 'updated_at'>>
export type BucketUpdate = Partial<Omit<Bucket, 'id' | 'plan_id' | 'created_at'>>
export type IdeaUpdate = Partial<Omit<Idea, 'id' | 'plan_id' | 'created_at' | 'updated_at'>>

export interface LinkPreview {
  title: string
  description: string
  image: string | null
}
