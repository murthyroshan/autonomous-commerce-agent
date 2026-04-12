'use client'

interface StatusTickerProps {
  status: string
  loading: boolean
}

export function StatusTicker({ status, loading }: StatusTickerProps) {
  if (!status && !loading) return null

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {loading && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
        </span>
      )}
      <span className={`transition-opacity duration-300 ${status ? 'opacity-100' : 'opacity-0'}`}>
        {status}
      </span>
    </div>
  )
}
