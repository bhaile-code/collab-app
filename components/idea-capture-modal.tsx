"use client"

import { useState, useRef, useCallback, type DragEvent, type ClipboardEvent, useEffect } from "react"
import {
  X,
  Link2,
  ImageIcon,
  MapPin,
  Calendar,
  ChevronDown,
  Archive,
  Lightbulb,
  Loader2,
  Check,
  Sparkles,
  Upload,
  FileIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UrlPreview, extractUrlFromText } from "./url-preview"
import { uploadToSignedUrl, type AttachmentMeta } from "@/lib/utils/file-upload"
import { getUploadUrl, updateIdea } from "@/lib/api/ideas"
import { supabase } from "@/lib/db/client"
import { toast } from "sonner"

interface Bucket {
  id: string
  title: string
  color: "blue" | "green" | "orange" | "purple" | "gray"
}

interface IdeaCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (idea: {
    title: string
    description: string // Added description (user's input)
    link?: string
    image?: string
    location?: string
    date?: string
    dateType?: "full" | "month-year" | "year"
    includeTime?: boolean
    bucketId?: string
  }) => Promise<{ id: string } | void> // Return created idea with at least id
  buckets?: Bucket[]
}

const bucketColors: { [key: string]: string } = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  gray: "bg-gray-500",
}

