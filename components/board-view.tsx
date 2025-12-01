"use client"
import { useState, useRef } from "react"
import type React from "react"
import {
  Sparkles,
  Share2,
  Archive,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  X,
  GripVertical,
  Pencil,
  Lightbulb,
  Trash2,
  MoreHorizontal,
} from "lucide-react"
import { PlanningCard } from "@/components/planning-card"
import { BottomNav, type NavTab } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BUCKET_COLORS, type BucketColor } from "@/lib/shared-data"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface IdeaCard {
  id: string
  title: string
  description?: string
  image?: string
  location?: string
  date?: string
  dateType?: "full" | "month-year" | "year"
  budget?: string
  confidence?: number
  attachments?: {
    url: string
    filename: string
    type: string
    size: number
  }[]
}

interface Bucket {
  id: string
  title: string
  description?: string
  cardIds: string[]
  accentColor?: BucketColor
}

interface BoardViewProps {
  title: string
  ideas: IdeaCard[]
  buckets?: Bucket[]
  isOrganizing?: boolean
  onShareClick?: () => void
  onAddIdea?: () => void
  onAddBucket?: () => void
  onEditBucket?: (bucket: Bucket) => void
  onBucketsReorder?: (buckets: Bucket[]) => void
  onCardsReorder?: (bucketId: string, cardIds: string[]) => void
  onCardMoveBucket?: (cardId: string, fromBucketId: string | null, toBucketId: string) => void
  onCardClick?: (id: string) => void
  onDeleteCard?: (cardId: string) => void
  onDeleteBucket?: (bucketId: string, deleteIdeas: boolean) => void
  onBack?: () => void
  onTabChange?: (tab: NavTab) => void
}

function getBucketBorderClass(color: BucketColor = "gray") {
  const colors = BUCKET_COLORS[color] || BUCKET_COLORS.gray
  return colors.border
}

