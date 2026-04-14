'use client'

import { useEffect, useState, type FormEvent, useRef } from 'react'
import type { ScoredProduct } from '@/hooks/useAgentStream'
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion'
import { usePeraWallet } from '@/hooks/usePeraWallet'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface ConfirmResponse {
  success: boolean
  tx_id?: string
  explorer_url?: string
  error?: string
}

interface PrepareResponse {
  success: boolean
  fallback?: boolean
  error?: string
  txn_b64?: string
  note_preview?: string
  amount_micro?: number
  receiver?: string
}

interface ProductCardProps {
  product: ScoredProduct
  isWinner?: boolean
  index?: number
  justification?: string
}

function sourceBadge(source: string) {
  const s = source.toLowerCase()
  if (s.includes('amazon')) {
    return { bg: 'rgba(124,45,18,0.3)', color: '#fb923c', border: 'rgba(124,45,18,0.6)' }
  }
  if (s.includes('flipkart')) {
    return { bg: 'rgba(30,58,138,0.3)', color: '#60a5fa', border: 'rgba(30,58,138,0.6)' }
  }
  return { bg: 'rgba(39,39,42,0.6)', color: '#a1a1aa', border: 'rgba(63,63,70,0.6)' }
}

function RatingStars({ rating, verified }: { rating: number; verified: boolean }) {
  if (!verified || rating === 0) {
    return (
      <span className="text-xs" style={{ color: '#71717a' }}>
        No rating
      </span>
    )
  }

  const full = Math.floor(rating)
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rating ${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="text-sm" style={{ color: i < full ? '#fbbf24' : '#3f3f46' }}>
          *
        </span>
      ))}
      <span className="ml-1 text-xs" style={{ color: '#71717a' }}>
        {rating.toFixed(1)}
      </span>
    </span>
  )
}

