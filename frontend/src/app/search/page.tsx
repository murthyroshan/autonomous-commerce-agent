'use client'

import { useState, useEffect } from 'react'
import { useAgentStream, type BudgetMiss } from '@/hooks/useAgentStream'
import { ChatFlow } from '@/components/ChatFlow'
import { StatusTicker } from '@/components/StatusTicker'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ProductGrid } from '@/components/ProductGrid'
import { motion, AnimatePresence } from 'framer-motion'
import { WarpBackground } from '@/components/WarpBackground'

export default function HomePage() {
  const [query, setQuery] = useState<string | null>(null)

  useEffect(() => {
    // Read the query parameter passed from the landing page
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setQuery(q);
    }
  }, []);

  const { status, result, loading, streamError } = useAgentStream(query)
  const [dismissedBudgetMiss, setDismissedBudgetMiss] = useState(false)

  // Reset dismissed state whenever a new query fires
  useEffect(() => { setDismissedBudgetMiss(false) }, [query])

  const budgetMiss: BudgetMiss | null =
    !dismissedBudgetMiss && result?.budget_miss ? result.budget_miss : null

  // Merge backend pipeline error with SSE transport error.
  // Don't surface "Mock mode — MOCK_ONLY=true" or budget_miss messages as top-level errors.
  const rawError = streamError ?? result?.error ?? null
  const displayError =
    rawError &&
    !rawError.toLowerCase().includes('mock mode') &&
    !budgetMiss  // budget_miss has its own UI; suppress the duplicate error banner
      ? rawError
      : null

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-white pt-10">
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

      {/* ── Budget Miss Nudge ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {budgetMiss && !loading && (
          <motion.section
            key="budget-miss"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="flex justify-center px-4 pb-4 pt-2"
          >
            <div
              className="relative w-full max-w-xl overflow-hidden rounded-2xl p-5"
              style={{
                background: 'rgba(251,146,60,0.05)',
                border: '1px solid rgba(251,146,60,0.25)',
              }}
            >
              {/* Glow strip */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(251,146,60,0.6), transparent)' }}
              />

              <div className="mb-3 flex items-start gap-3">
                <span className="text-2xl leading-none" aria-hidden>💸</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5" style={{ color: '#fb923c' }}>
                    Nothing in your budget
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
                    {budgetMiss.message}
                  </p>
                </div>
              </div>

              {/* Closest product preview */}
              <div
                className="mb-4 flex items-center justify-between rounded-xl px-3 py-2.5 gap-2"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-xs line-clamp-1 font-medium" style={{ color: '#d4d4d8' }}>
                  {budgetMiss.product.title}
                </span>
                <span className="shrink-0 text-sm font-bold" style={{ color: '#fb923c' }}>
                  ₹{budgetMiss.product.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Overage chip */}
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}
                >
                  +₹{budgetMiss.overage.toLocaleString('en-IN', { maximumFractionDigits: 0 })} over budget
                </span>
                <span className="text-xs" style={{ color: '#52525b' }}>
                  ({budgetMiss.overage_pct}% stretch)
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setQuery(budgetMiss.product.title)}
                  className="flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition-opacity hover:opacity-90"
                  style={{
                    background: 'linear-gradient(135deg, #fb923c, #ea580c)',
                    color: '#fff',
                  }}
                >
                  ⚡ Worth it — show me
                </motion.button>
                <button
                  onClick={() => setDismissedBudgetMiss(true)}
                  className="rounded-xl px-3 py-2.5 text-xs font-medium transition-colors"
                  style={{ background: 'rgba(39,39,42,0.6)', color: '#71717a', border: '1px solid #2a2a2a' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#a1a1aa')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#71717a')}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

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
        <span>KartIQ · Built with FastAPI, Groq, Serper &amp; Algorand</span>
      </footer>
    </div>
  )
}




