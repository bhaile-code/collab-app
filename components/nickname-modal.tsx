"use client"

import { useState, useEffect, type KeyboardEvent } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface NicknameModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (nickname: string) => Promise<void>
}

export function NicknameModal({ isOpen, onClose, onSubmit }: NicknameModalProps) {
  const [nickname, setNickname] = useState("")

  // Reset nickname when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNickname("")
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!nickname.trim()) {
      return
    }

    await onSubmit(nickname.trim())
    onClose()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && nickname.trim()) {
      handleSubmit()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <div className="p-6 space-y-5">
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-xl font-semibold text-foreground">
              What should we call you?
            </DialogTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your group will see this name on ideas you add
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 30))}
              onKeyDown={handleKeyDown}
              placeholder="Enter a nickname..."
              autoFocus
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all"
            />

            <Button
              onClick={handleSubmit}
              disabled={!nickname.trim()}
              className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50 transition-all"
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
