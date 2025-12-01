interface ErrorViewProps {
  message: string
}

export function ErrorView({ message }: ErrorViewProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Error</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