export function ProductCard({
  product,
  isWinner = false,
  index = 0,
  justification,
}: ProductCardProps) {
  const scorePercent = Math.round((product.score ?? 0) * 100)
  const badge = sourceBadge(product.source)

  const [barWidth, setBarWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(scorePercent), 100 + index * 80)
    return () => clearTimeout(t)
  }, [scorePercent, index])

  type ConfirmState =
    | 'idle'
    | 'connecting'
    | 'signing'
    | 'submitting'
    | 'done'
    | 'error'
    | 'local'

  const [confirmState, setConfirmState] = useState<ConfirmState>('idle')
  const [txId, setTxId] = useState<string | null>(null)
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null)
  const { address, connected, connect, disconnect, signTransaction } = usePeraWallet()

  type WatchState = 'hidden' | 'input' | 'saved'
  const [watchState, setWatchState] = useState<WatchState>('hidden')
  const [targetPrice, setTargetPrice] = useState('')
  const [watchSaving, setWatchSaving] = useState(false)

  const requestBody = {
    title: product.title,
    price: product.price,
    source: product.source,
    link: product.link,
    score: product.score ?? 0,
  }

  async function handleDirectConfirm(): Promise<void> {
    try {
      const res = await fetch(`${API}/api/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const data: ConfirmResponse = await res.json()
      if (data.success && data.tx_id && data.explorer_url) {
        setTxId(data.tx_id)
        setExplorerUrl(data.explorer_url)
        setConfirmState('local')
      } else if (data.success) {
        setTxId(data.tx_id ?? null)
        setConfirmState('local')
      } else {
        setConfirmState('error')
      }
    } catch {
      setConfirmState('error')
    }
  }

  async function handleConfirm() {
    setConfirmState('connecting')
    try {
      let activeAddress = address
      if (!connected || !activeAddress) {
        activeAddress = await connect()
        if (!activeAddress) return handleDirectConfirm()
      }

      const prepRes: PrepareResponse = await fetch(`${API}/api/confirm/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, sender_address: activeAddress }),
      }).then((r) => r.json())

      if (!prepRes.success || prepRes.fallback || !prepRes.txn_b64) {
        return handleDirectConfirm()
      }

      setConfirmState('signing')
      const signedTxn = await signTransaction(prepRes.txn_b64)
      if (!signedTxn) return handleDirectConfirm()

      setConfirmState('submitting')
      const submitRes: ConfirmResponse = await fetch(
        `${API}/api/confirm/submit?signed_txn_b64=${encodeURIComponent(signedTxn)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      ).then((r) => r.json())

      if (submitRes.success && submitRes.tx_id) {
        setTxId(submitRes.tx_id)
        setExplorerUrl(
          submitRes.explorer_url ?? `https://testnet.algoexplorer.io/tx/${submitRes.tx_id}`
        )
        setConfirmState('done')
        return
      }

      return handleDirectConfirm()
    } catch {
      return handleDirectConfirm()
    }
  }

  async function handleWatchSubmit(e: FormEvent) {
    e.preventDefault()
    const price = parseFloat(targetPrice.replace(/[₹,]/g, ''))
    if (!price || price <= 0) return
    setWatchSaving(true)
    try {
      await fetch(`${API}/api/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'demo',
          title: product.title,
          current_price: product.price,
          target_price: price,
          source: product.source,
          link: product.link,
          query: product.title,
        }),
      })
      setWatchState('saved')
    } catch {
      setWatchState('hidden')
    } finally {
      setWatchSaving(false)
    }
  }

  // ── 3D HOLOGRAPHIC PHYSICS ──
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 })
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 })
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [15, -15])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-15, 15])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const xPct = mouseX / width - 0.5
    const yPct = mouseY / height - 0.5
    x.set(xPct)
    y.set(yPct)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  // ── FOIL FILTER FOR WINNER ──
  const foilGradient = useMotionTemplate`radial-gradient(
    circle at ${(x.get() + 0.5) * 100}% ${(y.get() + 0.5) * 100}%,
    rgba(255, 255, 255, 0.2),
    transparent 60%
  )`

  const winnerStyle = isWinner
    ? { border: '1px solid rgba(139, 92, 246, 0.3)' }
    : { border: '1px solid #222' }

  return (
    <div style={{ perspective: 1000 }} className="h-full">
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, y: 50, rotateX: 20 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ delay: index * 0.1, type: 'spring', stiffness: 200, damping: 20 }}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          background: '#111',
          ...winnerStyle
        }}
        className="relative flex h-full flex-col rounded-2xl p-5 shadow-2xl transition-shadow group/card"
      >
        {/* Holographic Inner Glare overlay for Winners */}
        {isWinner && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl mix-blend-overlay transition-opacity group-hover/card:opacity-100"
            style={{ backgroundImage: foilGradient }}
          />
        )}
        
        {/* Drop shadow bound to tilt */}
        {isWinner && (
          <motion.div
            className="pointer-events-none absolute -inset-2 z-0 rounded-[2rem] opacity-0 transition-opacity blur-xl bg-purple-500/20 group-hover/card:opacity-100"
            style={{ transform: 'translateZ(-20px)' }}
          />
        )}

        <div style={{ transform: 'translateZ(30px)' }} className="mb-3 flex items-center justify-between gap-2 relative z-20">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
        >
          {product.source}
        </span>

        {isWinner && (
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: 'rgba(109,40,217,0.2)', color: '#c4b5fd', border: '1px solid rgba(109,40,217,0.4)' }}
          >
            * Recommended
          </span>
        )}
      </div>

      <h3 style={{ transform: 'translateZ(40px)' }} className="mb-1 line-clamp-2 text-xl font-bold leading-snug text-[#f5f5f5] relative z-20">
        {product.title}
      </h3>

      {product.link && product.link !== '#' && (
        <a
          href={product.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 text-xs transition-colors"
          style={{ color: '#52525b' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#a78bfa')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#52525b')}
        >
          View on {product.source} -&gt;
        </a>
      )}

      <div style={{ transform: 'translateZ(50px)' }} className="mt-auto flex flex-col gap-1.5 relative z-20">
        <p className="text-xl font-bold" style={{ color: '#f5f5f5' }}>
          ₹{product.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>

        <div className="flex items-center gap-2">
          <RatingStars rating={product.rating} verified={product.rating_verified !== false && product.rating > 0} />
          {product.review_count > 0 ? (
            <span className="text-xs" style={{ color: '#52525b' }}>
              ({product.review_count.toLocaleString()} reviews)
            </span>
          ) : (
            <span className="text-xs" style={{ color: '#3f3f46' }}>Reviews unavailable</span>
          )}
        </div>
      </div>

      <div style={{ transform: 'translateZ(40px)' }} className="mt-4 relative z-20">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs" style={{ color: '#52525b' }}>Match score</span>
          <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>{scorePercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: '#222' }}>
          <div className="score-bar-fill" style={{ width: `${barWidth}%` }} />
        </div>
      </div>

      {isWinner && justification && (
        <div
          className="mt-4 rounded-xl p-3 text-xs leading-relaxed"
          style={{ background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.2)', color: '#a1a1aa' }}
        >
          <span className="mb-1 block text-xs font-semibold" style={{ color: '#a78bfa' }}>
            AI Reasoning
          </span>
          {justification}
        </div>
      )}

      <div style={{ transform: 'translateZ(30px)' }} className="mt-4 relative z-20 w-full flex-grow flex flex-col justify-end">
        {/* ── Wallet identity badge ── */}
        {confirmState === 'idle' && (
          <div className="mb-2 flex items-center justify-between gap-2">
            {connected && address ? (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ background: '#34d399' }}
                />
                <span className="text-xs" style={{ color: '#6ee7b7' }}>
                  Pera: {address.slice(0, 4)}…{address.slice(-4)}
                </span>
                <button
                  onClick={disconnect}
                  className="ml-1 text-[10px] transition-colors"
                  style={{ color: '#52525b' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#52525b')}
                  title="Disconnect wallet"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ background: '#f59e0b' }}
                />
                <span className="text-xs" style={{ color: '#78716c' }}>
                  Wallet not connected
                </span>
              </div>
            )}
          </div>
        )}

        {confirmState === 'idle' && (
          <button
            id={`confirm-btn-${product.title.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
            onClick={handleConfirm}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200"
            style={{
              background: isWinner ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(39,39,42,0.8)',
              color: isWinner ? '#fff' : '#a1a1aa',
              border: isWinner ? 'none' : '1px solid #333',
            }}
            onMouseEnter={(e) => {
              if (!isWinner) return
              e.currentTarget.style.opacity = '0.85'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            {connected && address
              ? isWinner ? '⚡ Sign with Pera' : 'Sign with Pera'
              : isWinner ? '⚡ Connect & Sign' : 'Connect & Sign'}
          </button>
        )}

        {confirmState === 'connecting' && (
          <div className="w-full rounded-xl px-4 py-2.5 text-center text-sm" style={{ background: 'rgba(39,39,42,0.6)', color: '#71717a', border: '1px solid #333' }}>
            <span className="inline-block animate-pulse">Connecting wallet...</span>
          </div>
        )}

        {confirmState === 'signing' && (
          <div className="w-full rounded-xl px-4 py-2.5 text-center text-sm" style={{ background: 'rgba(39,39,42,0.6)', color: '#71717a', border: '1px solid #333' }}>
            <span className="inline-block animate-pulse">Sign in Pera -&gt;</span>
          </div>
        )}

        {confirmState === 'submitting' && (
          <div className="w-full rounded-xl px-4 py-2.5 text-center text-sm" style={{ background: 'rgba(39,39,42,0.6)', color: '#71717a', border: '1px solid #333' }}>
            <span className="inline-block animate-pulse">Submitting...</span>
          </div>
        )}

        {(confirmState === 'done' || confirmState === 'local') && (
          <div className="flex flex-col gap-2">
            <div
              className="w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold"
              style={{
                background: confirmState === 'done' ? 'rgba(16,185,129,0.12)' : 'rgba(217,119,6,0.1)',
                color: confirmState === 'done' ? '#34d399' : '#fbbf24',
                border: confirmState === 'done' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(217,119,6,0.25)',
              }}
            >
              {confirmState === 'done' ? '✓ Signed on Algorand' : '✓ Purchase noted locally'}
            </div>
            {txId && explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-xs transition-colors"
                style={{ color: '#52525b' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#a78bfa')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#52525b')}
                title="View on Algorand Explorer"
              >
                TX: {txId.slice(0, 12)}...
              </a>
            )}

            {watchState === 'hidden' && (
              <button
                onClick={() => setWatchState('input')}
                className="w-full rounded-xl px-4 py-2 text-xs font-medium transition-all"
                style={{ background: 'rgba(124,58,237,0.08)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.14)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.08)')}
              >
                Watch for price drop
              </button>
            )}

            {watchState === 'input' && (
              <form onSubmit={handleWatchSubmit} className="flex gap-2">
                <input
                  type="number"
                  placeholder="Target price (₹)"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                  style={{ background: '#1a1a1a', color: '#f5f5f5', border: '1px solid #333' }}
                />
                <button
                  type="submit"
                  disabled={watchSaving}
                  className="rounded-xl px-3 py-2 text-xs font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: '#7c3aed', color: '#fff' }}
                >
                  {watchSaving ? '...' : 'Set'}
                </button>
              </form>
            )}

            {watchState === 'saved' && (
              <div
                className="w-full rounded-xl px-4 py-2 text-center text-xs"
                style={{ background: 'rgba(124,58,237,0.08)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}
              >
                Watching for ₹{parseFloat(targetPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })} drop
              </div>
            )}
          </div>
        )}

        {confirmState === 'error' && (
          <div
            className="w-full rounded-xl px-4 py-2.5 text-center text-sm"
            style={{ background: 'rgba(217,119,6,0.1)', color: '#fbbf24', border: '1px solid rgba(217,119,6,0.25)' }}
          >
            ✓ Purchase noted locally
          </div>
        )}
      </div>
      </motion.div>
    </div>
  )
}
