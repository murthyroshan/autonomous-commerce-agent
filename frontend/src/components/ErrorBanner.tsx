'use client'

interface ErrorBannerProps {
  error: string | null
}

/**
 * Determines whether the message is informational (blue) vs an error (amber).
 * "Limited results" / "Fewer products" messages are info, not warnings.
 */
function isInfoMessage(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes('limited results') ||
    lower.includes('fewer products') ||
    lower.includes('showing') // e.g. "showing 2 product(s)"
  )
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null

  const info = isInfoMessage(error)

  return (
    <div
      role={info ? 'status' : 'alert'}
      className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-sm"
      style={
        info
          ? {
              background: 'rgba(14,116,144,0.12)',
              border: '1px solid rgba(14,116,144,0.4)',
              color: '#67e8f9',
            }
          : {
              background: 'rgba(120,53,15,0.2)',
              border: '1px solid rgba(146,64,14,0.5)',
              color: '#fbbf24',
            }
      }
    >
      <span className="mt-0.5 shrink-0 text-base leading-none">
        {info ? 'ℹ' : '⚠'}
      </span>
      <p className="font-medium">{error}</p>
    </div>
  )
}
