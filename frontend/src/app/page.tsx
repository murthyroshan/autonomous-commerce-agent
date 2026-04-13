'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAgentStream } from '@/hooks/useAgentStream'
import { ChatFlow } from '@/components/ChatFlow'
import { StatusTicker } from '@/components/StatusTicker'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ProductGrid } from '@/components/ProductGrid'
import { usePeraWallet } from '@/hooks/usePeraWallet'

export default function HomePage() {
  const [query, setQuery] = useState<string | null>(null)
  const { status, result, loading, streamError } = useAgentStream(query)
  const { address, connected, connect, disconnect } = usePeraWallet()

  const rawError = streamError ?? result?.error ?? null
  const displayError =
    rawError && !rawError.toLowerCase().includes('mock mode') ? rawError : null

  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#0a0a09' }}>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-end px-4 pt-4">
        {!connected ? (
          <button
            onClick={() => {
              void connect()
            }}
            className="rounded-md border px-3 py-1.5 text-xs transition-colors"
            style={{ borderColor: '#333', color: '#a1a1aa', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#e8a045'
              e.currentTarget.style.color = '#f0bc75'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333'
              e.currentTarget.style.color = '#a1a1aa'
            }}
          >
            Connect Pera
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors"
            style={{ borderColor: '#333', color: '#a1a1aa', background: 'transparent' }}
            title="Disconnect wallet"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: '#22c55e' }} />
            {address ? `${address.slice(0, 6)}...` : 'Connected'}
          </button>
        )}
      </header>

      <section className="flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        <div
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
          style={{
            borderColor: 'rgba(232,160,69,0.35)',
            background: 'rgba(232,160,69,0.12)',
            color: '#e8a045',
          }}
        >
          <span style={{ color: '#e8a045' }}>âœ¦</span>
          Powered by Groq + Serper
        </div>

        <h1
          className="mb-3 text-5xl font-extrabold tracking-tight sm:text-6xl"
          style={{ color: '#f5f5f5', letterSpacing: '-0.03em' }}
        >
          Find the best product.
        </h1>

        <p className="mb-10 max-w-md text-base" style={{ color: '#71717a' }}>
          Describe what you want. The agent does the rest.
        </p>

        <ChatFlow onSearch={setQuery} disabled={loading} />

        <div className="mt-5 flex w-full max-w-2xl flex-col items-center gap-3">
          <StatusTicker status={status} loading={loading} />
          <ErrorBanner error={displayError} />
        </div>
      </section>

      {result?.scored_products && result.scored_products.length > 0 && (
        <section className="flex-1 px-4 pb-20 pt-10 max-w-7xl mx-auto w-full">
          <ProductGrid
            products={result.scored_products}
            recommendation={result.recommendation}
          />
        </section>
      )}

      {!query && !loading && (
        <div className="flex flex-1 flex-col items-center justify-center pb-32 text-center px-4">
          <div
            className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
            style={{
              background: 'rgba(232,160,69,0.08)',
              border: '1px solid rgba(232,160,69,0.2)',
            }}
          >
            ðŸ›ï¸
          </div>
          <p className="text-sm mb-1" style={{ color: '#52525b' }}>
            Try searching for something like:
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {[
              'gaming laptop under â‚¹80,000',
              'wireless earbuds under â‚¹5,000',
              'smartwatch under â‚¹10,000',
              '4K TV under â‚¹40,000',
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
                  e.currentTarget.style.borderColor = '#e8a045'
                  e.currentTarget.style.color = '#e8a045'
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

      <footer className="py-8 text-center text-xs flex flex-col items-center gap-2" style={{ color: '#3f3f46' }}>
        <div className="flex items-center gap-4">
          <Link
            href="/history"
            className="transition-colors"
            style={{ color: '#52525b' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e8a045')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#52525b')}
          >
            History â†’
          </Link>
          <span style={{ color: '#2a2a2a' }}>Â·</span>
          <Link
            href="/history#watchlist"
            className="transition-colors"
            style={{ color: '#52525b' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e8a045')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#52525b')}
          >
            Watchlist â†’
          </Link>
        </div>
        <span>Kartiq Â· Built with FastAPI, Groq, Serper &amp; Algorand</span>
      </footer>
    </div>
  )
}

