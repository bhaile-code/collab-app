// Idea CRUD operations
import { supabase } from '../client'
import { Idea, IdeaInsert, IdeaUpdate } from '../../types/database'
import { NotFoundError, DatabaseError } from '../../utils/errors'

/**
 * Create a new idea
 */
export async function createIdea(data: IdeaInsert): Promise<Idea> {
  const { data: idea, error } = await supabase
    .from('ideas')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new DatabaseError('Failed to create idea', error)
  }

  if (!idea) {
    throw new DatabaseError('Idea creation returned no data')
  }

  return idea
}

/**
 * Get an idea by ID
 */
export async function getIdeaById(id: string): Promise<Idea> {
  const { data: idea, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Idea', id)
    }
    throw new DatabaseError('Failed to fetch idea', error)
  }

  if (!idea) {
    throw new NotFoundError('Idea', id)
  }

  return idea
}

/**
 * List all ideas for a plan
 */
export async function listIdeasByPlanId(planId: string): Promise<Idea[]> {
  const { data: ideas, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new DatabaseError('Failed to list ideas', error)
  }

  return ideas || []
}

/**
 * List ideas with bucket data in a single query (optimized)
 * Eliminates N+1 query problem by using JOIN
 */
export async function listIdeasWithBuckets(planId: string) {
  const { data, error } = await supabase
    .from('ideas')
    .select(`
      id,
      title,
      description,
      location,
      date,
      budget,
      confidence,
      latitude,
      longitude,
      geocoded_place_name,
      link_preview_json,
      attachments,
      created_at,
      updated_at,
      bucket:buckets (
        id,
        title,
        accent_color
      )
    `)
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new DatabaseError('Failed to list ideas with buckets', error)
  }

  return data || []
}

/**
 * Update an idea
 */
export async function updateIdea(id: string, data: IdeaUpdate): Promise<Idea> {
  const { data: idea, error } = await supabase
    .from('ideas')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Idea', id)
    }
    throw new DatabaseError('Failed to update idea', error)
  }

  if (!idea) {
    throw new NotFoundError('Idea', id)
  }

  return idea
}

/**
 * Move an idea to a different bucket
 */
export async function moveIdeaToBucket(id: string, bucketId: string): Promise<Idea> {
  return updateIdea(id, { bucket_id: bucketId })
}

/**
 * Delete an idea
 */
export async function deleteIdea(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('ideas')
    .delete()
    .eq('id', id)

  if (error) {
    throw new DatabaseError('Failed to delete idea', error)
  }

  return true
}
