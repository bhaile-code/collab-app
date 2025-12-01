"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Map, List, MapPin, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { BUCKET_COLORS, type BucketColor } from "@/lib/shared-data"

interface MapLocation {
  id: string
  name: string
  x: number
  y: number
  bucketColor?: BucketColor
  cards: Array<{
    id: string
    title: string
    image?: string
    date?: string
    bucket?: { label: string; color: BucketColor }
  }>
}

interface MapViewProps {
  locations: MapLocation[]
  onCardClick?: (cardId: string) => void
  className?: string
}

type ViewMode = "map" | "list"
type SheetState = "collapsed" | "partial" | "expanded"

function getPinColors(color: BucketColor = "gray") {
  const colors = BUCKET_COLORS[color] || BUCKET_COLORS.gray
  return {
    bg: "bg-white",
    icon: colors.pin,
    ring: colors.ring,
  }
}

function getTagClasses(color: BucketColor = "gray") {
  const colors = BUCKET_COLORS[color] || BUCKET_COLORS.gray
  return `${colors.bg} ${colors.text}`
}

export function MapView({ locations, onCardClick, className }: MapViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("map")
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [sheetState, setSheetState] = useState<SheetState>("collapsed")
  const dragStartY = useRef<number>(0)
  const dragStartState = useRef<SheetState>("collapsed")

  const handleLocationSelect = (location: MapLocation) => {
    setSelectedLocation(location)
    setSheetState("partial")
  }

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    dragStartState.current = sheetState
  }

  const handleDragEnd = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = "changedTouches" in e ? e.changedTouches[0].clientY : e.clientY
    const deltaY = dragStartY.current - clientY

    if (deltaY > 50) {
      if (dragStartState.current === "collapsed") setSheetState("partial")
      else if (dragStartState.current === "partial") setSheetState("expanded")
    } else if (deltaY < -50) {
      if (dragStartState.current === "expanded") setSheetState("partial")
      else if (dragStartState.current === "partial") {
        setSheetState("collapsed")
        setSelectedLocation(null)
      }
    }
  }

  const handleMapClick = () => {
    if (sheetState !== "collapsed") {
      setSheetState("collapsed")
      setSelectedLocation(null)
    }
  }

  const getSheetHeight = () => {
    switch (sheetState) {
      case "expanded":
        return "h-[85%]"
      case "partial":
        return "h-[40%]"
      default:
        return "h-12"
    }
  }

  return (
    <div className={cn("relative h-screen w-full overflow-hidden bg-background", className)}>
      <div className="absolute top-4 right-4 z-20">
        <div className="flex rounded-full bg-white border border-gray-200 shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
              viewMode === "map" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:text-gray-900",
            )}
          >
            <Map className="h-4 w-4" />
            <span>Map</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
              viewMode === "list" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:text-gray-900",
            )}
          >
            <List className="h-4 w-4" />
            <span>List</span>
          </button>
        </div>
      </div>

      {viewMode === "map" ? (
        <>
          <div
            className="absolute inset-0 pb-14"
            onClick={handleMapClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Escape" && handleMapClick()}
          >
            <div className="h-full w-full relative overflow-hidden" style={{ backgroundColor: "#E0F2F1" }}>
              <div className="absolute inset-0 opacity-30">
                <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#94A3B8" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>

              {locations.map((location) => {
                const pinColor = getPinColors(location.bucketColor)
                const isSelected = selectedLocation?.id === location.id

                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLocationSelect(location)
                    }}
                    style={{
                      left: `${location.x}%`,
                      top: `${location.y}%`,
                    }}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2",
                      "flex items-center gap-2 px-3 py-2 rounded-full",
                      "bg-white border border-gray-200",
                      "text-sm font-medium whitespace-nowrap",
                      "transition-all hover:scale-105 active:scale-95",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      pinColor.ring,
                      "shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
                      isSelected && `ring-2 ${pinColor.ring}`,
                    )}
                  >
                    <MapPin className={cn("h-4 w-4 shrink-0", pinColor.icon)} />
                    <span className="text-gray-900">{location.name}</span>
                  </button>
                )
              })}

              <div className="absolute bottom-4 left-4 text-sm text-gray-600 bg-white/90 px-3 py-1.5 rounded-lg shadow-sm">
                Map placeholder - Mapbox integration ready
              </div>
            </div>
          </div>

          <div
            className={cn(
              "absolute bottom-14 left-0 right-0 bg-white rounded-t-2xl",
              "shadow-[0_-4px_20px_rgba(0,0,0,0.1)]",
              "transition-all duration-300 ease-out",
              getSheetHeight(),
            )}
          >
            <div
              className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
              onMouseDown={handleDragStart}
              onMouseUp={handleDragEnd}
              onTouchStart={handleDragStart}
              onTouchEnd={handleDragEnd}
            >
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="px-4 pb-4 overflow-y-auto h-[calc(100%-44px)]">
              {selectedLocation ? (
                <div className="space-y-4">
                  <h2 className="font-semibold text-lg text-gray-900">{selectedLocation.name}</h2>

                  <div className="space-y-3">
                    {selectedLocation.cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => onCardClick?.(card.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl bg-gray-50 border border-gray-100",
                          "transition-colors hover:bg-gray-100 active:bg-gray-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        )}
                      >
                        <p className="font-medium text-gray-900 line-clamp-2">{card.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {card.date && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {card.date}
                            </span>
                          )}
                          {card.bucket && (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium",
                                getTagClasses(card.bucket.color),
                              )}
                            >
                              {card.bucket.label}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">Tap a location to see ideas</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="h-full overflow-y-auto pt-16 pb-20 px-4">
          <div className="space-y-6">
            {locations.map((location) => {
              const pinColor = getPinColors(location.bucketColor)

              return (
                <div key={location.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className={cn("h-4 w-4", pinColor.icon)} />
                    <h2 className="font-semibold text-gray-900">{location.name}</h2>
                    <span className="text-sm text-gray-500">
                      {location.cards.length} idea{location.cards.length !== 1 && "s"}
                    </span>
                  </div>

                  <div className="space-y-2 pl-6">
                    {location.cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => onCardClick?.(card.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl bg-white border border-gray-200",
                          "transition-colors hover:bg-gray-50 active:bg-gray-100",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        )}
                      >
                        <p className="font-medium text-gray-900 line-clamp-2">{card.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {card.date && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              {card.date}
                            </span>
                          )}
                          {card.bucket && (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium",
                                getTagClasses(card.bucket.color),
                              )}
                            >
                              {card.bucket.label}
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
        </div>
      )}
    </div>
  )
}