export function BoardView({
  title,
  ideas,
  buckets = [],
  isOrganizing = false,
  onShareClick,
  onAddIdea,
  onAddBucket,
  onEditBucket,
  onBucketsReorder,
  onCardsReorder,
  onCardMoveBucket,
  onCardClick,
  onDeleteCard,
  onDeleteBucket,
  onBack,
  onTabChange,
}: BoardViewProps) {
  const [showHintBanner, setShowHintBanner] = useState(true)
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<string>>(() => new Set(buckets.map((b) => b.id)))
  const [expandedTitles, setExpandedTitles] = useState<Set<string>>(new Set())
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set())
  const seenBucketIds = useRef<Set<string>>(new Set(buckets.map((b) => b.id)))

  const [cardToDelete, setCardToDelete] = useState<{ id: string; title: string } | null>(null)
  const [bucketToDelete, setBucketToDelete] = useState<{ id: string; title: string; cardCount: number } | null>(null)

  const toggleBucket = (bucketId: string) => {
    setCollapsedBuckets((prev) => {
      const next = new Set(prev)
      if (next.has(bucketId)) {
        next.delete(bucketId)
      } else {
        next.add(bucketId)
      }
      return next
    })
  }

  const toggleExpandedTitle = (bucketId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedTitles((prev) => {
      const next = new Set(prev)
      if (next.has(bucketId)) {
        next.delete(bucketId)
      } else {
        next.add(bucketId)
      }
      return next
    })
  }

  const toggleExpandedDescription = (bucketId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedDescriptions((prev) => {
      const next = new Set(prev)
      if (next.has(bucketId)) {
        next.delete(bucketId)
      } else {
        next.add(bucketId)
      }
      return next
    })
  }

  const TITLE_MAX_LENGTH_COLLAPSED = 30
  const TITLE_MAX_LENGTH_EXPANDED = 60
  const DESC_MAX_LENGTH_COLLAPSED = 40
  const DESC_MAX_LENGTH_EXPANDED = 100

  const locationCount = ideas.filter((i) => i.location).length
  const hasMoreLocations = locationCount >= 2
  const needsOneMoreLocation = locationCount === 1
  const isEmpty = ideas.length === 0 && buckets.length === 0
  const hasFloatingIdeas = ideas.length > 0 && buckets.length === 0
  const bucketedCardIds = new Set(buckets.flatMap((b) => b.cardIds))
  const unbucketedCards = ideas.filter((card) => !bucketedCardIds.has(card.id))

  const allCollapsed = buckets.length > 0 && collapsedBuckets.size === buckets.length
  const allExpanded = buckets.length > 0 && collapsedBuckets.size === 0

  const handleExpandAll = () => {
    setCollapsedBuckets(new Set())
  }

  const handleCollapseAll = () => {
    setCollapsedBuckets(new Set(buckets.map((b) => b.id)))
  }

  const handleBucketDragStart = (e: React.DragEvent, bucketId: string, index: number) => {
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", bucketId)
  }

  const handleBucketDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleBucketDragEnd = () => {}

  const handleCardDragStart = (e: React.DragEvent, cardId: string, bucketId: string | null, cardIndex: number) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", cardId)
  }

  const handleCardDragOver = (e: React.DragEvent, bucketId: string, cardIndex?: number) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleCardDragLeave = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
    }
  }

  const handleCardDrop = (e: React.DragEvent, targetBucketId: string, targetCardIndex?: number) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleCardDragEnd = () => {}

  const handleConfirmMove = () => {}

  const handleCancelMove = () => {}

  const handleDeleteCardClick = (cardId: string, cardTitle: string) => {
    setCardToDelete({ id: cardId, title: cardTitle })
  }

  const handleConfirmDeleteCard = () => {
    if (cardToDelete) {
      onDeleteCard?.(cardToDelete.id)
      setCardToDelete(null)
    }
  }

  const handleDeleteBucketClick = (bucketId: string, bucketTitle: string, cardCount: number) => {
    setBucketToDelete({ id: bucketId, title: bucketTitle, cardCount })
  }

  const handleConfirmDeleteBucket = (deleteIdeas: boolean) => {
    if (bucketToDelete) {
      onDeleteBucket?.(bucketToDelete.id, deleteIdeas)
      setBucketToDelete(null)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#F9FAFB] select-none">
      <header className="sticky top-0 z-10 h-14 bg-white border-b border-border/50">
        <div className="relative flex items-center justify-center h-full px-4">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label="Go back"
              className="absolute left-2 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-lg font-semibold text-foreground truncate max-w-[60%] text-center">{title}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onShareClick}
            aria-label="Share board"
            className="absolute right-2 h-10 w-10"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className={cn("scroll-smooth overflow-y-auto", hasMoreLocations ? "pb-40" : "pb-32")}>
        {isOrganizing ? (
          <div className="px-4 py-8 text-center">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Getting organized...</span>
            </div>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center px-6 min-h-[calc(100vh-56px-80px)] text-center">
            <div className="rounded-full bg-blue-50 p-5 mb-5">
              <Sparkles className="h-10 w-10 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">What are you planning?</h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-[280px]">
              Add your first idea and watch the board organize itself. Share the link to collaborate with others.
            </p>
          </div>
        ) : hasFloatingIdeas ? (
          <div className="px-4 py-6">
            <div className="text-center mb-6">
              <p className="text-muted-foreground text-sm">Add one more idea to see the magic happen ✨</p>
            </div>
            <div className="space-y-3 max-w-md mx-auto">
              {ideas.map((idea) => (
                <PlanningCard
                  key={idea.id}
                  title={idea.title}
                  description={idea.description}
                  image={idea.image}
                  location={idea.location}
                  date={idea.date}
                  budget={idea.budget}
                  confidence={idea.confidence}
                  onClick={() => onCardClick?.(idea.id)}
                  attachments={idea.attachments}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {buckets.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={allExpanded ? handleCollapseAll : handleExpandAll}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors px-2 py-1"
                >
                  {allExpanded ? "Collapse all" : "Expand all"}
                </button>
              </div>
            )}

            {buckets.map((bucket, bucketIndex) => {
              const bucketCards = bucket.cardIds
                .map((id) => ideas.find((card) => card.id === id))
                .filter((card): card is IdeaCard => card !== undefined)
              const isCollapsed = collapsedBuckets.has(bucket.id)
              const accentClass = getBucketBorderClass(bucket.accentColor)
              const isDraggedBucket = false
              const isDropTarget = false

              return (
                <div
                  key={bucket.id}
                  draggable
                  onDragStart={(e) => handleBucketDragStart(e, bucket.id, bucketIndex)}
                  onDragOver={(e) => handleBucketDragOver(e, bucketIndex)}
                  onDragEnd={handleBucketDragEnd}
                  className={cn(
                    "rounded-xl bg-white border border-border/50 border-l-4 overflow-hidden transition-all duration-200 select-none",
                    accentClass,
                    isDraggedBucket && "opacity-50 scale-[0.98]",
                    isDropTarget && "ring-2 ring-blue-500 ring-offset-2 bg-blue-50/50",
                  )}
                >
                  <div className="flex items-center">
                    <div
                      className="flex items-center justify-center w-8 h-full cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground pl-2 select-none touch-none"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleBucket(bucket.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          toggleBucket(bucket.id)
                        }
                      }}
                      className="flex-1 flex items-center justify-between px-2 py-3 hover:bg-muted/50 transition-colors overflow-hidden"
                    >
                      <div className="text-left flex-1 min-w-0 max-w-[calc(100%-80px)] sm:max-w-[calc(100%-90px)] md:max-w-[calc(100%-100px)]">
                        <div className="flex items-baseline gap-1 flex-wrap">
                          <h2
                            className={cn(
                              "font-semibold text-lg text-foreground",
                              !expandedTitles.has(bucket.id) && !isCollapsed
                                ? "line-clamp-2"
                                : !expandedTitles.has(bucket.id) && isCollapsed
                                  ? "truncate"
                                  : "",
                            )}
                          >
                            {expandedTitles.has(bucket.id)
                              ? bucket.title
                              : isCollapsed
                                ? bucket.title
                                : bucket.title.length > TITLE_MAX_LENGTH_EXPANDED
                                  ? bucket.title.slice(0, TITLE_MAX_LENGTH_EXPANDED) + "..."
                                  : bucket.title}
                          </h2>
                          {bucket.title.length >
                            (isCollapsed ? TITLE_MAX_LENGTH_COLLAPSED : TITLE_MAX_LENGTH_EXPANDED) && (
                            <button
                              type="button"
                              onClick={(e) => toggleExpandedTitle(bucket.id, e)}
                              className="text-xs text-blue-500 hover:text-blue-600 font-medium shrink-0"
                            >
                              {expandedTitles.has(bucket.id) ? "less" : "more"}
                            </button>
                          )}
                        </div>
                        {bucket.description && (
                          <div className="flex items-baseline gap-1 flex-wrap mt-0.5">
                            <p
                              className={cn(
                                "text-sm text-muted-foreground",
                                !expandedDescriptions.has(bucket.id) && !isCollapsed
                                  ? "line-clamp-2"
                                  : !expandedDescriptions.has(bucket.id) && isCollapsed
                                    ? "truncate"
                                    : "",
                              )}
                            >
                              {expandedDescriptions.has(bucket.id)
                                ? bucket.description
                                : isCollapsed
                                  ? bucket.description
                                  : bucket.description.length > DESC_MAX_LENGTH_EXPANDED
                                    ? bucket.description.slice(0, DESC_MAX_LENGTH_EXPANDED) + "..."
                                    : bucket.description}
                            </p>
                            {bucket.description.length >
                              (isCollapsed ? DESC_MAX_LENGTH_COLLAPSED : DESC_MAX_LENGTH_EXPANDED) && (
                              <button
                                type="button"
                                onClick={(e) => toggleExpandedDescription(bucket.id, e)}
                                className="text-xs text-blue-500 hover:text-blue-600 font-medium shrink-0"
                              >
                                {expandedDescriptions.has(bucket.id) ? "less" : "more"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isCollapsed && bucketCards.length > 0 && (
                          <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-muted text-sm font-medium text-muted-foreground">
                            {bucketCards.length}
                          </span>
                        )}
                        {isCollapsed ? (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                          className="h-9 w-9 mr-2 text-muted-foreground hover:text-foreground"
                          aria-label={`More options for ${bucket.title} bucket`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => onEditBucket?.(bucket)} className="gap-2">
                          <Pencil className="h-4 w-4" />
                          Edit bucket
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteBucketClick(bucket.id, bucket.title, bucketCards.length)}
                          className="gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete bucket
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 pt-0">
                      {bucketCards.map((idea, cardIndex) => {
                        const isBeingDragged = false
                        const isDropTargetCard = false

                        return (
                          <div
                            key={idea.id}
                            draggable
                            onDragStart={(e) => handleCardDragStart(e, idea.id, bucket.id, cardIndex)}
                            onDragOver={(e) => handleCardDragOver(e, bucket.id)}
                            onDrop={(e) => handleCardDrop(e, bucket.id, cardIndex)}
                            onDragEnd={handleCardDragEnd}
                            className={cn(
                              "relative group transition-all duration-200 select-none cursor-grab active:cursor-grabbing",
                              isBeingDragged && "opacity-50 scale-[0.98] shadow-lg",
                              isDropTargetCard &&
                                "before:absolute before:inset-x-0 before:-top-1.5 before:h-1 before:bg-blue-500 before:rounded-full",
                            )}
                          >
                            <PlanningCard
                              title={idea.title}
                              description={idea.description}
                              image={idea.image}
                              location={idea.location}
                              date={idea.date}
                              budget={idea.budget}
                              confidence={idea.confidence}
                              onClick={() => onCardClick?.(idea.id)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteCardClick(idea.id, idea.title)
                              }}
                              className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={`Delete ${idea.title}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                      {bucketCards.length === 0 && (
                        <p className="text-sm text-muted-foreground col-span-full py-2">
                          {isDropTarget ? "Drop idea here" : "No ideas in this bucket yet"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {unbucketedCards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unbucketedCards.map((idea) => {
                  const isBeingDragged = false

                  return (
                    <div
                      key={idea.id}
                      draggable
                      onDragStart={(e) => handleCardDragStart(e, idea.id, null, ideas.indexOf(idea))}
                      onDragEnd={handleCardDragEnd}
                      className={cn(
                        "relative group transition-all duration-200 select-none cursor-grab active:cursor-grabbing",
                        isBeingDragged && "opacity-50 scale-[0.98] shadow-lg",
                      )}
                    >
                      <PlanningCard
                        title={idea.title}
                        description={idea.description}
                        image={idea.image}
                        location={idea.location}
                        date={idea.date}
                        budget={idea.budget}
                        confidence={idea.confidence}
                        onClick={() => onCardClick?.(idea.id)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteCardClick(idea.id, idea.title)
                        }}
                        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Delete ${idea.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Hint Banner - only show when exactly 1 location exists */}
            {showHintBanner && needsOneMoreLocation && (
              <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
                <p className="flex-1 text-sm text-blue-800">Add 1 more location to unlock Map view</p>
                <button
                  onClick={() => setShowHintBanner(false)}
                  className="shrink-0 rounded p-1 hover:bg-blue-100"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4 text-blue-600" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <div className={cn("fixed right-4 z-20 flex flex-col gap-3", hasMoreLocations ? "bottom-20" : "bottom-6")}>
        {!isEmpty && (
          <button
            type="button"
            onClick={onAddBucket}
            aria-label="Add bucket"
            className={cn(
              "h-12 w-12 rounded-full",
              "bg-white text-foreground shadow-lg border border-border/50",
              "flex items-center justify-center",
              "transition-all duration-200 ease-out",
              "hover:bg-accent hover:shadow-xl hover:scale-105",
              "active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            )}
          >
            <Archive className="h-5 w-5" />
          </button>
        )}

        <button
          type="button"
          onClick={onAddIdea}
          aria-label="Add idea"
          className={cn(
            "h-14 w-14 rounded-full",
            "bg-blue-500 text-white shadow-lg",
            "flex items-center justify-center",
            "transition-all duration-200 ease-out",
            "hover:bg-blue-600 hover:shadow-xl hover:scale-105",
            "active:scale-95 active:bg-blue-700",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          )}
        >
          <Lightbulb className="h-6 w-6" />
        </button>
      </div>

      {/* Bottom Nav - use onTabChange prop instead of empty function */}
      {hasMoreLocations && onTabChange && <BottomNav activeTab="board" onTabChange={onTabChange} />}

      <AlertDialog open={!!cardToDelete} onOpenChange={(open) => !open && setCardToDelete(null)}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete idea?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{cardToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="min-h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteCard}
              className="min-h-12 bg-red-500 text-white hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!bucketToDelete} onOpenChange={(open) => !open && setBucketToDelete(null)}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bucket?</AlertDialogTitle>
            <AlertDialogDescription>
              {bucketToDelete?.cardCount && bucketToDelete.cardCount > 0
                ? `"${bucketToDelete?.title}" contains ${bucketToDelete.cardCount} idea${bucketToDelete.cardCount > 1 ? "s" : ""}. What would you like to do with them?`
                : `Are you sure you want to delete "${bucketToDelete?.title}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="min-h-12">Cancel</AlertDialogCancel>
            {bucketToDelete?.cardCount && bucketToDelete.cardCount > 0 ? (
              <>
                <AlertDialogAction
                  onClick={() => handleConfirmDeleteBucket(false)}
                  className="min-h-12 bg-blue-500 text-white hover:bg-blue-600"
                >
                  Keep ideas
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={() => handleConfirmDeleteBucket(true)}
                  className="min-h-12 bg-red-500 text-white hover:bg-red-600"
                >
                  Delete all
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={() => handleConfirmDeleteBucket(false)}
                className="min-h-12 bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
