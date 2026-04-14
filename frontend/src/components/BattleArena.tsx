'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ScoredProduct } from '@/hooks/useAgentStream'

interface BattleArenaProps {
  contenders: ScoredProduct[]
  battleReport: string | null
  winner: ScoredProduct | null
}

function sourceBadgeColor(source: string): string {
  const s = source.toLowerCase()
  if (s.includes('amazon')) return '#fb923c'
  if (s.includes('flipkart')) return '#60a5fa'
  return '#a1a1aa'
}

function useTypewriter(text: string | null, speed = 18): string {
  const [displayed, setDisplayed] = useState('')
  const indexRef = useRef(0)
  const textRef = useRef(text)

  useEffect(() => {
    if (!text) { setDisplayed(''); return }
    if (textRef.current !== text) {
      textRef.current = text
      indexRef.current = 0
      setDisplayed('')
    }
    const interval = setInterval(() => {
      if (indexRef.current < (text?.length ?? 0)) {
        setDisplayed(text.slice(0, indexRef.current + 1))
        indexRef.current++
      } else {
        clearInterval(interval)
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed])

  return displayed
}

function ContenderCard({
  product,
  side,
  isWinner,
  isRevealed,
}: {
  product: ScoredProduct
  side: 'A' | 'B'
  isWinner: boolean
  isRevealed: boolean
}) {
  const color = sourceBadgeColor(product.source)
  const drop = product.price_drop_pct
  const hist = product.historical_30d_avg

  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'A' ? -60 : 60 }}
      animate={{
        opacity: isRevealed ? (isWinner ? 1 : 0.45) : 1,
        x: 0,
        scale: isRevealed ? (isWinner ? 1.03 : 0.97) : 1,
      }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col gap-3 rounded-2xl p-5 flex-1 min-w-0"
      style={{
        background: isRevealed && isWinner
          ? 'rgba(109,40,217,0.12)'
          : 'rgba(255,255,255,0.03)',
        border: isRevealed && isWinner
          ? '1px solid rgba(139,92,246,0.5)'
          : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Winner crown */}
      <AnimatePresence>
        {isRevealed && isWinner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -top-3 left-1/2 -translate-x-1/2"
          >
            <span
              className="rounded-full px-3 py-0.5 text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff' }}
            >
              ⚡ WINNER
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Source badge */}
      <span className="text-xs font-medium" style={{ color }}>{product.source}</span>

      {/* Title */}
      <h3 className="text-base font-bold leading-snug text-white line-clamp-3">
        {product.title}
      </h3>

      {/* Price */}
      <div>
        <p className="text-2xl font-black" style={{ color: '#f5f5f5' }}>
          ₹{product.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
        {drop != null && drop > 0 && hist != null && (
          <p className="text-xs mt-0.5" style={{ color: '#4ade80' }}>
            ↓{drop}% from 30-day avg ₹{hist.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        )}
      </div>

      {/* Rating */}
      {product.rating > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-amber-400 text-sm">
            {'★'.repeat(Math.min(5, Math.round(product.rating)))}
          </span>
          <span className="text-xs" style={{ color: '#71717a' }}>
            {product.rating.toFixed(1)} ({product.review_count.toLocaleString()} reviews)
          </span>
        </div>
      )}

      {/* Score bar */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs" style={{ color: '#3f3f46' }}>AI Score</span>
          <span className="text-xs font-semibold" style={{ color: isWinner ? '#a78bfa' : '#52525b' }}>
            {Math.round((product.score ?? 0) * 100)}%
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: '#1a1a1a' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.round((product.score ?? 0) * 100)}%` }}
            transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: isWinner ? 'linear-gradient(90deg, #7c3aed, #a78bfa)' : '#333' }}
          />
        </div>
      </div>

      {/* Verdict pill & Link */}
      <div className="flex items-center justify-between mt-1">
        {product.verdict ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{
              background: `${product.verdict_colour ?? '#a78bfa'}18`,
              color: product.verdict_colour ?? '#a78bfa',
              border: `1px solid ${product.verdict_colour ?? '#a78bfa'}40`,
            }}
          >
            {product.verdict}
          </span>
        ) : <span />}
        
        <a
          href={product.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold hover:underline"
          style={{ color }}
          onClick={(e) => e.stopPropagation()}
        >
          View on {product.source} ↗
        </a>
      </div>
    </motion.div>
  )
}

export function BattleArena({ contenders, battleReport, winner }: BattleArenaProps) {
  const [reportReady, setReportReady] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const typedReport = useTypewriter(reportReady ? battleReport : null, 16)

  const a = contenders[0]
  const b = contenders[1]
  const winnerTitle = winner?.title ?? null

  // Start typewriter after a short delay, then reveal winner when done
  useEffect(() => {
    const t1 = setTimeout(() => setReportReady(true), 600)
    return () => clearTimeout(t1)
  }, [])

  useEffect(() => {
    if (!battleReport || !reportReady) return
    // Reveal winner ~200ms after typing finishes
    const charCount = battleReport.length
    const delay = charCount * 16 + 400
    const t = setTimeout(() => setRevealed(true), delay)
    return () => clearTimeout(t)
  }, [battleReport, reportReady])

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full overflow-hidden rounded-3xl mb-10"
      style={{
        background: 'rgba(0,0,0,0.6)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Top glow line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.8) 50%, transparent 100%)' }}
      />

      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center gap-2 border-b border-white/5">
        <span className="text-lg">⚔️</span>
        <span className="text-sm font-bold tracking-wider uppercase" style={{ color: '#a78bfa' }}>
          Battle Arena
        </span>
        <span className="ml-auto text-xs" style={{ color: '#3f3f46' }}>AI Referee</span>
      </div>

      {/* Contender cards + VS */}
      <div className="flex items-stretch gap-4 p-5">
        <ContenderCard product={a} side="A" isWinner={revealed && a.title === winnerTitle} isRevealed={revealed} />

        {/* VS badge */}
        <div className="flex flex-col items-center justify-center shrink-0 gap-1">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="rounded-full px-3 py-1.5 text-sm font-black"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(109,40,217,0.1))',
              border: '1px solid rgba(124,58,237,0.4)',
              color: '#c4b5fd',
            }}
          >
            VS
          </motion.div>
        </div>

        <ContenderCard product={b} side="B" isWinner={revealed && b.title === winnerTitle} isRevealed={revealed} />
      </div>

      {/* Referee's Tale of the Tape */}
      {battleReport && (
        <div
          className="mx-5 mb-5 rounded-2xl p-4"
          style={{ background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.15)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: '#7c3aed' }}>
            🎙 Referee&apos;s Verdict
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>
            {typedReport}
            {typedReport.length < battleReport.length && (
              <span className="inline-block w-0.5 h-4 ml-0.5 bg-violet-400 animate-pulse align-middle" />
            )}
          </p>
        </div>
      )}
    </motion.div>
  )
}
