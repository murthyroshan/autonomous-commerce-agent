'use client'

interface StatusTickerProps {
  status: string
  loading: boolean
}

export function StatusTicker({ status, loading }: StatusTickerProps) {
  if (!status && !loading) return null

  return (
    <div
      className="flex items-center gap-3 text-sm transition-opacity duration-300"
      style={{ opacity: loading || status ? 1 : 0, color: '#71717a' }}
    >
      {/* Three animated dots */}
      {loading && (
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="animate-pulse-dot inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: '#e8a045',
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </span>
      )}

      {/* Message */}
      <span
        className="transition-opacity duration-300"
        style={{ opacity: status ? 1 : 0 }}
      >
        {status || 'Initialising agentâ€¦'}
      </span>
    </div>
  )
}

