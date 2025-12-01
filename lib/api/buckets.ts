import { apiClient } from '@/lib/api/client'
import type { Bucket } from '@/lib/types/database'
import type {
  CreateBucketRequest,
  UpdateBucketRequest,
} from '@/lib/types/api'

export async function listBucketsByPlan(planId: string): Promise<Bucket[]> {
  return apiClient<Bucket[]>(`/api/plans/${planId}/buckets`)
}

export async function createBucket(
  planId: string,
  data: CreateBucketRequest
): Promise<Bucket> {
  return apiClient<Bucket>(`/api/plans/${planId}/buckets`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateBucket(
  bucketId: string,
  data: UpdateBucketRequest
): Promise<Bucket> {
  return apiClient<Bucket>(`/api/buckets/${bucketId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteBucket(bucketId: string): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(`/api/buckets/${bucketId}`, {
    method: 'DELETE',
  })
}
