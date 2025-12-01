"use client"

import { supabase } from "@/lib/db/client"
import type { Bucket, GuestSession, Idea } from "@/lib/types/database"
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePresenceState,
} from "@supabase/supabase-js"

export interface ActiveUser {
  sessionId: string
  nickname: string
}

export interface PlanRealtimeCallbacks {
  onIdeaInsert?: (idea: Idea) => void
  onIdeaUpdate?: (idea: Idea) => void
  onIdeaDelete?: (id: string) => void
  onBucketInsert?: (bucket: Bucket) => void
  onBucketUpdate?: (bucket: Bucket) => void
  onBucketDelete?: (id: string) => void
  onPresenceChange?: (users: ActiveUser[]) => void
}

type PresencePayload = {
  sessionId: string
  nickname: string
}

type PresenceState = RealtimePresenceState<PresencePayload>

/**
 * Get or create a stable anonymous presence ID
 * Uses localStorage to persist across page refreshes
 */
function getOrCreateAnonPresenceId(): string {
  if (typeof window === 'undefined') {
    return `anon-${Math.random().toString(36).slice(2)}`
  }

  const STORAGE_KEY = 'collab-anon-presence-id'
  let anonId = localStorage.getItem(STORAGE_KEY)

  if (!anonId) {
    anonId = `anon-${Math.random().toString(36).slice(2)}-${Date.now()}`
    localStorage.setItem(STORAGE_KEY, anonId)
  }

  return anonId
}

function mapPresenceState(state: PresenceState): ActiveUser[] {
  const users: ActiveUser[] = []

  Object.values(state).forEach((entries) => {
    entries.forEach((p) => {
      users.push({
        sessionId: p.sessionId,
        nickname: p.nickname,
      })
    })
  })

  // Deduplicate by sessionId and sort by nickname for stable UI
  const uniqueBySession = new Map<string, ActiveUser>()
  for (const user of users) {
    uniqueBySession.set(user.sessionId, user)
  }

  return Array.from(uniqueBySession.values()).sort((a, b) => a.nickname.localeCompare(b.nickname))
}

function handleIdeaChange(
  payload: RealtimePostgresChangesPayload<Idea>,
  callbacks: PlanRealtimeCallbacks,
) {
  const { eventType, new: newRow, old: oldRow } = payload

  switch (eventType) {
    case "INSERT":
      if (newRow && callbacks.onIdeaInsert) {
        callbacks.onIdeaInsert(newRow)
      }
      break
    case "UPDATE":
      if (newRow && callbacks.onIdeaUpdate) {
        callbacks.onIdeaUpdate(newRow)
      }
      break
    case "DELETE":
      if (oldRow?.id && callbacks.onIdeaDelete) {
        callbacks.onIdeaDelete(oldRow.id)
      }
      break
  }
}

function handleBucketChange(
  payload: RealtimePostgresChangesPayload<Bucket>,
  callbacks: PlanRealtimeCallbacks,
) {
  const { eventType, new: newRow, old: oldRow } = payload

  switch (eventType) {
    case "INSERT":
      if (newRow && callbacks.onBucketInsert) {
        callbacks.onBucketInsert(newRow)
      }
      break
    case "UPDATE":
      if (newRow && callbacks.onBucketUpdate) {
        callbacks.onBucketUpdate(newRow)
      }
      break
    case "DELETE":
      if (oldRow?.id && callbacks.onBucketDelete) {
        callbacks.onBucketDelete(oldRow.id)
      }
      break
  }
}

export interface PlanRealtimeSubscription {
  channel: RealtimeChannel
  unsubscribe: () => void
}

/**
 * Subscribe to realtime updates for a plan (ideas + buckets + presence).
 *
 * Note: This is a client-side helper; it should be used from components/pages
 * that run in the browser (PlanPage, presence indicators, etc).
 */
export function subscribeToPlanUpdates(
  planId: string,
  session: GuestSession | null,
  callbacks: PlanRealtimeCallbacks,
): PlanRealtimeSubscription {
  // Use stable presence key for anonymous users
  const presenceKey: string = session?.id ?? getOrCreateAnonPresenceId()

  const channel = supabase
    .channel(`plan:${planId}`, {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    })
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ideas", filter: `plan_id=eq.${planId}` },
      (payload) => handleIdeaChange(payload as RealtimePostgresChangesPayload<Idea>, callbacks),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "buckets", filter: `plan_id=eq.${planId}` },
      (payload) => handleBucketChange(payload as RealtimePostgresChangesPayload<Bucket>, callbacks),
    )
    .on("presence", { event: "sync" }, () => {
      if (!callbacks.onPresenceChange) return
      const state = channel.presenceState<PresencePayload>()
      const users = mapPresenceState(state)
      callbacks.onPresenceChange(users)
    })

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED" && session) {
      // Announce our presence
      channel.track({
        sessionId: session.id,
        nickname: session.nickname,
      })
    } else if (status === "CHANNEL_ERROR") {
      console.error(`❌ Realtime subscription error for plan:${planId}`)
    } else if (status === "TIMED_OUT") {
      console.error(`⏱️ Realtime subscription timed out for plan:${planId}`)
    } else if (status === "CLOSED") {
      console.warn(`🔒 Realtime channel closed for plan:${planId}`)
    }
  })

  return {
    channel,
    unsubscribe: () => {
      // Explicitly remove presence before unsubscribing
      channel.untrack()
      supabase.removeChannel(channel)
    },
  }
}

/**
 * Explicit presence broadcast helper. In most cases, presence is handled
 * automatically when subscribing via subscribeToPlanUpdates, but this
 * can be used to update nickname or re-announce presence.
 */
export function broadcastPresence(
  channel: RealtimeChannel,
  session: GuestSession | null,
): void {
  if (!session) return

  channel.track({
    sessionId: session.id,
    nickname: session.nickname,
  })
}
