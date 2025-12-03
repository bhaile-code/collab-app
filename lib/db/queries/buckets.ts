// Bucket CRUD operations
import { supabase } from '../client'
import { Bucket, BucketInsert, BucketUpdate } from '../../types/database'
import { NotFoundError, DatabaseError } from '../../utils/errors'
import { parseVector } from '../pgvector'

/**
 * Create a new bucket
 */
export async function createBucket(data: BucketInsert): Promise<Bucket> {
  const { data: bucket, error } = await supabase
    .from('buckets')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new DatabaseError('Failed to create bucket', error)
  }

  if (!bucket) {
    throw new DatabaseError('Bucket creation returned no data')
  }

  return bucket
}

/**
 * Get a bucket by ID
 */
export async function getBucketById(id: string): Promise<Bucket> {
  const { data: bucket, error } = await supabase
    .from('buckets')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Bucket', id)
    }
    throw new DatabaseError('Failed to fetch bucket', error)
  }

  if (!bucket) {
    throw new NotFoundError('Bucket', id)
  }

  return bucket
}

/**
 * List all buckets for a plan
 */
export async function listBucketsByPlanId(planId: string): Promise<Bucket[]> {
  const { data: buckets, error } = await supabase
    .from('buckets')
    .select(`
      id,
      plan_id,
      title,
      description,
      accent_color,
      display_order,
      created_at,
      embedding
    `)
    .eq('plan_id', planId)
    .order('display_order', { ascending: true })

  if (error) {
    throw new DatabaseError('Failed to list buckets', error)
  }

  // Parse embedding column from pgvector format
  const parsed = (buckets || []).map(bucket => ({
    ...bucket,
    embedding: parseVector(bucket.embedding) || undefined
  }))

  return parsed
}

/**
 * Update a bucket
 */
export async function updateBucket(id: string, data: BucketUpdate): Promise<Bucket> {
  const { data: bucket, error } = await supabase
    .from('buckets')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Bucket', id)
    }
    throw new DatabaseError('Failed to update bucket', error)
  }

  if (!bucket) {
    throw new NotFoundError('Bucket', id)
  }

  return bucket
}

/**
 * Delete a bucket
 */
export async function deleteBucket(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('buckets')
    .delete()
    .eq('id', id)

  if (error) {
    throw new DatabaseError('Failed to delete bucket', error)
  }

  return true
}

/**
 * Get the next display order for a bucket in a plan
 */
export async function getNextDisplayOrder(planId: string): Promise<number> {
  const { data: buckets, error } = await supabase
    .from('buckets')
    .select('display_order')
    .eq('plan_id', planId)
    .order('display_order', { ascending: false })
    .limit(1)

  if (error) {
    throw new DatabaseError('Failed to get next display order', error)
  }

  if (!buckets || buckets.length === 0) {
    return 0
  }

  return buckets[0].display_order + 1
}
