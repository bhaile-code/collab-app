"use client"

import type React from "react"

import { LayoutGrid, Calendar, MapPin, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export type NavTab = "board" | "timeline" | "map" | "more"

interface BottomNavProps {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
}

const tabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
  { id: "board", label: "Board", icon: <LayoutGrid className="size-6" /> },
  { id: "timeline", label: "Timeline", icon: <Calendar className="size-6" /> },
  { id: "map", label: "Map", icon: <MapPin className="size-6" /> },
  { id: "more", label: "More", icon: <MoreHorizontal className="size-6" /> },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      {/* Safe area padding for iOS */}
      <div className="flex items-center justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                isActive ? "text-blue-600" : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={cn("transition-transform", isActive && "scale-110")}>{tab.icon}</span>
              {/* Labels hidden on mobile, shown on sm+ */}
              <span className="hidden text-xs font-medium sm:block">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
