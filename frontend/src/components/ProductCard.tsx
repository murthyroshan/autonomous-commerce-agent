'use client'

import { useEffect, useState, type FormEvent } from 'react'
import type { ScoredProduct } from '@/hooks/useAgentStream'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Types for /api/confirm response ────────────────────────────────────────
interface ConfirmResponse {
  success: boolean
  tx_id?: string
  explorer_url?: string
  error?: string
}

interface ProductCardProps {
  product: ScoredProduct
  isWinner?: boolean
  index?: number
  /** Justification text shown only on the winner card */
  justification?: string
}

function sourceBadge(source: string) {
  const s = source.toLowerCase()
  if (s.includes('amazon'))
    return {
      bg: 'rgba(124,45,18,0.3)',
      color: '#fb923c',
      border: 'rgba(124,45,18,0.6)',
    }
  if (s.includes('flipkart'))
    return {
      bg: 'rgba(30,58,138,0.3)',
      color: '#60a5fa',
      border: 'rgba(30,58,138,0.6)',
    }
  return {
    bg: 'rgba(39,39,42,0.6)',
    color: '#a1a1aa',
    border: 'rgba(63,63,70,0.6)',
  }
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
        <span
          key={i}
          className="text-sm"
          style={{ color: i < full ? '#fbbf24' : '#3f3f46' }}
        >
          ★
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

  // Animate score bar: start at 0, then jump to actual width after mount
  const [barWidth, setBarWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(scorePercent), 100 + index * 80)
    return () => clearTimeout(t)
  }, [scorePercent, index])

  // ── Algorand confirm state ──────────────────────────────────────────────
  type ConfirmState = 'idle' | 'loading' | 'success' | 'error'
  const [confirmState, setConfirmState] = useState<ConfirmState>('idle')
  const [txId, setTxId] = useState<string | null>(null)
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null)

  // ── Watchlist state ─────────────────────────────────────────────────────
  type WatchState = 'hidden' | 'input' | 'saved'
  const [watchState, setWatchState] = useState<WatchState>('hidden')
  const [targetPrice, setTargetPrice] = useState('')
  const [watchSaving, setWatchSaving] = useState(false)

  async function handleConfirm() {
    setConfirmState('loading')
    try {
      const res = await fetch(`${API}/api/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:  product.title,
          price:  product.price,
          source: product.source,
          link:   product.link,
          score:  product.score ?? 0,
        }),
      })
      const data: ConfirmResponse = await res.json()
      if (data.success && data.tx_id && data.explorer_url) {
        setTxId(data.tx_id)
        setExplorerUrl(data.explorer_url)
        setConfirmState('success')
      } else if (data.success) {
        // Blockchain not configured — local fallback (still success)
        setTxId(data.tx_id ?? null)
        setConfirmState('success')
      } else {
        setConfirmState('error')
      }
    } catch {
      // Network failure — never crash the UI
      setConfirmState('error')
    }
  }

  async function handleWatchSubmit(e: FormEvent) {
    e.preventDefault()
    const price = parseFloat(targetPrice.replace(/[₹,]/g, ''))
    if (!price || price <= 0) return
    setWatchSaving(true)
    try {
      await fetch(`${API}/api/watchlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:       'demo',
          title:         product.title,
          current_price: product.price,
          target_price:  price,
          source:        product.source,
          link:          product.link,
          query:         product.title,
        }),
      })
      setWatchState('saved')
    } catch {
      setWatchState('hidden')
    } finally {
      setWatchSaving(false)
    }
  }

  const winnerStyle = isWinner
    ? {
        border: '2px solid #7c3aed',
        boxShadow: '0 0 28px rgba(124,58,237,0.18)',
      }
    : {
        border: '1px solid #222',
      }

  return (
    <div
      className="animate-fade-in-up card-hover flex flex-col rounded-2xl p-5"
      style={{
        background: '#111',
        animationDelay: `${index * 80}ms`,
        ...winnerStyle,
      }}
    >
      {/* ── Top row: source badge + winner badge ────────────────────────── */}
      <div className="mb-3 flex items-center justify-between gap-2">
        {/* Source pill */}
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            background: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
          }}
        >
          {product.source}
        </span>

        {/* Recommended badge (winner only) */}
        {isWinner && (
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{
              background: 'rgba(109,40,217,0.2)',
              color: '#c4b5fd',
              border: '1px solid rgba(109,40,217,0.4)',
            }}
          >
            ★ Recommended
          </span>
        )}
      </div>

      {/* ── Title ───────────────────────────────────────────────────────── */}
      <h3
        className="mb-1 line-clamp-2 text-sm font-semibold leading-snug"
        style={{ color: '#f5f5f5' }}
      >
        {product.title}
      </h3>

      {/* View link */}
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
          View on {product.source} →
        </a>
      )}

      {/* ── Price + rating ──────────────────────────────────────────────── */}
      <div className="mt-auto flex flex-col gap-1.5">
        <p className="text-xl font-bold" style={{ color: '#f5f5f5' }}>
          ₹{product.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>

        <div className="flex items-center gap-2">
          {/* Show stars only when rating is verified/present */}
          <RatingStars
            rating={product.rating}
            verified={product.rating_verified !== false && product.rating > 0}
          />
          {/* Show review count only when it's non-zero */}
          {product.review_count > 0 ? (
            <span className="text-xs" style={{ color: '#52525b' }}>
              ({product.review_count.toLocaleString()} reviews)
            </span>
          ) : (
            <span className="text-xs" style={{ color: '#3f3f46' }}>
              Reviews unavailable
            </span>
          )}
        </div>
      </div>

      {/* ── Score bar ────────────────────────────────────────────────────── */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs" style={{ color: '#52525b' }}>
            Match score
          </span>
          <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>
            {scorePercent}%
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: '#222' }}
        >
          <div
            className="score-bar-fill"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* ── Justification (winner only) ──────────────────────────────────── */}
      {isWinner && justification && (
        <div
          className="mt-4 rounded-xl p-3 text-xs leading-relaxed"
          style={{
            background: 'rgba(109,40,217,0.08)',
            border: '1px solid rgba(109,40,217,0.2)',
            color: '#a1a1aa',
          }}
        >
          <span className="mb-1 block text-xs font-semibold" style={{ color: '#a78bfa' }}>
            AI Reasoning
          </span>
          {justification}
        </div>
      )}

      {/* ── Confirm Purchase button / Algorand status ─────────────────────── */}
      <div className="mt-4">
        {confirmState === 'idle' && (
          <button
            id={`confirm-btn-${product.title.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
            onClick={handleConfirm}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200"
            style={{
              background: isWinner
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                : 'rgba(39,39,42,0.8)',
              color: isWinner ? '#fff' : '#a1a1aa',
              border: isWinner ? 'none' : '1px solid #333',
            }}
            onMouseEnter={(e) => {
              if (!isWinner) return
              ;(e.currentTarget as HTMLButtonElement).style.opacity = '0.85'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.opacity = '1'
            }}
          >
            {isWinner ? '⚡ Confirm Purchase' : 'Confirm Purchase'}
          </button>
        )}

        {confirmState === 'loading' && (
          <div
            className="w-full rounded-xl px-4 py-2.5 text-center text-sm"
            style={{ background: 'rgba(39,39,42,0.6)', color: '#71717a', border: '1px solid #333' }}
          >
            <span className="inline-block animate-pulse">⏳ Logging on Algorand…</span>
          </div>
        )}

        {confirmState === 'success' && (
          <div className="flex flex-col gap-2">
            <div
              className="w-full rounded-xl px-4 py-2.5 text-center text-sm font-semibold"
              style={{
                background: 'rgba(16,185,129,0.12)',
                color: '#34d399',
                border: '1px solid rgba(16,185,129,0.3)',
              }}
            >
              ✓ Purchase confirmed
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
                TX: {txId.slice(0, 12)}…
              </a>
            )}

            {/* ── Watch for price drop ───────────────────────────────── */}
            {watchState === 'hidden' && (
              <button
                onClick={() => setWatchState('input')}
                className="w-full rounded-xl px-4 py-2 text-xs font-medium transition-all"
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  color: '#a78bfa',
                  border: '1px solid rgba(124,58,237,0.2)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.14)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.08)')}
              >
                🔔 Watch for price drop
              </button>
            )}

            {watchState === 'input' && (
              <form onSubmit={handleWatchSubmit} className="flex gap-2">
                <input
                  type="number"
                  placeholder="Target price (₹)"
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                  className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                  style={{
                    background: '#1a1a1a',
                    color: '#f5f5f5',
                    border: '1px solid #333',
                  }}
                />
                <button
                  type="submit"
                  disabled={watchSaving}
                  className="rounded-xl px-3 py-2 text-xs font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: '#7c3aed', color: '#fff' }}
                >
                  {watchSaving ? '…' : 'Set'}
                </button>
              </form>
            )}

            {watchState === 'saved' && (
              <div
                className="w-full rounded-xl px-4 py-2 text-center text-xs"
                style={{ background: 'rgba(124,58,237,0.08)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}
              >
                ✓ Watching for ₹{parseFloat(targetPrice).toLocaleString('en-IN', { maximumFractionDigits: 0 })} drop
              </div>
            )}
          </div>
        )}

        {confirmState === 'error' && (
          <div
            className="w-full rounded-xl px-4 py-2.5 text-center text-sm"
            style={{
              background: 'rgba(217,119,6,0.1)',
              color: '#fbbf24',
              border: '1px solid rgba(217,119,6,0.25)',
            }}
          >
            Purchase noted locally
          </div>
        )}
      </div>
    </div>
  )
}
