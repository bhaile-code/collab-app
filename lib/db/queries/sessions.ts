// Guest session operations
import { supabase } from '../client'
import { GuestSession, GuestSessionInsert } from '../../types/database'
import { NotFoundError, DatabaseError, AlreadyExistsError } from '../../utils/errors'

/**
 * Create a new guest session
 */
export async function createGuestSession(data: GuestSessionInsert): Promise<GuestSession> {
  const { data: session, error } = await supabase
    .from('guest_sessions')
    .insert(data)
    .select()
    .single()

  if (error) {
    // Handle unique constraint violation (nickname already exists for this plan)
    if (error.code === '23505') {
      throw new AlreadyExistsError(
        'A user with this nickname already exists in this plan',
        { nickname: data.nickname }
      )
    }
    throw new DatabaseError('Failed to create guest session', error)
  }

  if (!session) {
    throw new DatabaseError('Session creation returned no data')
  }

  return session
}

/**
 * Get a session by ID
 */
export async function getSessionById(id: string): Promise<GuestSession> {
  const { data: session, error } = await supabase
    .from('guest_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Session', id)
    }
    throw new DatabaseError('Failed to fetch session', error)
  }

  if (!session) {
    throw new NotFoundError('Session', id)
  }

  return session
}

/**
 * Get a session by plan ID and nickname
 */
export async function getSessionByPlanAndNickname(
  planId: string,
  nickname: string
): Promise<GuestSession | null> {
  const { data: session, error } = await supabase
    .from('guest_sessions')
    .select('*')
    .eq('plan_id', planId)
    .eq('nickname', nickname)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new DatabaseError('Failed to fetch session', error)
  }

  return session
}

/**
 * List all sessions for a plan
 */
export async function listSessionsByPlanId(planId: string): Promise<GuestSession[]> {
  const { data: sessions, error } = await supabase
    .from('guest_sessions')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new DatabaseError('Failed to list sessions', error)
  }

  return sessions || []
}

/**
 * Update last_active timestamp for a session
 */
export async function updateSessionActivity(id: string): Promise<GuestSession> {
  const { data: session, error } = await supabase
    .from('guest_sessions')
    .update({ last_active: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Session', id)
    }
    throw new DatabaseError('Failed to update session activity', error)
  }

  if (!session) {
    throw new NotFoundError('Session', id)
  }

  return session
}
