'use client'

import { useEffect, useState } from 'react'
import { createSession } from '@/lib/api/sessions'
import type { GuestSession } from '@/lib/types/database'

export function useSession(planId: string | undefined) {
  const [session, setSession] = useState<GuestSession | null>(null)
  const [needsNickname, setNeedsNickname] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!planId) {
      setIsLoading(false)
      return
    }

    const storedNickname = localStorage.getItem(`nickname_${planId}`)
    const storedSessionId = localStorage.getItem(`sessionId_${planId}`)

    if (!storedNickname || !storedSessionId) {
      setNeedsNickname(true)
      setIsLoading(false)
    } else {
      setSession({
        id: storedSessionId,
        plan_id: planId,
        nickname: storedNickname,
        created_at: '',
        last_active: '',
      })
      setIsLoading(false)
    }
  }, [planId])

  const createNewSession = async (nickname: string) => {
    if (!planId) return

    const newSession = await createSession({ planId, nickname })
    localStorage.setItem(`nickname_${planId}`, nickname)
    localStorage.setItem(`sessionId_${planId}`, newSession.id)
    setSession(newSession)
    setNeedsNickname(false)
  }

  return { session, needsNickname, createNewSession, isLoading }
}
