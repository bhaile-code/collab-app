"use client"

import React from "react"
import { CalendarDays, MapPin, Tag, AlertTriangle, FileIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlanningCardProps {
  title: string
  description?: string // Added description prop
  image?: string
  location?: string
  date?: string
  dateType?: "full" | "month-year" | "year"
  budget?: string
  confidence?: number
  onClick?: () => void
  className?: string
  attachments?: {
    url: string
    filename: string
    type: string
    size: number
  }[]
}

function formatDate(date: string, dateType?: "full" | "month-year" | "year"): string {
  if (!date) return ""

  // Handle year-only format
  if (dateType === "year" || /^\d{4}$/.test(date)) {
    return date
  }

  // Handle month-year format (YYYY-MM)
  if (dateType === "month-year" || /^\d{4}-\d{2}$/.test(date)) {
    const [year, month] = date.split("-")
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `${monthNames[Number.parseInt(month, 10) - 1]} ${year}`
  }

  // Handle descriptive dates like "MARCH 2026" or "SUMMER 2027" (legacy)
  if (/^[A-Z]/.test(date)) {
    return date
  }

  // Full date format
  try {
    const d = new Date(date)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return date
  }
}

function PlanningCardComponent({
  title,
  description, // Added description
  image,
  location,
  date,
  dateType,
  budget,
  confidence,
  onClick,
  className,
  attachments,
}: PlanningCardProps) {
  const showConfidenceWarning = confidence !== undefined && confidence < 70

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full min-h-20 rounded-lg bg-card text-card-foreground",
        "border border-border p-4",
        "text-left transition-all duration-200",
        "hover:bg-accent hover:shadow-md active:bg-accent/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        showConfidenceWarning && "pb-8",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        {/* Optional image thumbnail - now on top with 16:9 aspect ratio */}
        {image && (
          <div className="w-full aspect-video overflow-hidden rounded-md bg-muted">
            <img src={image || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h3 className="font-semibold text-base leading-tight line-clamp-1 text-foreground">{title}</h3>

          {description && <p className="text-sm text-muted-foreground leading-snug line-clamp-2">{description}</p>}

          {/* Attachments Gallery */}
          {attachments && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map((attachment, index) =>
                attachment.type.startsWith("image/") ? (
                  // Image thumbnail
                  <div
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(attachment.url, "_blank")
                    }}
                    className="relative w-16 h-16 rounded overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                  >
                    <img src={attachment.url} alt={attachment.filename} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  // PDF file link
                  <a
                    key={index}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <FileIcon className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-700 dark:text-red-300 max-w-24 truncate">
                      {attachment.filename}
                    </span>
                  </a>
                ),
              )}
            </div>
          )}

          {(location || date || budget) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1">
              {location && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="text-xs truncate max-w-32">{location}</span>
                </div>
              )}

              {date && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="text-xs">{formatDate(date, dateType)}</span>
                </div>
              )}

              {budget && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="text-xs">{budget}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {showConfidenceWarning && (
          <div
            className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
            title={`${confidence}% confidence`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span className="text-[10px] font-medium">{confidence}%</span>
          </div>
        )}
      </div>
    </button>
  )
}

// Memoize to prevent unnecessary re-renders
export const PlanningCard = React.memo(PlanningCardComponent)