export function IdeaCaptureModal({ isOpen, onClose, onSubmit, buckets = [] }: IdeaCaptureModalProps) {
  const [description, setDescription] = useState("")
  const [generatedTitle, setGeneratedTitle] = useState("")
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [link, setLink] = useState("")
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoDetectedUrl, setAutoDetectedUrl] = useState(false)

  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [dateType, setDateType] = useState<"full" | "month-year" | "year">("full")
  const [includeTime, setIncludeTime] = useState(false)
  const [selectedBucketId, setSelectedBucketId] = useState<string | undefined>(undefined)
  const [showBucketSelector, setShowBucketSelector] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (!buckets.length) {
      // No buckets => no selection
      setSelectedBucketId(undefined)
      return
    }

    // If there was a selection but that bucket no longer exists, clear it
    const exists = selectedBucketId && buckets.some((b) => b.id === selectedBucketId)
    if (!exists) {
      setSelectedBucketId(undefined)
    }
  }, [buckets, selectedBucketId])

  useEffect(() => {
    if (!link) {
      const detectedUrl = extractUrlFromText(description)
      if (detectedUrl) {
        setLink(detectedUrl)
        setAutoDetectedUrl(true)
        setShowLinkInput(true)
      }
    }
  }, [description, link])

  const resetForm = useCallback(() => {
    setDescription("")
    setGeneratedTitle("")
    setIsGeneratingTitle(false)
    setLink("")
    setShowLinkInput(false)
    setImagePreview(null)
    setIsDragging(false)
    setIsSubmitting(false)
    setAutoDetectedUrl(false)
    setLocation("")
    setDate("")
    setDateType("full")
    setIncludeTime(false)
    setSelectedBucketId(undefined)
    setShowDetails(false)
    setSelectedFiles([])
    setUploadingFiles(false)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  const generateTitle = async (text: string): Promise<string> => {
    const localFallback = () => {
      const words = text.split(/\s+/).slice(0, 6).join(" ")
      return words.length > 50 ? words.slice(0, 50) + "..." : words || "New idea"
    }

    try {
      const response = await fetch("/api/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text }),
      })

      if (!response.ok) {
        console.error("Title generator error:", response.status)
        return localFallback()
      }

      const data = await response.json()
      if (typeof data.title === "string" && data.title.trim()) {
        return data.title.trim()
      }

      return localFallback()
    } catch (error) {
      console.error("Error calling /api/generate-title:", error)
      return localFallback()
    }
  }

  const handleFileUpload = async (files: File[], ideaId: string): Promise<AttachmentMeta[]> => {
    setUploadingFiles(true)
    const uploadedAttachments: AttachmentMeta[] = []

    try {
      for (const file of files) {
        // Step 1: Request signed URL from server
        const { uploadUrl, path } = await getUploadUrl(ideaId, {
          filename: file.name,
          contentType: file.type,
          size: file.size,
        })

        // Step 2: Upload directly to Supabase Storage
        await uploadToSignedUrl(uploadUrl, file)

        // Step 3: Get public URL for the uploaded file
        const publicUrl = supabase.storage.from("idea-attachments").getPublicUrl(path).data.publicUrl

        uploadedAttachments.push({
          url: publicUrl,
          filename: file.name,
          type: file.type,
          size: file.size,
        })
      }

      return uploadedAttachments
    } catch (error) {
      console.error("File upload failed:", error)
      toast.error("Failed to upload files. Please try again.")
      throw error
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleSubmit = async () => {
    if (!description.trim()) return

    setIsSubmitting(true)
    setIsGeneratingTitle(true)

    try {
      const title = await generateTitle(description.trim())
      setGeneratedTitle(title)
      setIsGeneratingTitle(false)

      // Step 1: Create the idea first
      const createdIdea = await onSubmit({
        title,
        description: description.trim(),
        link: link || undefined,
        image: imagePreview || undefined,
        location: location || undefined,
        date: date || undefined,
        dateType,
        includeTime,
        bucketId: selectedBucketId,
      })

      console.log("🔍 onSubmit returned:", createdIdea)
      console.log("🔍 Selected files count:", selectedFiles.length)
      console.log("🔍 Will upload files?", selectedFiles.length > 0 && !!createdIdea?.id)

      // Step 2: If files are selected and idea was created, upload them
      if (selectedFiles.length > 0 && createdIdea?.id) {
        console.log("✅ Starting file upload for idea:", createdIdea.id)
        setUploadingFiles(true)
        try {
          console.log("📤 Calling handleFileUpload with", selectedFiles.length, "files")
          const attachments = await handleFileUpload(selectedFiles, createdIdea.id)
          console.log("✅ handleFileUpload completed, attachments:", attachments.length)

          // Step 3: Update idea with attachments metadata
          if (attachments.length > 0) {
            const updatedIdea = await updateIdea(createdIdea.id, { attachments })
            console.log("Attachments saved:", updatedIdea)
          }
        } catch (uploadError) {
          console.error("File upload failed:", uploadError)
          toast.error("Files uploaded but failed to save. Please try editing the idea.")
        } finally {
          setUploadingFiles(false)
        }
      } else {
        console.warn("❌ Skipping file upload:", {
          hasFiles: selectedFiles.length > 0,
          hasIdeaId: !!createdIdea?.id,
          createdIdea
        })
      }

      // Only close on successful submit
      handleClose()
    } catch (error) {
      // Parent shows toast; just log here
      console.error("Error submitting idea:", error)
      toast.error("Failed to create idea. Please try again.")
    } finally {
      setIsSubmitting(false)
      setIsGeneratingTitle(false)
      setUploadingFiles(false)
    }
  }

  const handleImageFile = useCallback((file: File) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Also add to selectedFiles for upload
      setSelectedFiles((prev) => [...prev, file])
      console.log("📎 Added image to selectedFiles:", file.name)
    }
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleImageFile(files[0])
        return
      }

      const text = e.dataTransfer.getData("text/plain")
      if (text) {
        try {
          new URL(text)
          setLink(text)
          setShowLinkInput(true)
        } catch {
          setDescription((prev) => prev + (prev ? " " : "") + text)
        }
      }
    },
    [handleImageFile],
  )

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) handleImageFile(file)
          return
        }
      }

      const text = e.clipboardData.getData("text/plain")
      try {
        new URL(text)
        if (!link) {
          setLink(text)
          setShowLinkInput(true)
        }
      } catch {
        // Not a URL, let default paste behavior happen
      }
    },
    [handleImageFile, link],
  )

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleRemoveLink = () => {
    setLink("")
    setShowLinkInput(false)
    setAutoDetectedUrl(false)
  }

  const selectedBucket = buckets.find((b) => b.id === selectedBucketId) || null

  const hasBucketSelection = !!(selectedBucket && buckets.length)
  const hasDetails = !!(location || date || hasBucketSelection)
  const detailsSummary = [
    location && `📍 ${location}`,
    date && `📅 ${dateType === "year" ? date : dateType === "month-year" ? date : new Date(date).toLocaleDateString()}`,
    hasBucketSelection && `📁 ${selectedBucket?.title}`,
  ]
    .filter(Boolean)
    .join(" · ")

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl",
          "max-h-[90vh] flex flex-col",
          "animate-in slide-in-from-bottom duration-300 sm:zoom-in-95 sm:slide-in-from-bottom-0",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add Idea</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 -m-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-4 border-2 border-dashed border-primary rounded-xl bg-primary/5 flex items-center justify-center z-10">
              <p className="text-primary font-medium">Drop image or link here</p>
            </div>
          )}

          <div>
            <label htmlFor="idea-text" className="block text-sm font-medium mb-2">
              What&apos;s your idea? <span className="text-destructive">*</span>
            </label>
            <textarea
              ref={textareaRef}
              id="idea-text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onPaste={handlePaste}
              placeholder="Describe your idea in detail..."
              className={cn(
                "w-full min-h-[120px] p-3 rounded-lg border border-input bg-background",
                "placeholder:text-muted-foreground resize-none",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              )}
            />
            <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />A title will be auto-generated from your idea
            </p>
          </div>

          {/* Attachments section */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Add attachments (optional)</p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLinkInput(!showLinkInput)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
                  showLinkInput || link
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-input hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Link2 className="h-4 w-4" />
                Link
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm",
                  imagePreview
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-input hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <ImageIcon className="h-4 w-4" />
                Image
              </button>
            </div>

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

            {/* Link input and preview */}
            {(showLinkInput || link) && (
              <div className="space-y-2">
                {link ? (
                  <div className="space-y-2">
                    <UrlPreview url={link} onRemove={handleRemoveLink} />
                    {autoDetectedUrl && <p className="text-xs text-muted-foreground">Link detected from your text</p>}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 p-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLinkInput(false)}
                      className="p-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Image preview */}
            {imagePreview && (
              <div className="relative">
                <img
                  src={imagePreview || "/placeholder.svg"}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Collapsible details section */}
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Add details</span>
                {!showDetails && hasDetails && <span className="text-muted-foreground text-xs">{detailsSummary}</span>}
                {!showDetails && !hasDetails && (
                  <span className="text-muted-foreground text-xs">Place, Date, Bucket</span>
                )}
              </div>
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground transition-transform", showDetails && "rotate-180")}
              />
            </button>

            {showDetails && (
              <div className="p-3 pt-0 space-y-4 border-t">
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

                {/* File Attachments */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Attachments (optional)</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-accent/50 rounded-lg cursor-pointer hover:bg-accent transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">Choose files</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          setSelectedFiles((prev) => [...prev, ...files])
                        }}
                      />
                    </label>
                    <span className="text-xs text-muted-foreground">Images and PDFs up to 10MB</span>

                    {/* Selected Files Preview */}
                    {selectedFiles.length > 0 && (
                      <div className="space-y-1">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-accent/30 rounded"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {file.type.startsWith("image/") ? (
                                <ImageIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              ) : (
                                <FileIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              <span className="text-sm truncate">{file.name}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== index))}
                              className="text-muted-foreground hover:text-destructive flex-shrink-0 ml-2"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bucket selector (only when buckets exist) */}
                {buckets.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Bucket</label>
                    <button
                      type="button"
                      onClick={() => setShowBucketSelector(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-input hover:bg-accent/50 transition-colors"
                    >
                      <Archive className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2 flex-1">
                        {selectedBucket ? (
                          <>
                            <div className={cn("w-3 h-3 rounded-full", bucketColors[selectedBucket.color])} />
                            <span className="text-sm">{selectedBucket.title}</span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">No bucket selected</span>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-background">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!description.trim() || isSubmitting}
            className={cn(
              "w-full min-h-12 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
              description.trim() && !isSubmitting
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {uploadingFiles ? "Uploading files..." : isGeneratingTitle ? "Generating title..." : "Adding..."}
              </>
            ) : (
              <>
                <Lightbulb className="h-5 w-5" />
                Add Idea
              </>
            )}
          </button>
        </div>

        {/* Bucket selector modal */}
        {showBucketSelector && buckets.length > 0 && (
          <div className="absolute inset-0 bg-background rounded-2xl flex flex-col z-20">
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
  )
}
