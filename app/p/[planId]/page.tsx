"use client"

import { use, useEffect, useMemo, useState } from "react"
import { usePlan } from "@/lib/hooks/use-plan"
import { useSession } from "@/lib/hooks/use-session"
import { listIdeasByPlan, createIdea, updateIdea, deleteIdea, moveIdea } from "@/lib/api/ideas"
import { listBucketsByPlan, createBucket, updateBucket, deleteBucket } from "@/lib/api/buckets"
import type { Idea, Bucket } from "@/lib/types/database"
import type {
  CreateIdeaRequest,
  UpdateIdeaRequest,
  CreateBucketRequest,
  UpdateBucketRequest,
  MoveIdeaRequest,
} from "@/lib/types/api"
import { BoardView } from "@/components/board-view"
import { TimelineView } from "@/components/timeline-view"
import { MapView } from "@/components/map-view"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { ErrorView } from "@/components/error-view"
import { NicknameModal } from "@/components/nickname-modal"
import { IdeaCaptureModal } from "@/components/idea-capture-modal"
import { BucketModal } from "@/components/bucket-modal"
import { IdeaEditView } from "@/components/idea-edit-view"
import { ShareModal } from "@/components/share-modal"
import { BottomNav, type NavTab } from "@/components/bottom-nav"
import { Settings, Bell, User, HelpCircle } from "lucide-react"
import { toast } from "sonner"
import type { BucketColor } from "@/lib/shared-data"
import { ActiveUsersIndicator } from "@/components/active-users-indicator"
import { subscribeToPlanUpdates, type ActiveUser } from "@/lib/services/realtime"

type PageProps = {
  params: Promise<{
    planId: string
  }>
}

interface BoardCard {
  id: string
  title: string
  description?: string
  image?: string
  location?: string
  date?: string
  dateType?: "full" | "month-year" | "year"
  confidence?: number
}

interface TimelineEvent {
  id: string
  title: string
  date: string
  image?: string
  location?: string
  bucket?: {
    label: string
    color?: BucketColor
  }
}

interface MapLocation {
  id: string
  name: string
  lat: number   // latitude (-90 to 90)
  lng: number   // longitude (-180 to 180)
  x?: number    // fallback for mock data (percentage)
  y?: number    // fallback for mock data (percentage)
  bucketColor?: BucketColor
  cards: Array<{
    id: string
    title: string
    image?: string
    date?: string
    bucket?: { label: string; color: BucketColor }
  }>
}

type SimpleBucketColor = "blue" | "green" | "orange" | "purple" | "gray"

function toSimpleBucketColor(color: BucketColor): SimpleBucketColor {
  switch (color) {
    case "blue":
    case "green":
    case "orange":
    case "purple":
    case "gray":
      return color
    default:
      return "gray"
  }
}

