"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { X, Link2, ImageIcon, MapPin, Calendar, AlertTriangle, Loader2, Check, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { UrlPreview, extractUrlFromText } from "./url-preview"

interface Bucket {
  id: string
  title: string
  color: "blue" | "green" | "orange" | "purple" | "gray"
}

interface IdeaData {
  id?: string
  title: string // Now explicit title field
  description?: string // Added description field (user's original input)
  link?: string
  image?: string
  location?: string
  date?: string
  dateType?: "full" | "month-year" | "year"
  includeTime?: boolean
  bucketId?: string
  confidence?: number
}

interface IdeaEditViewProps {
  isOpen: boolean
  idea?: IdeaData
  buckets?: Bucket[]
  onClose: () => void
  onSave: (idea: IdeaData) => Promise<void>
}

const bucketColors = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  gray: "bg-gray-500",
}

const bucketBorderColors = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  orange: "border-l-orange-500",
  purple: "border-l-purple-500",
  gray: "border-l-gray-500",
}

const defaultBuckets: Bucket[] = [
  { id: "general", title: "General Ideas", color: "gray" },
  { id: "location", title: "Location Preferences", color: "blue" },
  { id: "house", title: "House Requirements", color: "green" },
  { id: "budget", title: "Budget & Costs", color: "orange" },
]

