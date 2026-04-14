'use client'

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { SearchOrb } from '@/components/agent/SearchOrb'
import { AgentTimeline } from '@/components/agent/AgentTimeline'
import { useAgentStream } from '@/hooks/useAgentStream'
import { useAppStore } from '@/stores/appStore'
import { ProductGrid } from '@/components/product/ProductGrid'

export const dynamic = 'force-dynamic'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
  opacity: number
}

/* ── Floating particle background ─────────────────────── */
function ParticleBg() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const next = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.3 + 0.05,
    }))
    setParticles(next)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#e8a045]"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -30, 0, 20, 0],
            x: [0, 10, -10, 5, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity * 0.5, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Subtle radial gradient spotlight that follows mouse */}
      <MouseSpotlight />
    </div>
  )
}

/* ── Mouse-following radial spotlight ─────────────────── */
function MouseSpotlight() {
  const x = useMotionValue(50)
  const y = useMotionValue(50)
  const springX = useSpring(x, { stiffness: 50, damping: 20 })
  const springY = useSpring(y, { stiffness: 50, damping: 20 })

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      x.set((e.clientX / window.innerWidth) * 100)
      y.set((e.clientY / window.innerHeight) * 100)
    }
    window.addEventListener('mousemove', handle)
    return () => window.removeEventListener('mousemove', handle)
  }, [x, y])

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        background: useTransform([springX, springY], ([px, py]) =>
          `radial-gradient(600px circle at ${px}% ${py}%,
             rgba(232,160,69,0.04) 0%,
             transparent 70%)`
        ),
      }}
    />
  )
}

/* ── Animated grid lines in background ────────────────── */
function GridBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
        maskImage:
          'radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)',
      }}
    />
  )
}

/* ── Animated stat counter ─────────────────────────────── */
function StatCounter({
  value,
  label,
  suffix = '',
}: {
  value: number
  label: string
  suffix?: string
}) {
  const count = useMotionValue(0)
  const [displayed, setDisplayed] = useState('0')

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 2,
      ease: 'easeOut',
      onUpdate: (v) =>
        setDisplayed(
          suffix === 'k+'
            ? `${(v / 1000).toFixed(0)}k+`
            : suffix === '%'
              ? `${v.toFixed(0)}%`
              : v.toFixed(0)
        ),
    })
    return controls.stop
  }, [count, suffix, value])

  return (
    <div className="text-center">
      <div className="font-display text-[36px] font-[600] tracking-[-0.04em] text-[#e8a045]">
        {displayed}
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#888884] mt-1">
        {label}
      </div>
    </div>
  )
}

/* ── Glassy status pill ───────────────────────────────── */
function StatusPill({ text, dot = '#00d4aa' }: { text: string; dot?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="
        inline-flex items-center gap-2 px-4 py-2 rounded-full
        border border-[rgba(255,255,255,0.08)]
        bg-[rgba(255,255,255,0.04)]
        backdrop-blur-xl
        font-mono text-[11px] uppercase tracking-[0.08em]
        text-[#888884]
      "
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: dot }}
      />
      {text}
    </motion.div>
  )
}

/* ── Scroll-triggered section wrapper ─────────────────── */
function ScrollReveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ref.current || visible) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
        }
      },
      { threshold: 0.15 }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [visible])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32, filter: 'blur(6px)' }}
      animate={visible ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{
        delay,
        type: 'spring',
        stiffness: 260,
        damping: 24,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Glassmorphism card ────────────────────────────────── */
function GlassCard({
  children,
  className = '',
  amber = false,
}: {
  children: React.ReactNode
  className?: string
  amber?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
      animate={{ y: hovered ? -4 : 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`
        relative rounded-2xl overflow-hidden
        border transition-colors duration-300
        ${
          amber
            ? 'border-[rgba(232,160,69,0.2)] bg-[rgba(232,160,69,0.04)]'
            : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]'
        }
        backdrop-blur-xl
        ${className}
      `}
      style={{
        boxShadow: hovered
          ? amber
            ? '0 20px 40px rgba(232,160,69,0.08), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 20px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)'
          : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Cursor-following inner glow */}
      {hovered && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity"
          style={{
            background: `radial-gradient(180px circle at ${mousePos.x}% ${mousePos.y}%,
              ${amber ? 'rgba(232,160,69,0.08)' : 'rgba(255,255,255,0.04)'} 0%, transparent 100%)`,
          }}
        />
      )}
      {children}
    </motion.div>
  )
}

/* ── Magnetic button ───────────────────────────────────── */
function MagneticButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 300, damping: 20 })
  const sy = useSpring(y, { stiffness: 300, damping: 20 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 80) {
      x.set(dx * 0.3)
      y.set(dy * 0.3)
    }
  }

  return (
    <motion.button
      ref={ref}
      style={{ x: sx, y: sy }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        x.set(0)
        y.set(0)
      }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.button>
  )
}

