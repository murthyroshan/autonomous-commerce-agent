'use client'

import { useState } from 'react'
import { useAgentStream } from '@/hooks/useAgentStream'
import { SearchBar } from '@/components/SearchBar'
import { StatusTicker } from '@/components/StatusTicker'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ProductGrid } from '@/components/ProductGrid'

export default function HomePage() {
  const [query, setQuery] = useState<string | null>(null)
  const { status, result, loading, streamError } = useAgentStream(query)

  // Merge backend pipeline error with SSE transport error
  const displayError = streamError ?? result?.error ?? null

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Hero / search section */}
      <section className="flex flex-col items-center justify-center px-4 pt-20 pb-12 text-center">
        <div className="mb-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
          ✦ Powered by AI · Real-time comparison
        </div>

        <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Find the{' '}
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Best Deal
          </span>
        </h1>

        <p className="mb-8 max-w-lg text-base text-muted-foreground">
          Describe what you&apos;re looking for. Our AI searches, compares, and recommends the best products for you — in real time.
        </p>

        <SearchBar onSearch={setQuery} loading={loading} />

        {/* Live status + error (below search bar) */}
        <div className="mt-4 flex w-full max-w-3xl flex-col gap-3">
          <StatusTicker status={status} loading={loading} />
          <ErrorBanner error={displayError} />
        </div>
      </section>

      {/* AI recommendation prose */}
      {result?.recommendation?.justification && (
        <section className="px-4 pb-6 max-w-4xl mx-auto w-full">
          <div className="rounded-xl border border-blue-200 bg-white/70 backdrop-blur-sm px-6 py-4 dark:border-blue-800 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
              AI Recommendation
            </p>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {result.recommendation.justification}
            </p>
          </div>
        </section>
      )}

      {/* Product results grid */}
      {result?.scored_products && result.scored_products.length > 0 && (
        <section className="flex-1 px-4 pb-16 max-w-7xl mx-auto w-full">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {result.scored_products.length} products compared
            </h2>
            <span className="text-xs text-muted-foreground">
              Sorted by AI score · {result.query}
            </span>
          </div>
          <ProductGrid products={result.scored_products} />
        </section>
      )}

      {/* Empty state when no search yet */}
      {!query && !loading && (
        <div className="flex flex-1 flex-col items-center justify-center pb-24 text-center px-4">
          <div className="text-5xl mb-4">🛒</div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Try &ldquo;gaming laptop under ₹80,000&rdquo; or &ldquo;best 4K TV under ₹60,000&rdquo;
          </p>
        </div>
      )}
    </main>
  )
}
