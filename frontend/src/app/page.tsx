'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { SearchOrb } from '@/components/agent/SearchOrb'
import { AgentTimeline } from '@/components/agent/AgentTimeline'
import { useAgentStream } from '@/hooks/useAgentStream'
import { useAppStore } from '@/stores/appStore'
import Link from 'next/link'

export default function HomePage() {
  const { search } = useAgentStream()
  const { agentState, result, error, timelineEvents } = useAppStore()

  const handleSearch = (query: string) => {
    void search(query)
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 border-b border-[rgba(255,255,255,0.04)] bg-[rgba(10,10,9,0.85)] backdrop-blur-xl"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          width: '100vw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem',
        }}
      >
        <span className="font-display text-[18px] font-[600] tracking-[-0.02em] text-[#f2f2f0]">
          Kartiq
        </span>
        <div
          className="flex items-center gap-8"
          style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}
        >
          <Link
            href="/history"
            className="inline-block text-[13px] text-[#888884] hover:text-[#f2f2f0] transition-colors duration-150"
          >
            History
          </Link>
          <Link
            href="/watchlist"
            className="inline-block text-[13px] text-[#888884] hover:text-[#f2f2f0] transition-colors duration-150"
          >
            Watchlist
          </Link>
          <Link
            href="/landing"
            className="inline-block text-[13px] text-[#888884] hover:text-[#f2f2f0] transition-colors duration-150"
          >
            About
          </Link>
        </div>
      </nav>

      {/* Hero section - takes full viewport, centers content */}
      <section
        className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-16 gap-10 min-h-screen"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Heading - only shown when idle */}
        <AnimatePresence>
          {agentState === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="text-center space-y-4 max-w-2xl"
            >
              <div
                className="
                inline-flex items-center gap-2 px-3 py-1.5
                rounded-full border border-[rgba(255,255,255,0.08)]
                bg-[rgba(255,255,255,0.03)]
                font-mono text-[11px] uppercase tracking-[0.08em]
                text-[#888884] mb-2
              "
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#00d4aa]
                                  animate-pulse inline-block"
                />
                Powered by Groq · Serper · Algorand
              </div>
              <h1
                className="
                font-display text-[52px] font-[600]
                tracking-[-0.04em] leading-[1.1]
                text-[#f2f2f0]
              "
              >
                Your AI that shops
                <br />
                <span className="text-[#e8a045]">smarter than you.</span>
              </h1>
              <p
                className="
                text-[16px] text-[#888884] tracking-[-0.01em]
                leading-relaxed
              "
              >
                Describe what you want. The agent searches, compares, scores, and decides in seconds.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orb + Search - always visible, centered */}
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          <SearchOrb onSearch={handleSearch} />
        </div>

        {/* Timeline */}
        <AnimatePresence>{timelineEvents.length > 0 && <AgentTimeline />}</AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-6xl"
            >
              <p className="text-[#888884] text-center font-mono text-sm">
                {result.scored_products?.length ?? 0} products found.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="
                w-full max-w-2xl px-4 py-3 rounded-xl
                bg-[rgba(255,77,77,0.08)]
                border border-[rgba(255,77,77,0.2)]
                text-[#ff4d4d] text-[13px] font-mono text-center
              "
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer */}
      <footer
        className="
        px-8 py-5
        border-t border-[rgba(255,255,255,0.04)]
        flex items-center justify-between
        font-mono text-[11px] text-[#333330]
      "
      >
        <span>Kartiq © 2025</span>
        <span className="text-[#444440]">Autonomous commerce assistant</span>
      </footer>
    </main>
  )
}