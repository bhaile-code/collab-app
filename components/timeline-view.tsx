"use client"

import { useRef, useMemo } from "react"
import { Calendar, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { BUCKET_COLORS, type BucketColor } from "@/lib/shared-data"

interface TimelineEvent {
  id: string
  title: string
  date: string // ISO date string or descriptive string like "MARCH 2026"
  image?: string
  location?: string
  bucket?: {
    label: string
    color?: BucketColor
  }
}

interface TimelineViewProps {
  events: TimelineEvent[]
  onEventClick?: (id: string) => void
  className?: string
}

function groupEventsByDate(events: TimelineEvent[]) {
  const groups: Record<string, TimelineEvent[]> = {}

  events.forEach((event) => {
    const key = event.date
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(event)
  })

  // Sort dates - ISO dates first, then descriptive dates
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const dateA = new Date(a)
      const dateB = new Date(b)
      const isValidA = !isNaN(dateA.getTime())
      const isValidB = !isNaN(dateB.getTime())

      if (isValidA && isValidB) return dateA.getTime() - dateB.getTime()
      if (isValidA) return -1
      if (isValidB) return 1
      return 0
    })
    .map(([date, items]) => ({ date, events: items }))
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const isValidDate = !isNaN(date.getTime())

  if (!isValidDate) {
    // Handle descriptive dates like "MARCH 2026" or "SUMMER 2027"
    return {
      dayName: "",
      dayNum: "",
      month: dateStr,
      isToday: false,
      isDescriptive: true,
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const targetDate = new Date(dateStr)
  targetDate.setHours(0, 0, 0, 0)

  const isToday = targetDate.getTime() === today.getTime()

  const dayName = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
  const dayNum = date.getDate().toString()
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()

  return { dayName, dayNum, month, isToday, isDescriptive: false }
}

function getBucketTagClasses(color: BucketColor = "gray") {
  const colors = BUCKET_COLORS[color] || BUCKET_COLORS.gray
  return `${colors.bg} ${colors.text}`
}

export function TimelineView({ events, onEventClick, className }: TimelineViewProps) {
  const todayRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const groupedEvents = useMemo(() => groupEventsByDate(events), [events])

  const todayStr = new Date().toISOString().split("T")[0]
  const hasTodayEvents = groupedEvents.some((g) => g.date === todayStr)

  const scrollToToday = () => {
    todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={containerRef} className={cn("relative min-h-screen bg-background", className)}>
      <header className="sticky top-0 z-10 border-b border-border bg-white">
        <div className="flex items-center gap-2 px-4 py-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Timeline</h1>
        </div>
      </header>

      <main className="scroll-smooth pb-24">
        {groupedEvents.length === 0 ? (
          /* Updated empty state copy */
          <div className="flex flex-col items-center justify-center px-4 pt-32 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-foreground text-base font-medium">No dates yet</p>
            <p className="text-muted-foreground text-sm mt-1">Add ideas with dates to see your timeline</p>
          </div>
        ) : (
          <div className="px-4 pt-6">
            {groupedEvents.map((group, groupIndex) => {
              const { dayName, dayNum, month, isToday, isDescriptive } = formatDate(group.date)
              const isLast = groupIndex === groupedEvents.length - 1

              return (
                <div
                  key={group.date}
                  ref={isToday ? todayRef : undefined}
                  className="relative flex gap-4"
                  style={{ minHeight: "40px", marginBottom: isLast ? 0 : "40px" }}
                >
                  <div className="flex flex-col items-center shrink-0 w-[60px]">
                    {/* TODAY label above marker */}
                    {isToday && (
                      <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">
                        Today
                      </span>
                    )}

                    {/* Date marker */}
                    {isDescriptive ? (
                      // Descriptive date marker (e.g., "MARCH 2026")
                      <div className="flex flex-col items-center justify-center w-14 min-h-14 rounded-xl bg-muted text-muted-foreground text-center px-1 py-2">
                        <span className="text-[10px] uppercase font-medium leading-tight">{month}</span>
                      </div>
                    ) : (
                      // Standard date marker
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center w-14 h-16 rounded-xl text-center",
                          isToday
                            ? "bg-blue-500 text-white shadow-lg scale-105"
                            : "bg-white border border-gray-200 text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "text-[10px] uppercase font-medium leading-none",
                            isToday ? "text-blue-100" : "text-gray-400",
                          )}
                        >
                          {dayName}
                        </span>
                        <span
                          className={cn("text-xl font-bold leading-tight", isToday ? "text-white" : "text-foreground")}
                        >
                          {dayNum}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] uppercase leading-none",
                            isToday ? "text-blue-100" : "text-gray-400",
                          )}
                        >
                          {month}
                        </span>
                      </div>
                    )}

                    {/* Connecting line */}
                    {!isLast && <div className="flex-1 w-0.5 min-h-8 mt-2 bg-gray-200" />}
                  </div>

                  <div className="flex-1 flex flex-col gap-2 min-w-0 pt-1">
                    {group.events.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onEventClick?.(event.id)}
                        className={cn(
                          "w-full text-left bg-white border border-gray-200 rounded-xl p-3 shadow-sm",
                          "transition-all duration-150",
                          "hover:shadow-md hover:border-gray-300",
                          "active:scale-[0.98]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        )}
                      >
                        {/* Optional image thumbnail */}
                        {event.image && (
                          <div className="w-full aspect-video rounded-lg overflow-hidden mb-2">
                            <img
                              src={event.image || "/placeholder.svg"}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Title */}
                        <p className="font-semibold text-foreground text-base leading-snug line-clamp-2">
                          {event.title}
                        </p>

                        {/* Tags row */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {/* Location tag */}
                          {event.location && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                          )}

                          {/* Bucket tag */}
                          {event.bucket && (
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                getBucketTagClasses(event.bucket.color),
                              )}
                            >
                              {event.bucket.label}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Scroll to Today FAB - bottom left */}
      {hasTodayEvents && (
        <button
          type="button"
          onClick={scrollToToday}
          aria-label="Scroll to today"
          className={cn(
            "fixed bottom-20 left-4 z-20",
            "h-12 px-4 rounded-full",
            "bg-blue-500 text-white shadow-lg",
            "flex items-center justify-center gap-2",
            "transition-all duration-200 ease-out",
            "hover:bg-blue-600 hover:shadow-xl hover:scale-105",
            "active:scale-95 active:bg-blue-700",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          )}
        >
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-medium">Today</span>
        </button>
      )}
    </div>
  )
}
