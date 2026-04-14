'use client'

import { useState } from 'react'
import { useAgentStream } from '@/hooks/useAgentStream'
import { ChatFlow } from '@/components/ChatFlow'
import { StatusTicker } from '@/components/StatusTicker'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ProductGrid } from '@/components/ProductGrid'
import { motion } from 'framer-motion'
import { WarpBackground } from '@/components/WarpBackground'

export default function HomePage() {
  const [query, setQuery] = useState<string | null>(null)
  const { status, result, loading, streamError } = useAgentStream(query)

  // Merge backend pipeline error with SSE transport error.
  // Don't surface "Mock mode — MOCK_ONLY=true" as a user-visible error.
  const rawError = streamError ?? result?.error ?? null
  const displayError =
    rawError && !rawError.toLowerCase().includes('mock mode') ? rawError : null

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-white overflow-x-hidden pt-10">
      <section className="relative flex flex-col items-center justify-center px-4 pt-32 pb-4 text-center z-10">
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
        <motion.h1
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-3 text-5xl font-black tracking-tight sm:text-7xl text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40"
        >
          Find the best product.
        </motion.h1>

        {/* Subheading */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 max-w-md text-lg font-medium text-zinc-400"
        >
          Describe what you want. The neural agent does the rest.
        </motion.p>

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
        <div className="flex flex-col items-center justify-start mt-2 pb-32 text-center px-4">
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
            ].map((ex, i) => (
              <motion.button
                key={ex}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                whileHover={{ scale: 1.05, borderColor: 'rgba(139, 92, 246, 0.5)', backgroundColor: 'rgba(139, 92, 246, 0.1)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setQuery(ex)}
                className="group relative overflow-hidden rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer"
              >
                {/* sweeping highlight */}
                <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[150%]" />
                <span className="relative z-10">{ex}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="py-8 text-center text-xs" style={{ color: '#3f3f46' }}>
        <span>Kartiq · Built with FastAPI, Groq, Serper &amp; Algorand</span>
      </footer>
    </div>
  )
}




