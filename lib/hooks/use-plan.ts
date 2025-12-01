'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPlan, getPlanById } from '@/lib/api/plans'
import type { Plan } from '@/lib/types/database'

export function usePlan(planIdFromUrl?: string) {
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function initializePlan() {
      try {
        const normalizedId =
          planIdFromUrl && planIdFromUrl !== 'new' ? planIdFromUrl : undefined

        if (normalizedId) {
          const existingPlan = await getPlanById(normalizedId)
          setPlan(existingPlan)
          localStorage.setItem('currentPlanId', existingPlan.id)
          return
        }

        const storedPlanId = localStorage.getItem('currentPlanId')

        if (storedPlanId) {
          try {
            const existingPlan = await getPlanById(storedPlanId)
            setPlan(existingPlan)
            router.replace(`/p/${storedPlanId}`)
            return
          } catch {
            // fall through and create new
          }
        }

        const newPlan = await createPlan({
          planContext: 'General planning board for my ideas',
          title: 'My Plan',
        })
        setPlan(newPlan)
        localStorage.setItem('currentPlanId', newPlan.id)
        router.replace(`/p/${newPlan.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plan')
      } finally {
        setIsLoading(false)
      }
    }

    initializePlan()
  }, [planIdFromUrl, router])

  return { plan, isLoading, error, setPlan }
}
