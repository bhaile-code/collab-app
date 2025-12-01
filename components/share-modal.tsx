"use client"

import { useState } from "react"
import { X, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  boardTitle?: string
  shareUrl: string
}

// QR Code component using a simple SVG pattern (placeholder for real QR generation)
function QRCode({ value, size = 200 }: { value: string; size?: number }) {
  // Generate a deterministic pattern based on the URL
  const cells: boolean[][] = []
  const gridSize = 21

  for (let y = 0; y < gridSize; y++) {
    cells[y] = []
    for (let x = 0; x < gridSize; x++) {
      // Create finder patterns (corners)
      const isFinderPattern =
        (x < 7 && y < 7) || // Top-left
        (x >= gridSize - 7 && y < 7) || // Top-right
        (x < 7 && y >= gridSize - 7) // Bottom-left

      if (isFinderPattern) {
        const inOuterBorder =
          x === 0 ||
          x === 6 ||
          y === 0 ||
          y === 6 ||
          x === gridSize - 7 ||
          x === gridSize - 1 ||
          y === gridSize - 7 ||
          y === gridSize - 1
        const inInnerSquare =
          (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
          (x >= gridSize - 5 && x <= gridSize - 3 && y >= 2 && y <= 4) ||
          (x >= 2 && x <= 4 && y >= gridSize - 5 && y <= gridSize - 3)
        cells[y][x] = inOuterBorder || inInnerSquare
      } else {
        // Generate pseudo-random pattern for data area
        const hash = (value.charCodeAt(x % value.length) + y * 31 + x * 17) % 100
        cells[y][x] = hash > 45
      }
    }
  }

  const cellSize = size / gridSize

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-lg"
      role="img"
      aria-label="QR code for sharing"
    >
      <rect width={size} height={size} fill="white" />
      {cells.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect key={`${x}-${y}`} x={x * cellSize} y={y * cellSize} width={cellSize} height={cellSize} fill="black" />
          ) : null,
        ),
      )}
    </svg>
  )
}

// iMessage icon component
function IMessageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 5.813 2 10.5c0 2.025.78 3.875 2.075 5.35-.35 1.875-1.3 3.55-1.325 3.6a.5.5 0 0 0 .45.75c2.325-.25 4.15-1.2 5.25-1.975.825.175 1.7.275 2.55.275 5.523 0 10-3.813 10-8.5S17.523 2 12 2z" />
    </svg>
  )
}

// WhatsApp icon component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

export function ShareModal({ isOpen, onClose, boardTitle = "Weekend Plans", shareUrl }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const url = shareUrl

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShareWhatsApp = () => {
    const text = `Join my planning board: ${boardTitle}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`
    window.open(whatsappUrl, "_blank")
  }

  const handleShareiMessage = () => {
    const text = `Join my planning board: ${boardTitle}`
    const smsUrl = `sms:?&body=${encodeURIComponent(text + "\n" + url)}`
    window.location.href = smsUrl
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className={cn(
          "relative z-10 w-full max-w-sm",
          "rounded-2xl bg-card p-6",
          "shadow-xl",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className={cn(
            "absolute right-4 top-4",
            "flex h-8 w-8 items-center justify-center rounded-full",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          )}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <h2 id="share-modal-title" className="mb-6 text-center text-xl font-semibold text-foreground">
          Invite your group
        </h2>

        {/* QR Code */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-xl border border-border bg-white p-3">
            <QRCode value={url} size={180} />
          </div>
        </div>

        {/* Copy link button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className={cn(
            "mb-4 flex w-full items-center justify-center gap-2",
            "min-h-12 rounded-xl",
            "border border-border bg-muted",
            "text-sm font-medium text-foreground",
            "transition-colors",
            "hover:bg-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            copied && "bg-green-50 border-green-200 text-green-700",
          )}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Link copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy link
            </>
          )}
        </button>

        {/* Share buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className={cn(
              "flex flex-1 items-center justify-center gap-2",
              "min-h-12 rounded-xl",
              "bg-[#25D366] text-white",
              "text-sm font-medium",
              "transition-all",
              "hover:bg-[#20BD5A] hover:scale-[1.02]",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2",
            )}
          >
            <WhatsAppIcon className="h-5 w-5" />
            WhatsApp
          </button>

          <button
            type="button"
            onClick={handleShareiMessage}
            className={cn(
              "flex flex-1 items-center justify-center gap-2",
              "min-h-12 rounded-xl",
              "bg-blue-500 text-white",
              "text-sm font-medium",
              "transition-all",
              "hover:bg-blue-600 hover:scale-[1.02]",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            )}
          >
            <IMessageIcon className="h-5 w-5" />
            iMessage
          </button>
        </div>
      </div>
    </div>
  )
}
