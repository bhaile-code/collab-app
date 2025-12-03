"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LandingPage } from "@/components/landing-page"
import { createPlan, getPlanById } from "@/lib/api/plans"
import type { Plan as DbPlan } from "@/lib/types/database"

interface LandingPlan {
  id: string
  title: string
  image?: string
  location?: string
  date?: string
}

export default function Home() {
  const router = useRouter()
  const [plans, setPlans] = useState<LandingPlan[]>([])
  const [isLoadingInitialPlan, setIsLoadingInitialPlan] = useState(true)

  // On first load, if we have a currentPlanId, fetch it so it can appear in "Your Plans"
  useEffect(() => {
    const loadLastPlan = async () => {
      const storedPlanId = typeof window !== "undefined" ? localStorage.getItem("currentPlanId") : null
      if (!storedPlanId) {
        setIsLoadingInitialPlan(false)
        return
      }

      try {
        const plan: DbPlan = await getPlanById(storedPlanId)
        setPlans([
          {
            id: plan.id,
            title: plan.title,
          },
        ])
      } catch {
        // If the stored plan no longer exists, clear it
        localStorage.removeItem("currentPlanId")
      } finally {
        setIsLoadingInitialPlan(false)
      }
    }

    loadLastPlan()
  }, [])

  const handleCreatePlan = async (planData: { description: string }) => {
    try {
      const plan = await createPlan({
        description: planData.description,
      })

      // Remember this as the current plan
      localStorage.setItem("currentPlanId", plan.id)

      // Update local list so it shows up in "Your Plans" on return
      setPlans((prev) => {
        const withoutDup = prev.filter((p) => p.id !== plan.id)
        return [{ id: plan.id, title: plan.title }, ...withoutDup]
      })

      router.push(`/p/${plan.id}`)
    } catch (error) {
      console.error("Error creating plan:", error)
    }
  }

  const handleOpenPlan = (planId: string) => {
    // Remember this selection
    localStorage.setItem("currentPlanId", planId)
    router.push(`/p/${planId}`)
  }

  // While we optionally load the last plan for display, we can still render the landing UI
  // (it will just show the empty state until plans[] is populated).
  return <LandingPage plans={plans} onCreatePlan={handleCreatePlan} onOpenPlan={handleOpenPlan} />
}
