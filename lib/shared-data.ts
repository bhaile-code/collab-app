// Full color pool for bucket assignment - 12 distinct colors
export const COLOR_POOL = [
  "blue",
  "green",
  "orange",
  "purple",
  "pink",
  "teal",
  "amber",
  "rose",
  "indigo",
  "emerald",
  "cyan",
  "red",
] as const

export type BucketColor = (typeof COLOR_POOL)[number] | "gray"

// Bucket color scheme - consistent across all views
export const BUCKET_COLORS: Record<
  BucketColor,
  {
    border: string
    bg: string
    text: string
    pin: string
    ring: string
    solid: string
  }
> = {
  blue: {
    border: "border-l-blue-500",
    bg: "bg-blue-100",
    text: "text-blue-700",
    pin: "text-blue-500",
    ring: "ring-blue-500",
    solid: "bg-blue-500",
  },
  green: {
    border: "border-l-green-500",
    bg: "bg-green-100",
    text: "text-green-700",
    pin: "text-green-500",
    ring: "ring-green-500",
    solid: "bg-green-500",
  },
  orange: {
    border: "border-l-orange-500",
    bg: "bg-orange-100",
    text: "text-orange-700",
    pin: "text-orange-500",
    ring: "ring-orange-500",
    solid: "bg-orange-500",
  },
  purple: {
    border: "border-l-purple-500",
    bg: "bg-purple-100",
    text: "text-purple-700",
    pin: "text-purple-500",
    ring: "ring-purple-500",
    solid: "bg-purple-500",
  },
  pink: {
    border: "border-l-pink-500",
    bg: "bg-pink-100",
    text: "text-pink-700",
    pin: "text-pink-500",
    ring: "ring-pink-500",
    solid: "bg-pink-500",
  },
  teal: {
    border: "border-l-teal-500",
    bg: "bg-teal-100",
    text: "text-teal-700",
    pin: "text-teal-500",
    ring: "ring-teal-500",
    solid: "bg-teal-500",
  },
  amber: {
    border: "border-l-amber-500",
    bg: "bg-amber-100",
    text: "text-amber-700",
    pin: "text-amber-500",
    ring: "ring-amber-500",
    solid: "bg-amber-500",
  },
  rose: {
    border: "border-l-rose-500",
    bg: "bg-rose-100",
    text: "text-rose-700",
    pin: "text-rose-500",
    ring: "ring-rose-500",
    solid: "bg-rose-500",
  },
  indigo: {
    border: "border-l-indigo-500",
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    pin: "text-indigo-500",
    ring: "ring-indigo-500",
    solid: "bg-indigo-500",
  },
  emerald: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    pin: "text-emerald-500",
    ring: "ring-emerald-500",
    solid: "bg-emerald-500",
  },
  cyan: {
    border: "border-l-cyan-500",
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    pin: "text-cyan-500",
    ring: "ring-cyan-500",
    solid: "bg-cyan-500",
  },
  red: {
    border: "border-l-red-500",
    bg: "bg-red-100",
    text: "text-red-700",
    pin: "text-red-500",
    ring: "ring-red-500",
    solid: "bg-red-500",
  },
  gray: {
    border: "border-l-gray-400",
    bg: "bg-gray-100",
    text: "text-gray-700",
    pin: "text-gray-500",
    ring: "ring-gray-500",
    solid: "bg-gray-500",
  },
}

// Color assignment manager - tracks used colors and assigns new ones
export class BucketColorManager {
  private usedColors: Map<string, { color: BucketColor; usedAt: number }> = new Map()
  private colorOrder: BucketColor[] = [...COLOR_POOL]

  constructor(existingBuckets?: Array<{ id: string; color: BucketColor }>) {
    // Initialize with existing bucket colors
    if (existingBuckets) {
      existingBuckets.forEach((bucket, index) => {
        this.usedColors.set(bucket.id, { color: bucket.color, usedAt: index })
      })
    }
  }

  // Get next available color for a new bucket
  getNextColor(bucketId: string): BucketColor {
    // Check if this bucket already has a color
    const existing = this.usedColors.get(bucketId)
    if (existing) return existing.color

    // Get colors currently in use
    const usedColorSet = new Set(Array.from(this.usedColors.values()).map((v) => v.color))

    // Find first unused color from the pool
    const availableColor = this.colorOrder.find((color) => !usedColorSet.has(color))

    if (availableColor) {
      // Use available color
      this.usedColors.set(bucketId, { color: availableColor, usedAt: Date.now() })
      return availableColor
    }

    // Pool depleted - use LRU (Least Recently Used) color
    const lruEntry = Array.from(this.usedColors.entries()).sort((a, b) => a[1].usedAt - b[1].usedAt)[0]

    if (lruEntry) {
      const lruColor = lruEntry[1].color
      this.usedColors.set(bucketId, { color: lruColor, usedAt: Date.now() })
      return lruColor
    }

    // Fallback to first color in pool
    const fallbackColor = this.colorOrder[0]
    this.usedColors.set(bucketId, { color: fallbackColor, usedAt: Date.now() })
    return fallbackColor
  }

  // Release a color when a bucket is deleted
  releaseColor(bucketId: string): void {
    this.usedColors.delete(bucketId)
  }

  // Get all current assignments
  getAssignments(): Map<string, BucketColor> {
    const result = new Map<string, BucketColor>()
    this.usedColors.forEach((value, key) => {
      result.set(key, value.color)
    })
    return result
  }
}

// Singleton instance for app-wide color management
let colorManagerInstance: BucketColorManager | null = null

export function getColorManager(existingBuckets?: Array<{ id: string; color: BucketColor }>): BucketColorManager {
  if (!colorManagerInstance) {
    colorManagerInstance = new BucketColorManager(existingBuckets)
  }
  return colorManagerInstance
}

export function resetColorManager(): void {
  colorManagerInstance = null
}

// Helper to get bucket color classes
export function getBucketColorClasses(color: BucketColor) {
  return BUCKET_COLORS[color] || BUCKET_COLORS.gray
}
