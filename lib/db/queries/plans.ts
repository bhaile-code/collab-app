// Plan CRUD operations
import { supabase } from '../client'
import { Plan, PlanInsert, PlanUpdate } from '../../types/database'
import { NotFoundError, DatabaseError } from '../../utils/errors'
import { getCached, setCache, invalidateCache } from '../../utils/cache'

/**
 * Create a new plan
 */
export async function createPlan(data: PlanInsert): Promise<Plan> {
  const { data: plan, error } = await supabase
    .from('plans')
    .insert(data)
    .select()
    .single()

  if (error) {
    throw new DatabaseError('Failed to create plan', error)
  }

  if (!plan) {
    throw new DatabaseError('Plan creation returned no data')
  }

  return plan
}

/**
 * Get a plan by ID
 */
export async function getPlanById(id: string): Promise<Plan> {
  // Check cache first
  const cacheKey = `plan:${id}`
  const cached = getCached<Plan>(cacheKey)

  if (cached) {
    console.log(`✓ Cache HIT: ${cacheKey}`)
    return cached
  }

  console.log(`✗ Cache MISS: ${cacheKey}`)

  // Fetch from database
  const { data: plan, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Plan', id)
    }
    throw new DatabaseError('Failed to fetch plan', error)
  }

  if (!plan) {
    throw new NotFoundError('Plan', id)
  }

  // Cache for 5 minutes
  setCache(cacheKey, plan, 300000)

  return plan
}

/**
 * Update a plan
 */
export async function updatePlan(id: string, data: PlanUpdate): Promise<Plan> {
  const { data: plan, error } = await supabase
    .from('plans')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Plan', id)
    }
    throw new DatabaseError('Failed to update plan', error)
  }

  if (!plan) {
    throw new NotFoundError('Plan', id)
  }

  // Invalidate cache after update
  invalidateCache(`plan:${id}`)

  return plan
}

/**
 * Delete a plan
 */
export async function deletePlan(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', id)

  if (error) {
    throw new DatabaseError('Failed to delete plan', error)
  }

  return true
}

/**
 * List all plans (for testing/debugging - remove in production)
 */
export async function listPlans(): Promise<Plan[]> {
  const { data: plans, error } = await supabase
    .from('plans')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new DatabaseError('Failed to list plans', error)
  }

  return plans || []
}
