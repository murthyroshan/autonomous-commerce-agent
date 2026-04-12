'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAgentStream } from '@/hooks/useAgentStream'
import { ChatFlow } from '@/components/ChatFlow'
import { StatusTicker } from '@/components/StatusTicker'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ProductGrid } from '@/components/ProductGrid'

export default function HomePage() {
  const [query, setQuery] = useState<string | null>(null)
  const { status, result, loading, streamError } = useAgentStream(query)

  // Merge backend pipeline error with SSE transport error.
  // Don't surface "Mock mode — MOCK_ONLY=true" as a user-visible error.
  const rawError = streamError ?? result?.error ?? null
  const displayError =
    rawError && !rawError.toLowerCase().includes('mock mode') ? rawError : null

  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#0a0a0a' }}>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="gradient-bg flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        {/* Pill badge */}
        <div
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
          style={{
            borderColor: 'rgba(124,58,237,0.4)',
            background: 'rgba(124,58,237,0.1)',
            color: '#a78bfa',
          }}
        >
          <span style={{ color: '#7c3aed' }}>✦</span>
          Powered by Groq + Serper
        </div>

        {/* Heading */}
        <h1
          className="mb-3 text-5xl font-extrabold tracking-tight sm:text-6xl"
          style={{ color: '#f5f5f5', letterSpacing: '-0.03em' }}
        >
          Find the best product.
        </h1>

        {/* Subheading */}
        <p className="mb-10 max-w-md text-base" style={{ color: '#71717a' }}>
          Describe what you want. The agent does the rest.
        </p>

        {/* Chat flow for search & clarification */}
        <ChatFlow onSearch={setQuery} disabled={loading} />

        {/* Status + error */}
        <div className="mt-5 flex w-full max-w-2xl flex-col items-center gap-3">
          <StatusTicker status={status} loading={loading} />
          <ErrorBanner error={displayError} />
        </div>
      </section>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {result?.scored_products && result.scored_products.length > 0 && (
        <section className="flex-1 px-4 pb-20 pt-10 max-w-7xl mx-auto w-full">
          <ProductGrid
            products={result.scored_products}
            recommendation={result.recommendation}
          />
        </section>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!query && !loading && (
        <div className="flex flex-1 flex-col items-center justify-center pb-32 text-center px-4">
          <div
            className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
            style={{
              background: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(124,58,237,0.2)',
            }}
          >
            🛍️
          </div>
          <p className="text-sm mb-1" style={{ color: '#52525b' }}>
            Try searching for something like:
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {[
              'gaming laptop under ₹80,000',
              'wireless earbuds under ₹5,000',
              'smartwatch under ₹10,000',
              '4K TV under ₹40,000',
            ].map((ex) => (
              <button
                key={ex}
                onClick={() => setQuery(ex)}
                className="rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer"
                style={{
                  borderColor: '#222',
                  color: '#71717a',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#7c3aed'
                  e.currentTarget.style.color = '#a78bfa'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#222'
                  e.currentTarget.style.color = '#71717a'
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="py-8 text-center text-xs flex flex-col items-center gap-2" style={{ color: '#3f3f46' }}>
        <div className="flex items-center gap-4">
          <Link
            href="/history"
            className="transition-colors"
            style={{ color: '#52525b' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
          >
            History →
          </Link>
          <span style={{ color: '#2a2a2a' }}>·</span>
          <Link
            href="/history#watchlist"
            className="transition-colors"
            style={{ color: '#52525b' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
          >
            Watchlist →
          </Link>
        </div>
        <span>Kartiq · Built with FastAPI, Groq, Serper &amp; Algorand</span>
      </footer>
    </div>
  )
}
