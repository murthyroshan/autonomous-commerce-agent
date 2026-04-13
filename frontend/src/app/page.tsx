'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { SearchOrb } from '@/components/agent/SearchOrb'
import { AgentTimeline } from '@/components/agent/AgentTimeline'
import { useAgentStream } from '@/hooks/useAgentStream'
import { useAppStore } from '@/stores/appStore'
import { colors, transitions } from '@/design-system/tokens'

export default function HomePage() {
  const { search } = useAgentStream()
  const { agentState, result, error, timelineEvents } = useAppStore()

  const handleSearch = (query: string) => {
    void search(query)
  }

  return (
    <main className="min-h-screen flex flex-col noise scanlines">
      <nav
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b px-6 py-4 backdrop-blur-xl"
        style={{
          borderColor: colors.border.subtle,
          background: colors.bg.overlay,
        }}
      >
        <span
          className="font-display text-[18px] font-[600] tracking-[-0.02em]"
          style={{ color: colors.text.primary }}
        >
          Kartiq
        </span>
        <div className="flex items-center gap-6">
          <Link
            href="/history"
            className="text-[13px] transition-colors"
            style={{ color: colors.text.secondary }}
          >
            History
          </Link>
          <Link
            href="/watchlist"
            className="text-[13px] transition-colors"
            style={{ color: colors.text.secondary }}
          >
            Watchlist
          </Link>
          <Link
            href="/landing"
            className="text-[13px] transition-colors"
            style={{ color: colors.text.secondary }}
          >
            About
          </Link>
        </div>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-16 gap-12">
        <AnimatePresence>
          {agentState === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(2px)' }}
              transition={transitions.spring}
              className="text-center space-y-3"
            >
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em]"
                style={{
                  borderColor: colors.border.default,
                  background: 'rgba(255,255,255,0.03)',
                  color: colors.text.secondary,
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: colors.accent.cyan }}
                />
                Powered by Groq · Serper · Algorand
              </div>
              <h1
                className="font-display text-[52px] font-[600] leading-[1.1] tracking-[-0.04em]"
                style={{ color: colors.text.primary }}
              >
                Your AI that shops
                <br />
                <span style={{ color: colors.accent.amber }}>smarter than you.</span>
              </h1>
              <p
                className="mx-auto max-w-md text-[16px] leading-relaxed tracking-[-0.01em]"
                style={{ color: colors.text.secondary }}
              >
                Describe what you want. The agent searches, compares, scores, and
                decides in seconds.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full max-w-2xl">
          <SearchOrb onSearch={handleSearch} />
        </div>

        <AnimatePresence>{timelineEvents.length > 0 && <AgentTimeline />}</AnimatePresence>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={transitions.spring}
              className="w-full max-w-6xl"
              id="results"
            >
              <p
                className="text-center font-mono text-sm"
                style={{ color: colors.text.secondary }}
              >
                {result.scored_products.length} products found. ProductGrid coming in
                Part 3.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={transitions.spring}
              className="w-full max-w-2xl rounded-xl border px-4 py-3 text-center font-mono text-[13px]"
              style={{
                background: 'rgba(255,77,77,0.08)',
                borderColor: 'rgba(255,77,77,0.2)',
                color: colors.accent.red,
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <footer
        className="flex items-center justify-between border-t px-6 py-6 font-mono text-[12px]"
        style={{
          borderColor: colors.border.subtle,
          color: colors.text.muted,
        }}
      >
        <span>Kartiq © 2025</span>
        <div className="flex gap-6">
          <Link href="/history" className="transition-colors hover:text-[#888884]">
            History
          </Link>
          <Link href="/watchlist" className="transition-colors hover:text-[#888884]">
            Watchlist
          </Link>
          <a
            href="https://github.com/yourusername/kartiq"
            target="_blank"
            className="transition-colors hover:text-[#888884]"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>
    </main>
  )
}
