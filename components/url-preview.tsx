"use client"

import { useState, useEffect } from "react"
import { Link2, ExternalLink, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface UrlPreviewProps {
  url: string
  onRemove?: () => void
  className?: string
}

export function UrlPreview({ url, onRemove, className }: UrlPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Extract domain for display
  const getDomain = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString)
      return urlObj.hostname.replace("www.", "")
    } catch {
      return urlString
    }
  }

  // Generate a favicon URL
  const getFaviconUrl = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString)
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
    } catch {
      return ""
    }
  }

  // Generate a thumbnail using a screenshot service or placeholder
  const getThumbnailUrl = (urlString: string): string => {
    // Use a placeholder with the domain name as query
    const domain = getDomain(urlString)
    return `/placeholder.svg?height=120&width=200&query=${encodeURIComponent(domain + " website preview")}`
  }

  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
    // Simulate loading for smooth UX
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [url])

  const domain = getDomain(url)
  const faviconUrl = getFaviconUrl(url)
  const thumbnailUrl = getThumbnailUrl(url)

  return (
    <div className={cn("relative flex gap-3 p-3 rounded-xl", "bg-muted/50 border border-input", "group", className)}>
      {/* Thumbnail */}
      <div className="relative shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-muted">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : (
          <img
            src={thumbnailUrl || "/placeholder.svg"}
            alt={`Preview of ${domain}`}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
          />
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Link2 className="size-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <img
            src={faviconUrl || "/placeholder.svg"}
            alt=""
            className="size-4 rounded-sm"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
          <span className="text-xs text-muted-foreground truncate">{domain}</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-foreground hover:text-blue-500 truncate flex items-center gap-1 transition-colors"
        >
          <span className="truncate">{url}</span>
          <ExternalLink className="size-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            "absolute -top-2 -right-2",
            "size-6 rounded-full",
            "bg-foreground text-background",
            "flex items-center justify-center",
            "opacity-0 group-hover:opacity-100",
            "hover:bg-foreground/80 transition-all",
          )}
          aria-label="Remove link"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

// Helper function to extract URLs from text
export function extractUrlFromText(text: string): string | null {
  // Regex to match URLs in text
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi
  const matches = text.match(urlRegex)
  return matches ? matches[0] : null
}
