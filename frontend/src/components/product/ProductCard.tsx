'use client'

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { StreamingText } from '@/components/agent/StreamingText'
import { useWalletStore } from '@/stores/walletStore'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Badge {
  label: string
  color: string
  note?: string
}

interface Product {
  title: string
  price: number
  rating: number
  review_count: number
  source: string
  link: string
  image_url?: string
  score: number
  relevance_score?: number
  _adj_rating?: number
  primary_badge?: Badge | null
  secondary_badges?: Badge[]
  price_suspicious?: boolean
  preference_boosted?: boolean
  justification?: string
  rank?: number
  total_compared?: number
  rating_verified?: boolean
}

const SOURCE_CONFIG: Record<
  string,
  {
    color: string
    bg: string
    border: string
  }
> = {
  amazon: { color: '#e8a045', bg: '#e8a04512', border: '#e8a04530' },
  flipkart: { color: '#00d4aa', bg: '#00d4aa12', border: '#00d4aa30' },
  croma: { color: '#00d4aa', bg: '#00d4aa12', border: '#00d4aa30' },
  oneplus: { color: '#ff4d4d', bg: '#ff4d4d12', border: '#ff4d4d30' },
  samsung: { color: '#e8a045', bg: '#e8a04512', border: '#e8a04530' },
  sony: { color: '#00d4aa', bg: '#00d4aa12', border: '#00d4aa30' },
  default: { color: '#888884', bg: '#88888412', border: '#88888430' },
}

function getSourceConfig(source: string) {
  const s = source.toLowerCase()
  for (const [k, v] of Object.entries(SOURCE_CONFIG)) {
    if (s.includes(k)) return v
  }
  return SOURCE_CONFIG.default
}

/* ── 3D tilt card effect ─────────────────────────────── */
function useTilt(intensity = 8) {
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useSpring(useMotionValue(0), {
    stiffness: 300,
    damping: 30,
  })
  const rotateY = useSpring(useMotionValue(0), {
    stiffness: 300,
    damping: 30,
  })
  const glareX = useMotionValue(50)
  const glareY = useMotionValue(50)

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / (rect.width / 2)
      const dy = (e.clientY - cy) / (rect.height / 2)
      rotateX.set(-dy * intensity)
      rotateY.set(dx * intensity)
      glareX.set(((e.clientX - rect.left) / rect.width) * 100)
      glareY.set(((e.clientY - rect.top) / rect.height) * 100)
    },
    [glareX, glareY, intensity, rotateX, rotateY]
  )

  const handleLeave = useCallback(() => {
    rotateX.set(0)
    rotateY.set(0)
    glareX.set(50)
    glareY.set(50)
  }, [glareX, glareY, rotateX, rotateY])

  return { ref, rotateX, rotateY, glareX, glareY, handleMove, handleLeave }
}

