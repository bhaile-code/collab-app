import { apiClient } from '@/lib/api/client'
import type { GuestSession } from '@/lib/types/database'
import type { CreateSessionRequest } from '@/lib/types/api'

export async function createSession(
  data: CreateSessionRequest
): Promise<GuestSession> {
  return apiClient<GuestSession>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