/* ── Agent status bar (shows while pipeline runs) ─────── */
function AgentStatusBar({ status }: { status: string }) {
  if (!status) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="
        flex items-center gap-3 px-5 py-3 rounded-2xl
        border border-[rgba(0,212,170,0.15)]
        bg-[rgba(0,212,170,0.04)] backdrop-blur-xl
        font-mono text-[12px] text-[#00d4aa]
      "
      style={{ boxShadow: '0 0 20px rgba(0,212,170,0.06)' }}
    >
      <span className="dot-pulse flex gap-0">
        <span />
        <span />
        <span />
      </span>
      {status}
    </motion.div>
  )
}

/* ── Main page ─────────────────────────────────────────── */
export default function HomePage() {
  const { search } = useAgentStream()
  const { agentState, result, error, timelineEvents, streamStatus } =
    useAppStore()

  const handleSearch = useCallback(
    (query: string) => {
      search(query)
    },
    [search]
  )

  const isSearching = ['searching', 'comparing', 'deciding'].includes(
    agentState
  )

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0a0a09]">
      {/* ── Background layers ─────────────────────── */}
      <GridBackground />
      <ParticleBg />

      {/* ── Glassmorphism Nav ─────────────────────── */}
      <nav
        className="
        fixed top-0 left-0 right-0 z-50
        flex items-center justify-between
        px-8 py-4
        border-b border-[rgba(255,255,255,0.06)]
        bg-[rgba(10,10,9,0.7)] backdrop-blur-2xl
      "
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.03)' }}
      >
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display text-[18px] font-[600] tracking-[-0.03em] text-[#f2f2f0]"
        >
          Kartiq
        </motion.span>
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-8"
        >
          {[
            { label: 'History', href: '/history' },
            { label: 'Watchlist', href: '/watchlist' },
            { label: 'About', href: '/landing' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="
                relative text-[13px] text-[#888884]
                hover:text-[#f2f2f0] transition-colors duration-150
                after:absolute after:bottom-[-2px] after:left-0
                after:w-0 after:h-[1px] after:bg-[#e8a045]
                after:transition-all after:duration-200
                hover:after:w-full
              "
            >
              {item.label}
            </Link>
          ))}
        </motion.div>
      </nav>

      {/* ── Main content ──────────────────────────── */}
      <main
        className="
        flex-1 flex flex-col items-center
        justify-center px-6 pt-28 pb-20 gap-12
        relative z-10
      "
      >
        {/* Hero text — fades out while searching */}
        <AnimatePresence>
          {agentState === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="flex flex-col items-center gap-5 text-center"
            >
              <StatusPill text="Powered by Groq · Serper · Algorand" />

              <h1
                className="
                font-display text-[60px] font-[600]
                tracking-[-0.05em] leading-[1.0]
                text-[#f2f2f0] max-w-2xl
              "
              >
                Your AI that shops
                <br />
                <span
                  className="text-transparent bg-clip-text"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, #e8a045 0%, #f0c070 50%, #e8a045 100%)',
                    backgroundSize: '200% auto',
                    animation: 'gradient-shift 3s linear infinite',
                  }}
                >
                  smarter than you.
                </span>
              </h1>

              <p
                className="
                text-[16px] text-[#888884] leading-relaxed
                tracking-[-0.01em] max-w-md
              "
              >
                Search, compare, score, decide — in seconds. Every purchase
                logged on Algorand blockchain.
              </p>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="
                  flex items-center gap-8 mt-2 px-8 py-4
                  rounded-2xl border border-[rgba(255,255,255,0.06)]
                  bg-[rgba(255,255,255,0.02)] backdrop-blur-xl
                  divide-x divide-[rgba(255,255,255,0.06)]
                "
              >
                {[
                  { value: 50, label: 'Products compared', suffix: '+' },
                  { value: 8, label: 'Seconds avg', suffix: '' },
                  { value: 100, label: 'Blockchain secured', suffix: '%' },
                ].map((s, i) => (
                  <div key={s.label} className={i > 0 ? 'pl-8' : ''}>
                    <StatCounter {...s} />
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Search Orb ────────────────────────── */}
        <div className="w-full max-w-2xl">
          <SearchOrb onSearch={handleSearch} />
        </div>

        {/* ── Agent status bar while searching ─── */}
        <AnimatePresence>
          {isSearching && streamStatus && <AgentStatusBar status={streamStatus} />}
        </AnimatePresence>

        {/* ── Agent Timeline ────────────────────── */}
        <AnimatePresence>
          {timelineEvents.length > 0 && (
            <div className="w-full max-w-2xl">
              <AgentTimeline />
            </div>
          )}
        </AnimatePresence>

        {/* ── Results ───────────────────────────── */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              className="w-full max-w-6xl"
            >
              {/* Result header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display text-[26px] font-[600] tracking-[-0.03em] text-[#f2f2f0]">
                    Results
                  </h2>
                  <p className="font-mono text-[12px] text-[#888884] mt-0.5">
                    Compared{' '}
                    <span className="text-[#e8a045]">
                      {result.recommendation?.total_compared ??
                        result.scored_products?.length ??
                        0}
                    </span>{' '}
                    products for{' '}
                    <span className="text-[#f2f2f0]">"{result.query}"</span>
                  </p>
                </div>
                <MagneticButton
                  onClick={() => useAppStore.getState().reset()}
                  className="
                    px-4 py-2 rounded-xl text-[12px] font-mono
                    border border-[rgba(255,255,255,0.08)]
                    bg-[rgba(255,255,255,0.04)] backdrop-blur-xl
                    text-[#888884] hover:text-[#f2f2f0]
                    transition-colors
                  "
                >
                  ← New search
                </MagneticButton>
              </div>

              <ProductGrid
                products={result.scored_products ?? []}
                recommendation={result.recommendation}
                query={result.query}
                totalCompared={result.recommendation?.total_compared}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="
                w-full max-w-2xl px-5 py-4 rounded-2xl
                border border-[rgba(255,77,77,0.2)]
                bg-[rgba(255,77,77,0.06)] backdrop-blur-xl
                text-[#ff4d4d] text-[13px] font-mono text-center
              "
              style={{ boxShadow: '0 0 20px rgba(255,77,77,0.06)' }}
            >
              ⚠ {error}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Footer — always at bottom ──────────── */}
      <footer
        className="
        relative z-10 mt-auto px-8 py-5
        border-t border-[rgba(255,255,255,0.06)]
        flex items-center justify-between
        font-mono text-[11px] text-[#333330]
        bg-[rgba(10,10,9,0.8)] backdrop-blur-xl
      "
      >
        <div className="flex items-center gap-2">
          <span className="font-display text-[13px] font-[600] tracking-[-0.02em] text-[#888884]">
            Kartiq
          </span>
          <span>·</span>
          <span>© 2025</span>
        </div>
        <div className="flex gap-6">
          <Link href="/history" className="hover:text-[#888884] transition-colors">
            History
          </Link>
          <Link
            href="/watchlist"
            className="hover:text-[#888884] transition-colors"
          >
            Watchlist
          </Link>
          <Link href="/landing" className="hover:text-[#888884] transition-colors">
            About
          </Link>
          <a
            href="https://github.com/yourusername/kartiq"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#888884] transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