function MoreMenu() {
  const menuItems = [
    { icon: <User className="size-5" />, label: "Profile", description: "Manage your account" },
    { icon: <Bell className="size-5" />, label: "Notifications", description: "Configure alerts" },
    { icon: <Settings className="size-5" />, label: "Settings", description: "App preferences" },
    { icon: <HelpCircle className="size-5" />, label: "Help & Support", description: "Get assistance" },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-sm">
        <h1 className="text-xl font-semibold text-foreground">More</h1>
      </header>
      <div className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              className="flex w-full items-center gap-4 rounded-xl bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {item.icon}
              </span>
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PlanPage({ params }: PageProps) {
  const { planId } = use(params)
  const planIdFromUrl = planId
  const { plan, isLoading: isPlanLoading, error: planError } = usePlan(planIdFromUrl)
  const { session, needsNickname, createNewSession, isLoading: isSessionLoading } = useSession(plan?.id)

  const [ideas, setIdeas] = useState<Idea[]>([])
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [activeTab, setActiveTab] = useState<NavTab>("board")

  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false)
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
  const [editingBucket, setEditingBucket] = useState<Bucket | null>(null)

  // Load plan data (ideas + buckets)
  useEffect(() => {
    async function loadPlanData() {
      if (!plan?.id) return

      setIsLoadingData(true)
      try {
        const [fetchedIdeas, fetchedBuckets] = await Promise.all([
          listIdeasByPlan(plan.id),
          listBucketsByPlan(plan.id),
        ])
        setIdeas(fetchedIdeas)
        setBuckets(fetchedBuckets)
      } catch (error) {
        toast.error("Failed to load plan data", {
          description: error instanceof Error ? error.message : "Unknown error",
        })
      } finally {
        setIsLoadingData(false)
      }
    }

    loadPlanData()
  }, [plan?.id])

  // Realtime subscription for ideas, buckets, and presence
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_REALTIME !== "true") {
      return
    }

    if (!plan?.id) {
      return
    }

    const subscription = subscribeToPlanUpdates(plan.id, session, {
      onIdeaInsert: (idea) => {
        setIdeas((prev) => {
          if (prev.some((i) => i.id === idea.id)) return prev
          return [idea, ...prev]
        })
      },
      onIdeaUpdate: (idea) => {
        setIdeas((prev) => prev.map((i) => (i.id === idea.id ? idea : i)))
      },
      onIdeaDelete: (id) => {
        setIdeas((prev) => prev.filter((i) => i.id !== id))
      },
      onBucketInsert: (bucket) => {
        setBuckets((prev) => {
          if (prev.some((b) => b.id === bucket.id)) return prev
          return [...prev, bucket]
        })
      },
      onBucketUpdate: (bucket) => {
        setBuckets((prev) => prev.map((b) => (b.id === bucket.id ? bucket : b)))
      },
      onBucketDelete: (id) => {
        setBuckets((prev) => prev.filter((b) => b.id !== id))
      },
      onPresenceChange: (users) => {
        setActiveUsers(users)
      },
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [plan?.id, session?.id, session?.nickname])

  const boardCards: BoardCard[] = useMemo(
    () =>
      ideas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        description: idea.description,
        location: idea.location ?? undefined,
        date: idea.date ?? undefined,
        confidence: idea.confidence,
      })),
    [ideas],
  )

  const boardBuckets = useMemo(
    () =>
      buckets.map((bucket) => ({
        id: bucket.id,
        title: bucket.title,
        description: bucket.description ?? undefined,
        cardIds: ideas.filter((idea) => idea.bucket_id === bucket.id).map((idea) => idea.id),
        accentColor: bucket.accent_color as BucketColor,
      })),
    [buckets, ideas],
  )

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    const bucketInfo = new Map(
      buckets.map((b) => [b.id, { title: b.title, color: b.accent_color as BucketColor }]),
    )

    return ideas
      .filter((idea) => idea.date)
      .map((idea) => {
        const info = idea.bucket_id ? bucketInfo.get(idea.bucket_id) : undefined
        return {
          id: idea.id,
          title: idea.title,
          date: idea.date!,
          location: idea.location ?? undefined,
          bucket: info
            ? {
                label: info.title,
                color: info.color,
              }
            : undefined,
        }
      })
  }, [ideas, buckets])

  const mapLocations: MapLocation[] = useMemo(() => {
    const bucketInfo = new Map(
      buckets.map((b) => [b.id, { title: b.title, color: b.accent_color as BucketColor }]),
    )

    const locationMap = new Map<string, MapLocation>()

    ideas
      .filter((idea) => {
        // Only include ideas that have been geocoded with valid coordinates
        return idea.location && idea.latitude !== null && idea.longitude !== null
      })
      .forEach((idea) => {
        const locName = idea.location!
        const info = idea.bucket_id ? bucketInfo.get(idea.bucket_id) : undefined
        const color: BucketColor = info?.color ?? "gray"

        if (!locationMap.has(locName)) {
          // Use the actual geocoded coordinates from the database
          locationMap.set(locName, {
            id: `loc-${locName.replace(/\s+/g, "-").toLowerCase()}`,
            name: locName,
            lat: idea.latitude!,
            lng: idea.longitude!,
            x: 0, // Not used by map component
            y: 0, // Not used by map component
            bucketColor: color,
            cards: [],
          })
        }

        const loc = locationMap.get(locName)!
        loc.cards.push({
          id: idea.id,
          title: idea.title,
          date: idea.date ?? undefined,
          bucket: info
            ? {
                label: info.title,
                color,
              }
            : { label: "General", color: "gray" },
        })
      })

    return Array.from(locationMap.values())
  }, [ideas, buckets])

  const locationCount = boardCards.filter((card) => card.location).length
  const dateCount = boardCards.filter((card) => card.date).length
  const showExternalBottomNav = locationCount >= 2 || dateCount >= 2

  // Handlers

  const handleAddIdea = () => {
    setIsIdeaModalOpen(true)
  }

  const handleAddBucket = () => {
    setEditingBucket(null)
    setIsBucketModalOpen(true)
  }

  const handleEditBucket = (bucket: { id: string; title: string; description?: string; accentColor?: BucketColor }) => {
    const found = buckets.find((b) => b.id === bucket.id)
    if (found) {
      setEditingBucket(found)
      setIsBucketModalOpen(true)
    }
  }

  const handleSubmitIdea = async (ideaData: {
    title: string
    description: string
    link?: string
    image?: string
    location?: string
    date?: string
    dateType?: "full" | "month-year" | "year"
    includeTime?: boolean
    bucketId?: string
  }) => {
    if (!plan?.id) return

    const previousIdeasCount = ideas.length
    const hadBuckets = buckets.length > 0

    // Optimistic idea shown immediately
    const tempId = crypto.randomUUID()
    const optimisticIdea: Idea = {
      id: tempId,
      plan_id: plan.id,
      bucket_id: ideaData.bucketId ?? null,
      title: ideaData.title,
      description: ideaData.description,
      location: ideaData.location ?? null,
      date: ideaData.date ?? null,
      budget: null,
      confidence: 85,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      latitude: null,
      longitude: null,
      geocoded_place_name: null,
      link_preview_json: null,
    }

    setIdeas((prev) => [optimisticIdea, ...prev])

    try {
      const payload: CreateIdeaRequest = {
        title: ideaData.title,
        description: ideaData.description,
        location: ideaData.location,
        date: ideaData.date,
        budget: undefined,
        confidence: 85,
      }

      // If user picked a bucket, respect it.
      // Otherwise, do NOT set bucketId so the backend can decide:
      // - create emergent buckets (when none exist yet), or
      // - classify into existing / new bucket via LLM.
      if (ideaData.bucketId) {
        payload.bucketId = ideaData.bucketId
      }

      const created = await createIdea(plan.id, payload)

      // Replace optimistic idea with server-created idea
      setIdeas((prev) => prev.map((idea) => (idea.id === tempId ? created : idea)))
      toast.success("Idea added")
      // Don't close modal here - let the modal handle closing after file upload
      // setIsIdeaModalOpen(false)

      // If we did NOT send a bucketId, backend may run emergent bucket creation or classification.
      if (!payload.bucketId) {
        if (!hadBuckets && previousIdeasCount >= 1) {
          // This was the 2nd (or later) idea in a plan with 0 buckets → emergent bucket creation path.
          setIsOrganizing(true)
          setTimeout(async () => {
            try {
              const [refIdeas, refBuckets] = await Promise.all([
                listIdeasByPlan(plan.id),
                listBucketsByPlan(plan.id),
              ])
              setIdeas(refIdeas)
              setBuckets(refBuckets)
            } catch (error) {
              console.error("Failed to refresh after organizing:", error)
            } finally {
              setIsOrganizing(false)
            }
          }, 3500) // Slightly longer than the 3s server debounce
        } else if (hadBuckets) {
          // Existing buckets: classification may have created a new bucket or adjusted assignments.
          try {
            const [refIdeas, refBuckets] = await Promise.all([
              listIdeasByPlan(plan.id),
              listBucketsByPlan(plan.id),
            ])
            setIdeas(refIdeas)
            setBuckets(refBuckets)
          } catch (error) {
            console.error("Failed to refresh after classification:", error)
          }
        }
      }

      // Return the created idea so modal can upload files
      console.log("📤 handleSubmitIdea returning idea:", created)
      return created
    } catch (error) {
      // Roll back optimistic idea on failure
      setIdeas((prev) => prev.filter((idea) => idea.id !== tempId))
      toast.error("Failed to add idea")
      throw error
    }
  }

  const handleCardClick = (ideaId: string) => {
    const idea = ideas.find((i) => i.id === ideaId)
    console.log('🔍 handleCardClick - found idea:', idea?.title)
    console.log('🔍 handleCardClick - idea attachments:', idea?.attachments)
    if (idea) {
      setEditingIdea(idea)
    }
  }

  const handleSaveIdea = async (updated: {
    id?: string
    title: string
    description?: string
    link?: string
    image?: string
    location?: string
    date?: string
    dateType?: "full" | "month-year" | "year"
    includeTime?: boolean
    bucketId?: string
    confidence?: number
  }) => {
    if (!updated.id) return

    const existing = ideas.find((i) => i.id === updated.id)
    if (!existing) return

    const previousIdeas = ideas

    // Optimistic update
    const optimisticIdea: Idea = {
      ...existing,
      title: updated.title,
      description: updated.description ?? existing.description,
      location: updated.location ?? null,
      date: updated.date ?? null,
      bucket_id: updated.bucketId ?? existing.bucket_id,
      confidence: updated.confidence ?? existing.confidence,
      updated_at: new Date().toISOString(),
    }

    setIdeas((prev) => prev.map((idea) => (idea.id === optimisticIdea.id ? optimisticIdea : idea)))

    try {
      const payload: UpdateIdeaRequest = {
        title: updated.title,
        description: updated.description,
        location: updated.location,
        date: updated.date,
        budget: undefined,
        confidence: updated.confidence,
        ...(updated.bucketId ? ({ bucketId: updated.bucketId } as Partial<MoveIdeaRequest>) : {}),
      }

      const saved = await updateIdea(updated.id, payload)
      setIdeas((prev) => prev.map((idea) => (idea.id === saved.id ? saved : idea)))
      toast.success("Idea updated")
      setEditingIdea(null)
    } catch (error) {
      // Roll back on failure
      setIdeas(previousIdeas)
      toast.error("Failed to update idea")
      throw error
    }
  }

  const handleDeleteCard = async (ideaId: string) => {
    try {
      await deleteIdea(ideaId)
      setIdeas((prev) => prev.filter((idea) => idea.id !== ideaId))
      toast.success("Idea deleted")
    } catch (error) {
      toast.error("Failed to delete idea")
    }
  }

  const handleCardMoveToBucket = async (ideaId: string, _fromBucketId: string | null, toBucketId: string) => {
    try {
      const payload: MoveIdeaRequest = { bucketId: toBucketId }
      const updated = await moveIdea(ideaId, payload)
      setIdeas((prev) => prev.map((idea) => (idea.id === updated.id ? updated : idea)))
    } catch (error) {
      toast.error("Failed to move idea")
    }
  }

  const handleSubmitBucket = async (bucketData: {
    id?: string
    title: string
    description?: string
    color: BucketColor
  }) => {
    if (!plan?.id) return

    try {
      if (bucketData.id) {
        const payload: UpdateBucketRequest = {
          title: bucketData.title,
          description: bucketData.description,
          accentColor: bucketData.color,
        }
        const updated = await updateBucket(bucketData.id, payload)
        setBuckets((prev) => prev.map((b) => (b.id === bucketData.id ? updated : b)))
        toast.success("Bucket updated")
      } else {
        // Optimistic bucket create
        const tempId = crypto.randomUUID()
        const optimisticBucket: Bucket = {
          id: tempId,
          plan_id: plan.id,
          title: bucketData.title,
          description: bucketData.description ?? null,
          accent_color: bucketData.color as BucketColor,
          display_order: buckets.length,
          created_at: new Date().toISOString(),
        }

        setBuckets((prev) => [...prev, optimisticBucket])

        const payload: CreateBucketRequest = {
          title: bucketData.title,
          description: bucketData.description,
          accentColor: bucketData.color,
        }
        const created = await createBucket(plan.id, payload)

        // Replace optimistic bucket with server-created bucket
        setBuckets((prev) => prev.map((b) => (b.id === tempId ? created : b)))
        toast.success("Bucket created")
      }

      setIsBucketModalOpen(false)
      setEditingBucket(null)
    } catch (error) {
      // Roll back optimistic bucket on failure
      if (!bucketData.id) {
        setBuckets((prev) => prev.filter((b) => b.title !== bucketData.title || b.description !== bucketData.description))
      }
      toast.error("Failed to save bucket")
      throw error
    }
  }

  const handleDeleteBucket = async (bucketId: string, _deleteIdeas: boolean) => {
    const ideasInBucket = ideas.filter((idea) => idea.bucket_id === bucketId)

    if (ideasInBucket.length > 0) {
      toast.error("Cannot delete bucket with ideas", {
        description: "Move or delete ideas first",
      })
      return
    }

    try {
      await deleteBucket(bucketId)
      setBuckets((prev) => prev.filter((b) => b.id !== bucketId))
      toast.success("Bucket deleted")
    } catch (error) {
      toast.error("Failed to delete bucket")
    }
  }

  const handleBucketsReorder = () => {
    // Reordering is currently local-only; no persistence needed in Phase 2
  }

  const handleCardsReorder = (_bucketId: string, _cardIds: string[]) => {
    // Reordering is currently local-only; no persistence needed in Phase 2
  }

  // Loading states
  if (isPlanLoading || isSessionLoading) {
    return <LoadingSkeleton />
  }

  if (planError || !plan) {
    return <ErrorView message={planError || "Plan not found"} />
  }

  if (needsNickname) {
    return (
      <NicknameModal
        isOpen={true}
        onClose={() => {
          // Cannot close until nickname provided
        }}
        onSubmit={createNewSession}
      />
    )
  }

  if (isLoadingData) {
    return <LoadingSkeleton />
  }

  const planTitle = plan.title || "My Plan"
  const shareUrl =
    typeof window !== "undefined" && plan?.id ? `${window.location.origin}/p/${plan.id}` : "/"

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-30">
        <ActiveUsersIndicator users={activeUsers} currentSessionId={session?.id} />
      </div>
      {activeTab === "board" && (
        <div className={showExternalBottomNav ? "" : "pb-16"}>
          <BoardView
            title={planTitle}
            ideas={boardCards}
            buckets={boardBuckets}
            isOrganizing={isOrganizing}
            onAddIdea={handleAddIdea}
            onAddBucket={handleAddBucket}
            onEditBucket={handleEditBucket}
            onShareClick={() => setIsShareModalOpen(true)}
            onBack={undefined}
            onTabChange={setActiveTab}
            onCardClick={handleCardClick}
            onBucketsReorder={handleBucketsReorder}
            onCardsReorder={handleCardsReorder}
            onCardMoveBucket={handleCardMoveToBucket}
            onDeleteCard={handleDeleteCard}
            onDeleteBucket={handleDeleteBucket}
          />
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="pb-16">
          <TimelineView events={timelineEvents} onEventClick={handleCardClick} />
        </div>
      )}

      {activeTab === "map" && (
        <div className="pb-16">
          <MapView locations={mapLocations} onCardClick={handleCardClick} />
        </div>
      )}

      {activeTab === "more" && <MoreMenu />}

      {(activeTab !== "board" || !showExternalBottomNav) && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        boardTitle={planTitle}
        shareUrl={shareUrl}
      />

      <IdeaCaptureModal
        isOpen={isIdeaModalOpen}
        onClose={async () => {
          setIsIdeaModalOpen(false)
          // Refetch ideas to ensure we have the latest data including attachments
          console.log('🔄 Starting refetch after modal close...')
          try {
            const refreshedIdeas = await listIdeasByPlan(plan.id)
            console.log('🔄 Refetch complete, ideas count:', refreshedIdeas.length)
            console.log('🔄 First idea attachments after refetch:', refreshedIdeas[0]?.attachments)
            setIdeas(refreshedIdeas)
            console.log('✅ Ideas state updated with refreshed data')
          } catch (error) {
            console.error("Failed to refresh ideas after modal close:", error)
          }
        }}
        onSubmit={handleSubmitIdea}
        buckets={buckets.map((b) => ({
          id: b.id,
          title: b.title,
          color: toSimpleBucketColor(b.accent_color as BucketColor),
        }))}
      />

      <BucketModal
        isOpen={isBucketModalOpen}
        onClose={() => {
          setIsBucketModalOpen(false)
          setEditingBucket(null)
        }}
        onSubmit={handleSubmitBucket}
        usedColors={buckets.map((b) => b.accent_color as BucketColor)}
        editingBucket={
          editingBucket
            ? {
                id: editingBucket.id,
                title: editingBucket.title,
                description: editingBucket.description ?? undefined,
                color: editingBucket.accent_color as BucketColor,
              }
            : undefined
        }
      />

      <IdeaEditView
        isOpen={editingIdea !== null}
        idea={
          editingIdea
            ? {
                id: editingIdea.id,
                title: editingIdea.title,
                description: editingIdea.description,
                location: editingIdea.location ?? undefined,
                date: editingIdea.date ?? undefined,
                bucketId: editingIdea.bucket_id ?? undefined,
                confidence: editingIdea.confidence,
                attachments: editingIdea.attachments,
              }
            : undefined
        }
        buckets={buckets.map((b) => ({
          id: b.id,
          title: b.title,
          color: toSimpleBucketColor(b.accent_color as BucketColor),
        }))}
        onClose={() => setEditingIdea(null)}
        onSave={handleSaveIdea}
      />
    </div>
  )
}
