import { apiClient } from '@/lib/api/client'
import type { Idea } from '@/lib/types/database'
import type {
  CreateIdeaRequest,
  UpdateIdeaRequest,
  MoveIdeaRequest,
} from '@/lib/types/api'

export async function listIdeasByPlan(planId: string): Promise<Idea[]> {
  return apiClient<Idea[]>(`/api/plans/${planId}/ideas`)
}

export async function createIdea(
  planId: string,
  data: CreateIdeaRequest
): Promise<Idea> {
  return apiClient<Idea>(`/api/plans/${planId}/ideas`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateIdea(
  ideaId: string,
  data: UpdateIdeaRequest
): Promise<Idea> {
  return apiClient<Idea>(`/api/ideas/${ideaId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteIdea(ideaId: string): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(`/api/ideas/${ideaId}`, {
    method: 'DELETE',
  })
}

export async function moveIdea(
  ideaId: string,
  data: MoveIdeaRequest
): Promise<Idea> {
  return apiClient<Idea>(`/api/ideas/${ideaId}/move`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function getUploadUrl(
  ideaId: string,
  file: { filename: string; contentType: string; size: number }
): Promise<{ uploadUrl: string; path: string; expiresIn: number }> {
  return apiClient<{ uploadUrl: string; path: string; expiresIn: number }>(
    `/api/ideas/${ideaId}/upload-url`,
    {
      method: 'POST',
      body: JSON.stringify(file),
    }
  )
}
