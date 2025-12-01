"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Users, Loader2, Sparkles, MapPin, CalendarDays, ChevronRight, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Plan {
  id: string
  title: string
  image?: string
  location?: string
  date?: string
}

interface LandingPageProps {
  plans: Plan[]
  onCreatePlan: (plan: { planContext: string }) => void
  onOpenPlan: (planId: string) => void
}

export function LandingPage({ plans, onCreatePlan, onOpenPlan }: LandingPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [planContext, setPlanContext] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const hasPlans = plans.length > 0

  useEffect(() => {
    if (isModalOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isModalOpen])

  const handleCreatePlan = async () => {
    if (!planContext.trim()) return

    setIsLoading(true)
    // Simulate a brief loading state for UX
    await new Promise((resolve) => setTimeout(resolve, 600))

    onCreatePlan({ planContext: planContext.trim() })
    setPlanContext("")
    setIsLoading(false)
    setIsModalOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && planContext.trim() && !isLoading) {
      e.preventDefault()
      handleCreatePlan()
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background scroll-smooth">
      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          {/* Icon/Illustration */}
          <div className="mb-8">
            <div className="size-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
              <Users className="size-10 text-blue-500" />
            </div>
          </div>

          {/* App Name */}
          <h1 className="text-3xl font-bold text-foreground mb-4">Collab</h1>

          {/* Value Proposition */}
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 max-w-md text-balance leading-tight">
            Turn messy group ideas into clear decisions
          </h2>

          {/* Subheadline */}
          <p className="text-base text-muted-foreground mb-8 max-w-sm text-balance leading-relaxed">
            No sign-ups, no templates. Just share a link and start planning together.
          </p>

          {/* Primary CTA */}
          <Button
            onClick={() => setIsModalOpen(true)}
            className={cn(
              "min-h-12 px-8 text-base font-medium rounded-xl",
              "bg-blue-500 hover:bg-blue-600 text-white",
              "shadow-lg shadow-blue-500/25",
              "transition-all duration-200",
            )}
          >
            Start Planning
          </Button>
        </section>

        {/* Your Plans Section - only show if user has plans */}
        {hasPlans && (
          <section className="px-4 pb-24 pt-6 border-t border-border bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground mb-4 px-2">Your Plans</h2>
            <div className="flex flex-col gap-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => onOpenPlan(plan.id)}
                  className={cn(
                    "group w-full min-h-12 rounded-xl bg-card text-card-foreground",
                    "border border-border p-3",
                    "text-left transition-all duration-200",
                    "hover:bg-accent hover:border-blue-500/30 hover:shadow-sm",
                    "active:scale-[0.99]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                  )}
                >
                  <div className="flex gap-3">
                    {plan.image && (
                      <div className="shrink-0 w-20 aspect-video overflow-hidden rounded-lg bg-muted">
                        <img
                          src={plan.image || "/placeholder.svg"}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                      <h3 className="font-medium text-sm leading-tight line-clamp-2 text-foreground">{plan.title}</h3>
                      {(plan.location || plan.date) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {plan.location && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span className="text-xs truncate max-w-32">{plan.location}</span>
                            </div>
                          )}
                          {plan.date && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span className="text-xs">{plan.date}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center">
                      <ChevronRight className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Empty state when no plans */}
        {!hasPlans && (
          <section className="px-6 pb-12 text-center">
            <div className="flex flex-col items-center py-8 px-4 rounded-2xl bg-muted/30 border border-dashed border-border">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Sparkles className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-balance">Your plans will appear here</p>
            </div>
          </section>
        )}
      </main>

      {hasPlans && (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={cn(
            "fixed bottom-6 right-4 z-40",
            "size-14 rounded-full",
            "bg-blue-500 text-white shadow-lg shadow-blue-500/25",
            "flex items-center justify-center",
            "hover:bg-blue-600 active:scale-95",
            "transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          )}
          aria-label="New Plan"
        >
          <Plus className="size-6" />
        </button>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md mx-4 rounded-2xl p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold">What are you planning?</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <Textarea
              ref={inputRef}
              placeholder="Me and my family are thinking about moving to Italy in a few years and want to start planning what we'll need..."
              value={planContext}
              onChange={(e) => setPlanContext(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={3}
              className={cn(
                "min-h-[96px] text-base rounded-xl resize-none",
                "border-border bg-background",
                "placeholder:text-muted-foreground/60",
                "focus-visible:ring-blue-500",
              )}
            />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Describe what you're planning. We'll help organize your ideas.
            </p>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleCreatePlan}
              disabled={!planContext.trim() || isLoading}
              className={cn(
                "w-full min-h-12 text-base font-medium rounded-xl",
                "bg-blue-500 hover:bg-blue-600 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-200",
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Plan"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