export function IdeaEditView({ isOpen, idea, buckets = defaultBuckets, onClose, onSave }: IdeaEditViewProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false)
  const [link, setLink] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [dateType, setDateType] = useState<"full" | "month-year" | "year">("full")
  const [includeTime, setIncludeTime] = useState(false)
  const [selectedBucketId, setSelectedBucketId] = useState<string>("general")
  const [confidence, setConfidence] = useState<number>(85)

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showBucketSelector, setShowBucketSelector] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [autoDetectedUrl, setAutoDetectedUrl] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialize form with existing idea data
  useEffect(() => {
    if (isOpen) {
      if (idea) {
        setTitle(idea.title || "")
        setDescription(idea.description || "")
        setLink(idea.link || "")
        setImage(idea.image || null)
        setLocation(idea.location || "")
        setDate(idea.date || "")
        setDateType(idea.dateType || "full")
        setIncludeTime(idea.includeTime || false)
        setSelectedBucketId(idea.bucketId || "general")
        setConfidence(idea.confidence ?? 85)
      } else {
        resetForm()
      }
      setHasChanges(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen, idea])

  // Track changes
  useEffect(() => {
    if (idea) {
      const changed =
        title !== (idea.title || "") ||
        description !== (idea.description || "") ||
        link !== (idea.link || "") ||
        image !== (idea.image || null) ||
        location !== (idea.location || "") ||
        date !== (idea.date || "") ||
        dateType !== (idea.dateType || "full") ||
        selectedBucketId !== (idea.bucketId || "general") ||
        confidence !== (idea.confidence ?? 85)
      setHasChanges(changed)
    }
  }, [title, description, link, image, location, date, dateType, selectedBucketId, confidence, idea])

  // Auto-detect URLs in description
  useEffect(() => {
    if (!link) {
      const detectedUrl = extractUrlFromText(description)
      if (detectedUrl) {
        setLink(detectedUrl)
        setAutoDetectedUrl(true)
      }
    }
  }, [description, link])

  const resetForm = useCallback(() => {
    setTitle("")
    setDescription("")
    setLink("")
    setImage(null)
    setLocation("")
    setDate("")
    setDateType("full")
    setIncludeTime(false)
    setSelectedBucketId("general")
    setConfidence(85)
    setHasChanges(false)
    setAutoDetectedUrl(false)
  }, [])

  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowDiscardDialog(true)
    } else {
      resetForm()
      onClose()
    }
  }, [hasChanges, resetForm, onClose])

  const handleDiscard = useCallback(() => {
    setShowDiscardDialog(false)
    resetForm()
    onClose()
  }, [resetForm, onClose])

  const regenerateTitle = async () => {
    if (!description.trim()) return

    setIsRegeneratingTitle(true)
    try {
      const response = await fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      })
      const data = await response.json()
      if (data.title) {
        setTitle(data.title)
      }
    } catch (error) {
      console.error("Error regenerating title:", error)
    } finally {
      setIsRegeneratingTitle(false)
    }
  }

  const handleSave = useCallback(async () => {
    if (!description.trim()) return

    setIsSaving(true)
    try {
      await onSave({
        id: idea?.id,
        title: title || description.slice(0, 50),
        description: description.trim(),
        link: link || undefined,
        image: image || undefined,
        location: location || undefined,
        date: date || undefined,
        dateType,
        includeTime,
        bucketId: selectedBucketId,
        confidence,
      })
      resetForm()
    } catch (error) {
      // Parent shows toast; just log here
      console.error("Error saving idea:", error)
    } finally {
      setIsSaving(false)
    }
  }, [
    idea,
    title,
    description,
    link,
    image,
    location,
    date,
    dateType,
    includeTime,
    selectedBucketId,
    confidence,
    onSave,
    resetForm,
  ])

  const handleImageFile = useCallback((file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleRemoveLink = () => {
    setLink("")
    setAutoDetectedUrl(false)
  }

  const selectedBucket = buckets.find((b) => b.id === selectedBucketId) || buckets[0]

  const getConfidenceColor = () => {
    if (confidence >= 70) return "text-green-600"
    if (confidence >= 50) return "text-amber-600"
    return "text-red-600"
  }

  const getConfidenceBarColor = () => {
    if (confidence >= 70) return "bg-green-500"
    if (confidence >= 50) return "bg-amber-500"
    return "bg-red-500"
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

        {/* Full-screen view on mobile, modal on desktop */}
        <div
          className={cn(
            "relative w-full md:max-w-lg bg-background",
            "h-full md:h-auto md:max-h-[90vh] md:rounded-2xl",
            "flex flex-col",
            "animate-in slide-in-from-bottom duration-300 md:zoom-in-95 md:slide-in-from-bottom-0",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground font-medium"
            >
              Cancel
            </button>
            <h2 className="text-lg font-semibold">Edit Idea</h2>
            <button
              type="button"
              onClick={handleSave}
              disabled={!description.trim() || isSaving}
              className={cn(
                "font-medium",
                description.trim() && !isSaving ? "text-primary hover:text-primary/80" : "text-muted-foreground",
              )}
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Done"}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="edit-title" className="block text-sm font-medium">
                  Title
                </label>
                <button
                  type="button"
                  onClick={regenerateTitle}
                  disabled={!description.trim() || isRegeneratingTitle}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:text-muted-foreground"
                >
                  {isRegeneratingTitle ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Regenerate
                </button>
              </div>
              <input
                id="edit-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title for your idea"
                className={cn(
                  "w-full p-3 rounded-lg border border-input bg-background",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                  "font-semibold",
                )}
              />
            </div>

            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium mb-1.5">
                Description <span className="text-destructive">*</span>
              </label>
              <textarea
                ref={textareaRef}
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your idea in detail..."
                className={cn(
                  "w-full min-h-[120px] p-3 rounded-lg border border-input bg-background",
                  "placeholder:text-muted-foreground resize-none",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
                )}
              />
            </div>

            {/* Image section */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Image</label>
              {image ? (
                <div className="relative">
                  <img src={image || "/placeholder.svg"} alt="Idea" className="w-full h-40 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-input rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                  <span className="text-sm">Add image</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageFile(file)
                }}
              />
            </div>

            {/* Link section */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Link</label>
              {link ? (
                <div className="space-y-2">
                  <UrlPreview url={link} onRemove={handleRemoveLink} />
                  {autoDetectedUrl && (
                    <p className="text-xs text-muted-foreground">Link detected from your description</p>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add a location"
                  className="w-full pl-10 pr-8 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {location && (
                  <button
                    type="button"
                    onClick={() => setLocation("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Date</label>
              <div className="space-y-2">
                {/* Date type selector */}
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  {(["full", "month-year", "year"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setDateType(type)
                        setDate("")
                      }}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-xs rounded-md transition-colors",
                        dateType === type
                          ? "bg-background shadow-sm font-medium"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {type === "full" ? "Specific Date" : type === "month-year" ? "Month & Year" : "Year Only"}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  {dateType === "full" ? (
                    <input
                      type={includeTime ? "datetime-local" : "date"}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-10 pr-8 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : dateType === "month-year" ? (
                    <input
                      type="month"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-10 pr-8 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : (
                    <input
                      type="number"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      placeholder="2025"
                      min="2000"
                      max="2100"
                      className="w-full pl-10 pr-8 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  )}
                  {date && (
                    <button
                      type="button"
                      onClick={() => setDate("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {dateType === "full" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeTime}
                      onChange={(e) => {
                        setIncludeTime(e.target.checked)
                        setDate("")
                      }}
                      className="rounded border-input"
                    />
                    Include time
                  </label>
                )}
              </div>
            </div>

            {/* Bucket selector */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Bucket</label>
              <button
                type="button"
                onClick={() => setShowBucketSelector(true)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  "border-l-4",
                  bucketBorderColors[selectedBucket.color],
                  "hover:bg-accent/50",
                )}
              >
                <div className={cn("w-3 h-3 rounded-full shrink-0", bucketColors[selectedBucket.color])} />
                <span className="flex-1 text-left font-medium">{selectedBucket.title}</span>
                <span className="text-sm text-muted-foreground">Change</span>
              </button>
            </div>

            {/* Bucket Fit / Confidence */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Bucket Fit</label>
              <div className="p-3 rounded-lg border border-input space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    How well this idea aligns with the selected bucket
                  </span>
                  <span className={cn("font-semibold", getConfidenceColor())}>{confidence}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", getConfidenceBarColor())}
                    style={{ width: `${confidence}%` }}
                  />
                </div>

                {confidence < 70 && (
                  <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Low confidence - consider moving this idea to a different bucket
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bucket selector overlay */}
          {showBucketSelector && (
            <div className="absolute inset-0 bg-background md:rounded-2xl flex flex-col z-20">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Select Bucket</h3>
                <button
                  type="button"
                  onClick={() => setShowBucketSelector(false)}
                  className="p-2 -m-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {buckets.map((bucket) => (
                  <button
                    key={bucket.id}
                    type="button"
                    onClick={() => {
                      setSelectedBucketId(bucket.id)
                      setShowBucketSelector(false)
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                      selectedBucketId === bucket.id ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-full", bucketColors[bucket.color])} />
                    <span className="flex-1 text-left">{bucket.title}</span>
                    {selectedBucketId === bucket.id && <Check className="h-5 w-5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Discard changes dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
