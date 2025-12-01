import { apiClient } from '@/lib/api/client'
import type { Plan } from '@/lib/types/database'
import type { CreatePlanRequest, UpdatePlanRequest } from '@/lib/types/api'

export async function createPlan(data: CreatePlanRequest): Promise<Plan> {
  return apiClient<Plan>('/api/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getPlanById(id: string): Promise<Plan> {
  return apiClient<Plan>(`/api/plans/${id}`)
}

export async function updatePlan(id: string, data: UpdatePlanRequest): Promise<Plan> {
  return apiClient<Plan>(`/api/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deletePlan(id: string): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(`/api/plans/${id}`, {
    method: 'DELETE',
  })
}
