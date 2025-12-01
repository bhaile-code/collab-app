"use client"

import { Users } from "lucide-react"
import type { ActiveUser } from "@/lib/services/realtime"
import { cn } from "@/lib/utils"

interface ActiveUsersIndicatorProps {
  users: ActiveUser[]
  currentSessionId?: string
  className?: string
}

export function ActiveUsersIndicator({ users, currentSessionId, className }: ActiveUsersIndicatorProps) {
  if (!users || users.length === 0) return null

  const total = users.length

  const displayUsers = users.slice(0, 3)
  const extraCount = total - displayUsers.length

  const formatName = (user: ActiveUser) => {
    if (user.sessionId === currentSessionId) return "You"
    return user.nickname
  }

  const labelParts: string[] = displayUsers.map(formatName)
  if (extraCount > 0) {
    labelParts.push(`+${extraCount}`)
  }

  const label = labelParts.join(", ")

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs shadow-md border border-border/60 backdrop-blur-sm",
        className,
      )}
    >
      <span className="inline-flex items-center justify-center rounded-full bg-blue-50 text-blue-600 p-1">
        <Users className="h-3 w-3" />
      </span>
      <span className="font-medium text-foreground truncate max-w-[160px]">{label}</span>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">({total} viewing)</span>
    </div>
  )
}
