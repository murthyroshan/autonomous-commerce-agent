'use client'

/**
 * PriceLockCard.tsx — Post-payment price-lock reveal component.
 *
 * Shown on the winning ProductCard when x402State.status === 'locked'.
 * Displays the verified price, a live countdown timer, the Algorand
 * explorer link, and the final checkout button.
 *
 * The `confirmState` prop (from ProductCard) controls the checkout button:
 *   idle / connecting → enabled, normal label
 *   submitting / signing → disabled, spinner + "Processing…"
 *   done / local → replaced with a ✓ confirmation + tx link
 *   error → re-enabled, error color
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PriceLockPayload } from '@/hooks/useX402'

export type ConfirmState = 'idle' | 'connecting' | 'submitting' | 'signing' | 'done' | 'local' | 'error'

interface PriceLockCardProps {
  priceLock:    PriceLockPayload
  confirmState: ConfirmState
  txId?:        string
  explorerUrl?: string
  onCheckout:   (verifiedPrice: number, receipt: string) => void
}

export function PriceLockCard({
  priceLock,
  confirmState,
  txId,
  explorerUrl,
  onCheckout,
}: PriceLockCardProps) {
  const [secondsLeft, setSecondsLeft] = useState(0)

  // ── Countdown timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const expireMs = new Date(priceLock.lock_expires_at).getTime()

    const tick = () => {
      const diff = Math.max(0, Math.floor((expireMs - Date.now()) / 1000))
      setSecondsLeft(diff)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [priceLock.lock_expires_at])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const isExpiringSoon = secondsLeft > 0 && secondsLeft < 60
  const isExpired      = secondsLeft === 0
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const isProcessing = confirmState === 'submitting' || confirmState === 'signing' || confirmState === 'connecting'
  const isPurchased  = confirmState === 'done' || confirmState === 'local'
  const isButtonDisabled = isExpired || isProcessing || isPurchased

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="mt-3 rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background:   'rgba(16,185,129,0.06)',
        border:       '1px solid rgba(52,211,153,0.25)',
        boxShadow:    '0 0 24px rgba(52,211,153,0.08)',
      }}
    >
      {/* ── Header row: verified price + countdown ─────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: '#34d399' }}
          >
            ✓ Price Locked
          </p>
          <p
            className="text-2xl font-bold font-mono"
            style={{ color: '#6ee7b7' }}
          >
            ₹{priceLock.verified_price.toLocaleString('en-IN', {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>

        <div className="text-right">
          {isPurchased ? (
            /* After purchase — replace timer with confirmed badge */
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
            >
              ✓ Confirmed
            </span>
          ) : (
            <>
              <p
                className="text-[10px] uppercase tracking-wider mb-0.5"
                style={{ color: '#52525b' }}
              >
                Lock expires
              </p>
              <p
                className={`font-mono text-lg font-bold transition-colors ${
                  isExpired ? 'text-[#ef4444]' : isExpiringSoon ? 'text-[#f87171]' : 'text-[#a1a1aa]'
                } ${isExpiringSoon && !isExpired ? 'animate-pulse' : ''}`}
              >
                {isExpired ? 'Expired' : mmss}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Explorer link ───────────────────────────────────────────────────── */}
      <a
        href={priceLock.explorer_link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] transition-colors"
        style={{ color: '#60a5fa' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#93c5fd')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#60a5fa')}
      >
        <span>View payment on Algorand</span>
        <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>↗</span>
      </a>

      {/* ── Receipt snippet ─────────────────────────────────────────────────── */}
      <p
        className="text-[10px] font-mono truncate"
        style={{ color: '#3f3f46' }}
        title={priceLock.facilitator_receipt}
      >
        Tx: {priceLock.facilitator_receipt.slice(0, 24)}…
      </p>

      {/* ── Checkout CTA / Success state ─────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isPurchased ? (
          /* ── Success state — replaces the button after purchase ─────────── */
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl px-4 py-3 flex flex-col gap-1"
            style={{
              background: 'rgba(16,185,129,0.12)',
              border:     '1px solid rgba(52,211,153,0.3)',
            }}
          >
            <p className="text-sm font-semibold" style={{ color: '#34d399' }}>
              ✓ Purchase Confirmed
            </p>
            {(txId || explorerUrl) && (
              <a
                href={explorerUrl ?? `https://lora.algokit.io/testnet/transaction/${txId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono truncate transition-colors"
                style={{ color: '#60a5fa' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#93c5fd')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#60a5fa')}
              >
                {txId ? `Tx: ${txId.slice(0, 24)}…` : 'View on explorer ↗'}
              </a>
            )}
            {confirmState === 'local' && !txId && (
              <p className="text-[10px]" style={{ color: '#52525b' }}>
                Noted locally — blockchain sync pending
              </p>
            )}
          </motion.div>
        ) : (
          /* ── Checkout button — disabled during processing or expiry ──────── */
          <motion.button
            key="checkout-btn"
            whileTap={isButtonDisabled ? {} : { scale: 0.96 }}
            disabled={isButtonDisabled}
            onClick={() => !isButtonDisabled && onCheckout(priceLock.verified_price, priceLock.facilitator_receipt)}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={
              isExpired || isProcessing
                ? { background: 'rgba(39,39,42,0.5)', color: '#52525b', border: '1px solid #333' }
                : {
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color:      '#fff',
                    border:     'none',
                  }
            }
            onMouseEnter={(e) => { if (!isButtonDisabled) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={(e) => { if (!isButtonDisabled) e.currentTarget.style.opacity = '1' }}
          >
            {isProcessing && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
            )}
            {isExpired
              ? 'Price Lock Expired'
              : isProcessing
                ? confirmState === 'connecting'
                  ? 'Connecting wallet…'
                  : confirmState === 'signing'
                    ? 'Check Pera Wallet…'
                    : 'Processing…'
                : '🛒 Proceed to Checkout'}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

