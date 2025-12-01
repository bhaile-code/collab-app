export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mb-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  )
}
