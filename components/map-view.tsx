"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Map, List, MapPin, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { BUCKET_COLORS, type BucketColor } from "@/lib/shared-data"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

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
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])

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

  // Initialize Mapbox map (only once)
  useEffect(() => {
    console.log('🗺️ Map init effect:', {
      hasContainer: !!mapContainer.current,
      viewMode,
      hasMap: !!map.current,
      locationsCount: locations.length
    })

    if (!mapContainer.current) {
      console.log('❌ No map container')
      return
    }
    if (viewMode !== "map") {
      console.log('⚠️ Not in map view mode')
      return
    }
    if (map.current) {
      console.log('✅ Map already exists, skipping init')
      return
    }

    console.log('🗺️ Initializing Mapbox map')

    // Set Mapbox access token
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!token) {
      console.error('❌ NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set')
      return
    }

    mapboxgl.accessToken = token

    // Calculate center point from locations
    const validLocations = locations.filter((loc) => loc.lat && loc.lng)
    if (validLocations.length === 0) {
      console.warn('⚠️ No valid locations with lat/lng')
      return
    }

    const centerLat = validLocations.reduce((sum, loc) => sum + loc.lat, 0) / validLocations.length
    const centerLng = validLocations.reduce((sum, loc) => sum + loc.lng, 0) / validLocations.length

    console.log('📍 Map center:', { centerLat, centerLng, validLocations: validLocations.length })

    try {
      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [centerLng, centerLat],
        zoom: 10,
      })

      console.log('✅ Map instance created')

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right")

      // Handle clicks on the map to close bottom sheet
      map.current.on('click', () => {
        setSheetState("collapsed")
        setSelectedLocation(null)
      })

      // Handle map load event
      map.current.on('load', () => {
        console.log('✅ Map loaded successfully')
        console.log('📐 Container dimensions:', {
          width: mapContainer.current?.offsetWidth,
          height: mapContainer.current?.offsetHeight
        })
        console.log('🖼️ Canvas element:', mapContainer.current?.querySelector('canvas'))

        // Resize map to ensure proper rendering
        setTimeout(() => {
          map.current?.resize()
        }, 100)

        // Fit map to show all markers
        if (validLocations.length > 1) {
          const bounds = new mapboxgl.LngLatBounds()
          validLocations.forEach((loc) => bounds.extend([loc.lng, loc.lat]))
          map.current?.fitBounds(bounds, { padding: 50, maxZoom: 12 })
        }
      })

      // Handle map errors
      map.current.on('error', (e) => {
        console.error('❌ Map error:', e)
      })

    } catch (error) {
      console.error('❌ Failed to initialize map:', error)
    }

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up map')
      map.current?.remove()
      map.current = null
    }
  }, [viewMode, locations])

  // Update markers when locations change
  useEffect(() => {
    if (!map.current || viewMode !== "map") return

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove())
    markers.current = []

    const validLocations = locations.filter((loc) => loc.lat && loc.lng)

    // Add markers for each location
    validLocations.forEach((location) => {
      const pinColor = getPinColors(location.bucketColor)

      // Create custom marker element
      const el = document.createElement("div")
      el.className = "mapbox-marker"
      el.innerHTML = `
        <div class="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-gray-200 shadow-lg cursor-pointer hover:scale-105 transition-transform">
          <svg class="h-4 w-4 ${pinColor.icon.replace("text-", "fill-")}" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span class="text-sm font-medium text-gray-900 whitespace-nowrap">${location.name}</span>
        </div>
      `

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([location.lng, location.lat])
        .addTo(map.current!)

      // Add click handler
      el.addEventListener("click", (e) => {
        e.stopPropagation() // Prevent map click handler from firing
        handleLocationSelect(location)
      })

      markers.current.push(marker)
    })

    // Update map bounds if needed
    if (validLocations.length > 1 && map.current?.isStyleLoaded()) {
      const bounds = new mapboxgl.LngLatBounds()
      validLocations.forEach((loc) => bounds.extend([loc.lng, loc.lat]))
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 12 })
    }

    // Cleanup markers
    return () => {
      markers.current.forEach((marker) => marker.remove())
      markers.current = []
    }
  }, [locations, viewMode])

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
            ref={mapContainer}
            className="absolute top-0 left-0 right-0 bottom-14 z-0"
            style={{
              width: '100%',
              height: '100%',
              minHeight: '400px'
            }}
          />

          <div
            className={cn(
              "absolute bottom-14 left-0 right-0 bg-white rounded-t-2xl z-10",
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
