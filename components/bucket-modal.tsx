"use client"

import { useState, useEffect } from "react"
import { X, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { COLOR_POOL, BUCKET_COLORS, type BucketColor } from "@/lib/shared-data"

interface BucketModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (bucket: { id?: string; title: string; description?: string; color: BucketColor }) => Promise<void>
  usedColors?: BucketColor[]
  editingBucket?: {
    id: string
    title: string
    description?: string
    color: BucketColor
  }
}

export function BucketModal({ isOpen, onClose, onSubmit, usedColors = [], editingBucket }: BucketModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assignedColor, setAssignedColor] = useState<BucketColor>("blue")

  const isEditMode = !!editingBucket

  useEffect(() => {
    if (isOpen) {
      if (editingBucket) {
        // Edit mode: populate with existing data
        setTitle(editingBucket.title)
        setDescription(editingBucket.description || "")
        setAssignedColor(editingBucket.color)
      } else {
        // Create mode: reset and find unused color
        setTitle("")
        setDescription("")
        const usedSet = new Set(usedColors)
        const availableColor = COLOR_POOL.find((color) => !usedSet.has(color))
        setAssignedColor(availableColor || COLOR_POOL[0])
      }
    }
  }, [isOpen, usedColors, editingBucket])

  const handleSubmit = async () => {
    if (!title.trim()) return
    await onSubmit({
      id: editingBucket?.id,
      title: title.trim(),
      description: description.trim() || undefined,
      color: assignedColor,
    })
    onClose()
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const colorClasses = BUCKET_COLORS[assignedColor]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full sm:max-w-md",
          "bg-card rounded-t-2xl sm:rounded-2xl",
          "shadow-xl border border-border",
          "animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95",
          "duration-200",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bucket-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn("flex items-center justify-center size-10 rounded-full", colorClasses.bg)}>
              <Archive className={cn("size-5", colorClasses.text)} />
            </div>
            <h2 id="bucket-modal-title" className="text-lg font-semibold text-foreground">
              {isEditMode ? "Edit Bucket" : "Create Bucket"}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="size-10 rounded-full" aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Title input */}
          <div className="space-y-2">
            <label htmlFor="bucket-title" className="text-sm font-medium text-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              id="bucket-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Restaurant Ideas"
              className={cn(
                "w-full min-h-12 px-4 rounded-xl",
                "bg-muted border border-border",
                "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-blue-500",
                "transition-colors",
              )}
              autoFocus
            />
          </div>

          {/* Description input */}
          <div className="space-y-2">
            <label htmlFor="bucket-description" className="text-sm font-medium text-foreground">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="bucket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context about what belongs in this bucket..."
              rows={3}
              className={cn(
                "w-full px-4 py-3 rounded-xl resize-none",
                "bg-muted border border-border",
                "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-blue-500",
                "transition-colors",
              )}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground">Color:</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                colorClasses.bg,
                colorClasses.text,
              )}
            >
              <span className={cn("size-2 rounded-full", colorClasses.solid)} />
              {assignedColor.charAt(0).toUpperCase() + assignedColor.slice(1)}
            </span>
            {!isEditMode && <span className="text-xs text-muted-foreground">(auto-assigned)</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 pt-0">
          <Button variant="outline" onClick={onClose} className="flex-1 min-h-12 rounded-xl font-medium bg-transparent">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className={cn(
              "flex-1 min-h-12 rounded-xl font-medium",
              "bg-blue-500 hover:bg-blue-600 text-white",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {isEditMode ? "Save" : "Create"}
          </Button>
        </div>

        {/* Safe area for iOS */}
        <div className="h-safe-area-inset-bottom sm:hidden" />
      </div>
    </div>
  )
}
