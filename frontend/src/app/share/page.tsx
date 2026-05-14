'use client'

import { useEffect, useRef, useState } from 'react'
import { decodeShareData } from '@/lib/share'
import Link from 'next/link'
import { motion } from 'framer-motion'

type ShareState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; data: ReturnType<typeof decodeShareData> }

function sourceBadge(source: string) {
  const s = source.toLowerCase()
  if (s.includes('amazon')) return { bg: 'rgba(255,153,0,0.12)', color: '#ff9900', border: 'rgba(255,153,0,0.25)' }
  if (s.includes('flipkart')) return { bg: 'rgba(39,116,201,0.12)', color: '#2774c9', border: 'rgba(39,116,201,0.25)' }
  return { bg: 'rgba(255,255,255,0.06)', color: '#a1a1aa', border: 'rgba(255,255,255,0.1)' }
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < full ? '#fbbf24' : i === full && half ? 'url(#half)' : 'none'} stroke="#fbbf24" strokeWidth="2">
          <defs>
            <linearGradient id="half"><stop offset="50%" stopColor="#fbbf24" /><stop offset="50%" stopColor="transparent" /></linearGradient>
          </defs>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
      <span className="ml-1 text-[11px] text-zinc-400">{rating.toFixed(1)}</span>
    </span>
  )
}

// Circular score arc
function ScoreArc({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dash = (score / 100) * circumference
  const color = score >= 75 ? '#00d4aa' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 88 88">
        {/* Track */}
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        {/* Arc */}
        <motion.circle
          cx="44" cy="44" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - dash }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="relative text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 300 }}
          className="text-[22px] font-black leading-none"
          style={{ color }}
        >
          {score}
        </motion.div>
        <div className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">score</div>
      </div>
    </div>
  )
}

export default function SharePage() {
  const [state, setState] = useState<ShareState>({ status: 'loading' })
  const locked = useRef(false)

  useEffect(() => {
    if (locked.current) return
    locked.current = true
    try {
      const params = new URLSearchParams(window.location.search)
      const encoded = params.get('d')
      if (!encoded) { setState({ status: 'error' }); return }
      const data = decodeShareData(encoded)
      if (!data || !data.winner) { setState({ status: 'error' }); return }
      setState({ status: 'ok', data })
    } catch { setState({ status: 'error' }) }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808]">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="font-mono text-[13px] text-zinc-600"
        >
          Loading recommendation...
        </motion.div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808]">
        <div className="text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="font-mono text-[13px] text-zinc-500">Invalid or expired share link</p>
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 transition-colors font-mono">
            Try KartIQ →
          </Link>
        </div>
      </div>
    )
  }

  const { data } = state
  const winner = data!.winner!
  const score = Math.round((winner.score ?? 0) * 100)
  const badge = sourceBadge(winner.source || '')
  const scoreColor = score >= 75 ? '#00d4aa' : score >= 50 ? '#f59e0b' : '#ef4444'
  let sharedDate = ''
  try {
    sharedDate = new Date(data!.timestamp || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { sharedDate = 'Recently' }

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4 py-12 overflow-hidden relative">

      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${scoreColor}0d 0%, transparent 70%)`
        }}
      />
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* KartIQ Brand */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex items-center gap-2"
      >
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${scoreColor}20`, border: `1px solid ${scoreColor}40` }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={scoreColor} strokeWidth="2.5">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
          </svg>
        </div>
        <span className="text-[15px] font-bold tracking-tight text-white">Kart<span style={{ color: scoreColor }}>IQ</span></span>
        <span className="text-[10px] font-mono text-zinc-600 ml-1 border border-zinc-800 rounded-full px-2 py-0.5">AI Recommendation</span>
      </motion.div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24, delay: 0.1 }}
        className="w-full max-w-[420px] rounded-3xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(160deg, #141414 0%, #0f0f0f 100%)',
          border: `1px solid ${scoreColor}25`,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.6), 0 0 80px ${scoreColor}0a`
        }}
      >
        {/* Top glow line */}
        <div className="h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${scoreColor}60, transparent)` }} />

        {/* Header row: score + query context */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-600 mb-1">
              KartIQ picked · {sharedDate}
            </p>
            <p className="text-[12px] text-zinc-400 truncate">
              "<span className="text-zinc-200">{data!.query}</span>"
            </p>
          </div>
          <ScoreArc score={score} />
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-white/[0.04]" />

        {/* Product info */}
        <div className="px-6 pt-5 pb-4 space-y-4">

          {/* Source badge */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.color }} />
            {winner.source || 'Store'}
          </span>

          {/* Title */}
          <h1 className="text-[18px] font-bold leading-snug text-white tracking-tight">
            {winner.title || 'Unknown Product'}
          </h1>

          {/* Price + rating row */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[28px] font-black text-white tracking-tight leading-none">
                ₹{Number(winner.price || 0).toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">via Google Shopping</p>
            </div>
            {(winner.rating && winner.rating > 0) ? (
              <div className="text-right">
                <StarRating rating={winner.rating} />
                {winner.review_count && winner.review_count > 0 ? (
                  <p className="text-[10px] text-zinc-600 mt-1">{winner.review_count.toLocaleString()} reviews</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Score bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">Match score</span>
              <span className="text-[10px] font-mono" style={{ color: scoreColor }}>{score}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${scoreColor}80, ${scoreColor})` }}
              />
            </div>
          </div>

          {/* Stats pills */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#71717a' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
              Compared <span className="text-zinc-300 font-semibold">{data!.total_compared}</span> products
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px]"
              style={{ background: `${scoreColor}10`, border: `1px solid ${scoreColor}20`, color: scoreColor }}>
              ✦ Best pick
            </div>
          </div>
        </div>

        {/* AI Justification */}
        {winner.justification && (
          <>
            <div className="mx-6 h-px bg-white/[0.04]" />
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: `${scoreColor}15` }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={scoreColor} strokeWidth="2.5">
                    <path d="M9 9l2 2 4-4" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-[10px] uppercase tracking-[0.1em] font-mono" style={{ color: scoreColor }}>
                  AI Reasoning
                </span>
              </div>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                {winner.justification}
              </p>
            </div>
          </>
        )}

        {/* CTA row */}
        <div className="px-6 pb-6 pt-2 flex flex-col gap-2.5">
          {winner.link && winner.link !== '#' && (
            <a
              href={winner.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-[13px] font-bold transition-all"
              style={{
                background: `linear-gradient(135deg, ${scoreColor}, ${scoreColor}bb)`,
                color: '#080808',
                boxShadow: `0 4px 20px ${scoreColor}30`
              }}
            >
              View on {winner.source || 'Store'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15,3 21,3 21,9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
        </div>
      </motion.div>

      {/* Footer CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center space-y-3"
      >
        <p className="text-[12px] text-zinc-600">Want AI to find the best deal for you?</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[13px] font-semibold transition-all text-zinc-300 hover:text-white"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
          </svg>
          Try KartIQ free
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </Link>
      </motion.div>
    </div>
  )
}