/* ── Animated score bar ──────────────────────────────── */
function ScoreBar({ score, delay = 0 }: { score: number; delay?: number }) {
  const [width, setWidth] = useState(0)
  const pct = Math.round(score * 100)
  const color =
    score >= 0.75 ? '#00d4aa' : score >= 0.5 ? '#e8a045' : '#ff4d4d'

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 200)
    return () => clearTimeout(t)
  }, [pct, delay])

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-[3px] rounded-full overflow-hidden bg-[rgba(255,255,255,0.06)]">
        <motion.div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}aa, ${color})`,
            boxShadow: `0 0 8px ${color}60`,
            transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </div>
      <span
        className="font-mono text-[11px] tabular-nums w-8 text-right shrink-0"
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  )
}

/* ── Stars ───────────────────────────────────────────── */
function Stars({ rating, verified = true }: { rating: number; verified?: boolean }) {
  if (!rating || rating === 0) {
    return <span className="font-mono text-[11px] text-[#444440]">No rating</span>
  }
  const stars = [1, 2, 3, 4, 5].map((i) => {
    const fill = Math.min(1, Math.max(0, rating - (i - 1)))
    return fill >= 0.75 ? 'full' : fill >= 0.25 ? 'half' : 'empty'
  })
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {stars.map((s, i) => (
          <span
            key={i}
            className="text-[12px]"
            style={{
              color: s === 'empty' ? '#2a2a28' : '#e8a045',
              opacity: s === 'half' ? 0.6 : 1,
            }}
          >
            ★
          </span>
        ))}
      </div>
      <span className="font-mono text-[12px] text-[#888884]">
        {rating.toFixed(1)}
      </span>
      {!verified && (
        <span className="text-[9px] text-[#333330] font-mono">
          (unverified)
        </span>
      )}
    </div>
  )
}

/* ── Main ProductCard ────────────────────────────────── */
export function ProductCard({
  product,
  winner = false,
  index = 0,
  onCompare,
  onWatch,
}: {
  product: Product
  winner?: boolean
  index?: number
  onCompare?: (p: Product) => void
  onWatch?: (p: Product) => void
}) {
  const { ref, rotateX, rotateY, glareX, glareY, handleMove, handleLeave } =
    useTilt(winner ? 5 : 8)
  const [imgError, setImgError] = useState(false)
  type ConfirmState = 'idle' | 'submitting' | 'done' | 'local'
  const [confirmState, setConfirmState] = useState<ConfirmState>('idle')
  const [txId, setTxId] = useState<string | null>(null)
  const [showWatch, setShowWatch] = useState(false)
  const [targetPrice, setTargetPrice] = useState('')
  const { connected, connect, signTransaction } = useWalletStore()

  const badge = product.primary_badge
  const secs = product.secondary_badges ?? []
  const src = getSourceConfig(product.source)
  const adjR = product._adj_rating ?? product.rating

  const handleConfirm = async () => {
    setConfirmState('submitting')
    try {
      const prep = await fetch(`${API}/api/confirm/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      }).then((r) => r.json())

      if (prep.success && !prep.fallback) {
        if (!connected) await connect()
        const signed = await signTransaction(prep.txn_b64)
        if (signed) {
          const sub = await fetch(
            `${API}/api/confirm/submit?signed_txn_b64=${encodeURIComponent(
              signed
            )}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(product),
            }
          ).then((r) => r.json())
          if (sub.success) {
            setTxId(sub.tx_id)
            setConfirmState('done')
            return
          }
        }
      }
      // Phase 4 fallback
      const res = await fetch(`${API}/api/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      }).then((r) => r.json())
      if (res.success) {
        setTxId(res.tx_id)
        setConfirmState(res.tx_id?.startsWith('local-') ? 'local' : 'done')
      }
    } catch {
      setConfirmState('local')
    }
  }

  const handleWatch = async () => {
    const price = parseFloat(targetPrice.replace(/[₹,\s]/g, ''))
    if (!price || Number.isNaN(price)) return
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
    setShowWatch(false)
    onWatch?.(product)
  }

  const cardDelay = index * 0.07

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28, scale: 0.97, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{
        delay: cardDelay,
        type: 'spring',
        stiffness: 280,
        damping: 24,
      }}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 800,
        background: winner
          ? 'linear-gradient(145deg, rgba(232,160,69,0.06) 0%, rgba(17,17,16,1) 50%)'
          : 'rgba(17,17,16,0.9)',
        backdropFilter: 'blur(20px)',
        boxShadow: winner
          ? '0 0 0 1px rgba(232,160,69,0.15), 0 20px 60px rgba(232,160,69,0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
          : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`
        group relative overflow-hidden rounded-2xl
        transition-shadow duration-300 cursor-default
        ${
          winner
            ? 'border border-[rgba(232,160,69,0.3)]'
            : 'border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.12)]'
        }
      `}
    >
      {/* Winner gradient top bar */}
      {winner && (
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent, #e8a045, transparent)',
          }}
        />
      )}

      {/* Glare effect on hover */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background: useTransform([glareX, glareY], ([x, y]) =>
            `radial-gradient(120px circle at ${x}% ${y}%,
               rgba(255,255,255,0.04) 0%, transparent 100%)`
          ),
        }}
      />

      {/* ── Product image area ──────────────────── */}
      <div className="relative h-44 overflow-hidden bg-[rgba(255,255,255,0.02)]">
        {product.image_url && !imgError ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            unoptimized
            loader={({ src }) => src}
            className="object-contain p-6 transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Placeholder grid pattern */}
            <div
              className="
              w-20 h-20 rounded-2xl
              border border-[rgba(255,255,255,0.06)]
              bg-[rgba(255,255,255,0.02)]
              flex items-center justify-center
              font-mono text-[28px] text-[#222220]
            "
            >
              {product.source?.charAt(0).toUpperCase() ?? '?'}
            </div>
            {/* Subtle dot grid */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start gap-2">
          <span
            className="px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-[0.06em] border backdrop-blur-xl"
            style={{
              background: src.bg,
              color: src.color,
              borderColor: src.border,
            }}
          >
            {product.source.split(' ')[0]}
          </span>
          {winner && (
            <motion.span
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: cardDelay + 0.3,
                type: 'spring',
                stiffness: 400,
              }}
              className="
                px-2.5 py-1 rounded-lg text-[10px]
                font-mono uppercase tracking-[0.06em]
                bg-[rgba(232,160,69,0.15)]
                border border-[rgba(232,160,69,0.3)]
                text-[#e8a045] backdrop-blur-xl
                flex items-center gap-1.5
              "
              style={{ boxShadow: '0 0 12px rgba(232,160,69,0.2)' }}
            >
              <span className="w-1 h-1 rounded-full bg-[#e8a045] animate-pulse" />
              Best match
            </motion.span>
          )}
        </div>

        {/* Suspicious price overlay */}
        {product.price_suspicious && (
          <div
            className="
            absolute bottom-0 left-0 right-0 px-3 py-2
            bg-gradient-to-t from-[rgba(255,77,77,0.15)] to-transparent
            font-mono text-[10px] text-[#ff4d4d]
          "
          >
            ⚠ Price anomaly detected
          </div>
        )}
      </div>

      {/* ── Card body ───────────────────────────── */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div>
          <h3
            className="
            text-[14px] font-[500] text-[#f2f2f0]
            leading-[1.4] tracking-[-0.015em] line-clamp-2
            mb-1
          "
          >
            {winner ? <StreamingText text={product.title} speed={10} /> : product.title}
          </h3>

          <a
            href={product.link}
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex items-center gap-1
              text-[11px] font-mono text-[#888884]
              hover:text-[#e8a045] transition-colors
            "
          >
            View on {product.source.split(' ')[0]}
            <span className="text-[9px]">↗</span>
          </a>
        </div>

        {/* Price + Rating */}
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[22px] font-[500] text-[#f2f2f0] tracking-[-0.02em] leading-none">
              ₹{product.price.toLocaleString('en-IN')}
            </div>
            {product.review_count > 0 && (
              <div className="font-mono text-[10px] text-[#888884] mt-1">
                {product.review_count.toLocaleString()} reviews
              </div>
            )}
          </div>
          <Stars rating={adjR} verified={product.rating_verified !== false} />
        </div>

        {/* Score */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#444440]">
              Match
            </span>
            {badge && (
              <span
                className="text-[9px] font-mono uppercase tracking-[0.04em] px-1.5 py-0.5 rounded"
                style={{
                  color: badge.color,
                  background: `${badge.color}15`,
                }}
              >
                {badge.label}
              </span>
            )}
          </div>
          <ScoreBar score={product.score} delay={cardDelay * 1000} />
        </div>

        {/* Secondary badges */}
        {secs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {secs.slice(0, 3).map((b, i) => (
              <span
                key={`${b.label}-${i}`}
                title={b.note}
                className="px-1.5 py-0.5 rounded text-[9px] font-mono border"
                style={{
                  color: b.color,
                  borderColor: `${b.color}25`,
                  background: `${b.color}0c`,
                }}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}

        {/* Winner justification — expandable */}
        {winner && product.justification && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ delay: cardDelay + 0.5 }}
            className="border-t border-[rgba(255,255,255,0.06)] pt-3"
          >
            <p className="text-[12px] text-[#888884] leading-relaxed italic">
              <StreamingText text={product.justification} speed={12} />
            </p>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {/* Confirm button */}
          {confirmState === 'idle' && (
            <motion.button
              whileHover={{ boxShadow: '0 4px 20px rgba(232,160,69,0.3)' }}
              whileTap={{ scale: 0.97 }}
              onClick={handleConfirm}
              className="
                flex-1 h-9 rounded-xl text-[13px] font-[500]
                bg-[#e8a045] text-[#0a0a09]
                hover:bg-[#f0ae52]
                transition-colors duration-150
                flex items-center justify-center gap-1.5
              "
            >
              <span className="text-[12px]">⚡</span>
              Confirm
            </motion.button>
          )}

          {confirmState === 'submitting' && (
            <div className="flex-1 h-9 rounded-xl bg-[rgba(232,160,69,0.08)] border border-[rgba(232,160,69,0.2)] flex items-center justify-center">
              <span className="dot-pulse flex gap-0">
                <span />
                <span />
                <span />
              </span>
            </div>
          )}

          {confirmState === 'done' && (
            <div className="flex-1 space-y-1">
              <div
                className="
                h-9 rounded-xl flex items-center
                justify-center gap-2 text-[13px] font-[500]
                bg-[rgba(0,212,170,0.08)]
                border border-[rgba(0,212,170,0.2)]
                text-[#00d4aa]
              "
                style={{ boxShadow: '0 0 12px rgba(0,212,170,0.1)' }}
              >
                ✓ On Algorand
              </div>
              {txId && (
                <a
                  href={`https://testnet.algoexplorer.io/tx/${txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    block text-center text-[10px] font-mono
                    text-[#888884] hover:text-[#00d4aa]
                    transition-colors truncate
                  "
                >
                  TX: {txId.slice(0, 14)}…
                </a>
              )}
            </div>
          )}

          {confirmState === 'local' && (
            <div className="flex-1 h-9 rounded-xl flex items-center justify-center text-[13px] bg-[rgba(232,160,69,0.06)] border border-[rgba(232,160,69,0.15)] text-[#e8a045]">
              ✓ Noted locally
            </div>
          )}

          {/* Watch button */}
          {confirmState === 'idle' && !showWatch && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setShowWatch(true)}
              title="Watch for price drop"
              className="
                w-9 h-9 rounded-xl text-[15px]
                border border-[rgba(255,255,255,0.08)]
                bg-[rgba(255,255,255,0.03)]
                hover:border-[rgba(255,255,255,0.15)]
                hover:bg-[rgba(255,255,255,0.06)]
                text-[#888884] hover:text-[#f2f2f0]
                transition-all flex items-center justify-center
              "
            >
              ◎
            </motion.button>
          )}

          {/* Compare button */}
          {onCompare && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => onCompare(product)}
              title="Compare"
              className="
                w-9 h-9 rounded-xl text-[14px]
                border border-[rgba(255,255,255,0.08)]
                bg-[rgba(255,255,255,0.03)]
                hover:border-[rgba(255,255,255,0.15)]
                hover:bg-[rgba(255,255,255,0.06)]
                text-[#888884] hover:text-[#f2f2f0]
                transition-all flex items-center justify-center
              "
            >
              ⊞
            </motion.button>
          )}
        </div>

        {/* Watch price input */}
        <AnimatePresence>
          {showWatch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2"
            >
              <input
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleWatch()}
                placeholder="Target ₹..."
                autoFocus
                className="
                  flex-1 h-8 px-3 rounded-lg text-[12px]
                  bg-[rgba(255,255,255,0.04)]
                  border border-[rgba(255,255,255,0.08)]
                  text-[#f2f2f0] placeholder-[#444440]
                  outline-none font-mono
                  focus:border-[rgba(232,160,69,0.3)]
                  transition-colors
                "
              />
              <button
                onClick={handleWatch}
                className="
                  h-8 px-3 rounded-lg text-[11px] font-[500]
                  bg-[rgba(232,160,69,0.12)] text-[#e8a045]
                  hover:bg-[rgba(232,160,69,0.2)]
                  transition-colors
                "
              >
                Watch
              </button>
              <button
                onClick={() => setShowWatch(false)}
                className="
                  h-8 w-8 rounded-lg text-[#888884]
                  hover:text-[#f2f2f0] transition-colors
                  flex items-center justify-center text-[13px]
                "
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
