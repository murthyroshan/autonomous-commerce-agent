'use client'

interface ErrorBannerProps {
  error: string | null
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300"
    >
      <span className="mt-0.5 text-lg leading-none">⚠️</span>
      <p className="text-sm font-medium">
        Results may be incomplete — {error}
      </p>
    </div>
  )
}
