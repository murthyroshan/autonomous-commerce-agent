'use client'

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

type Particle = {
  id: number
  x: number
  y: number
  size: number
  delay: number
  duration: number
  opacity: number
}

function useCursorOrb() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 80, damping: 20 })
  const sy = useSpring(y, { stiffness: 80, damping: 20 })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      x.set(e.clientX - 12)
      y.set(e.clientY - 12)
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [x, y])

  return { sx, sy }
}

function ParticleField() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const next = Array.from({ length: 42 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 4,
      duration: Math.random() * 12 + 10,
      opacity: Math.random() * 0.4 + 0.08,
    }))
    setParticles(next)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: 'rgba(124,58,237,0.7)',
            opacity: p.opacity,
          }}
          animate={{ y: [0, -24, 0, 18, 0], x: [0, 10, -8, 6, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

function WordReveal({ text }: { text: string }) {
  const words = useMemo(() => text.split(' '), [text])

  return (
    <span className="inline-flex flex-wrap justify-center gap-x-2">
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 240, damping: 22 }}
          className="inline-block"
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div className="text-center space-y-3">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20%' }}
        transition={{ type: 'spring', stiffness: 180, damping: 20 }}
        className="text-xs uppercase tracking-[0.2em]"
        style={{ color: '#a78bfa' }}
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20%' }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="text-3xl sm:text-4xl font-bold tracking-tight"
        style={{ color: '#f5f5f5' }}
      >
        {title}
      </motion.h2>
      <p className="text-sm max-w-2xl mx-auto" style={{ color: '#71717a' }}>
        {subtitle}
      </p>
    </div>
  )
}

function StepFlow() {
  const ref = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 60%', 'end 40%'],
  })
  const pathLength = useTransform(scrollYProgress, [0, 1], [0.1, 1])

  return (
    <div ref={ref} className="relative mt-10 grid gap-6 lg:grid-cols-3">
      <motion.svg
        className="absolute inset-0 hidden lg:block"
        viewBox="0 0 900 240"
        fill="none"
      >
        <motion.path
          d="M40 120 C220 20, 420 20, 520 120 C620 220, 720 220, 860 120"
          stroke="rgba(124,58,237,0.4)"
          strokeWidth="2"
          strokeDasharray="6 10"
          style={{ pathLength }}
        />
      </motion.svg>

      {[
        {
          title: 'User intent',
          copy: 'Search bar expands and locks onto the perfect query.',
          tone: 'Intent signal locked',
        },
        {
          title: 'AI analysis',
          copy: 'Neural nodes sync, score, and prune low-signal noise.',
          tone: 'Ranking confidence rising',
        },
        {
          title: 'Decision',
          copy: 'Cards materialize with reasons, not guesses.',
          tone: 'Top pick ready',
        },
      ].map((step, i) => (
        <motion.div
          key={step.title}
          initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 220, damping: 24 }}
          className="relative rounded-3xl border px-6 py-6 backdrop-blur"
          style={{
            borderColor: 'rgba(124,58,237,0.25)',
            background: 'rgba(17,17,17,0.75)',
            boxShadow: '0 0 20px rgba(124,58,237,0.08)',
          }}
        >
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
            Step 0{i + 1}
          </p>
          <h3 className="mt-3 text-lg font-semibold" style={{ color: '#f5f5f5' }}>
            {step.title}
          </h3>
          <p className="mt-2 text-sm" style={{ color: '#71717a' }}>
            {step.copy}
          </p>
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]"
            style={{ borderColor: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#7c3aed' }} />
            {step.tone}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function SwipeDeck() {
  const [stack, setStack] = useState([
    { id: 1, title: 'Acer Nitro 5', price: '₹78,990', tag: 'Gaming Pick' },
    { id: 2, title: 'Lenovo LOQ 15', price: '₹72,490', tag: 'Best Value' },
    { id: 3, title: 'ASUS TUF A15', price: '₹79,990', tag: 'Balanced' },
  ])

  const handleSwipe = (dir: number) => {
    setStack((prev) => {
      const next = [...prev]
      const moved = next.shift()
      if (moved) next.push(moved)
      return next
    })
  }

  return (
    <div className="relative h-[340px] w-full max-w-lg mx-auto">
      {stack.map((card, index) => {
        const isTop = index === 0
        return (
          <motion.div
            key={card.id}
            className="absolute inset-0 rounded-3xl border p-6 shadow-2xl"
            style={{
              background: 'rgba(17,17,17,0.9)',
              borderColor: 'rgba(124,58,237,0.25)',
              transform: `translateY(${index * 14}px) scale(${1 - index * 0.04})`,
              zIndex: stack.length - index,
            }}
            drag={isTop ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 80) {
                handleSwipe(info.offset.x)
              }
            }}
            whileHover={{ rotateX: -4, rotateY: 6 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
                {card.tag}
              </span>
              <span className="text-xs" style={{ color: '#71717a' }}>
                Swipe →
              </span>
            </div>
            <h3 className="mt-4 text-xl font-semibold" style={{ color: '#f5f5f5' }}>
              {card.title}
            </h3>
            <p className="mt-2 text-sm" style={{ color: '#71717a' }}>
              AI surfaces the strongest match with a reasoned rank.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: '#7c3aed' }} />
              {card.price}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function DecisionSection() {
  const count = useMotionValue(0)
  const [score, setScore] = useState('0')

  useEffect(() => {
    const controls = animate(count, 94, {
      duration: 1.8,
      onUpdate: (v) => setScore(v.toFixed(0)),
    })
    return controls.stop
  }, [count])

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        className="rounded-3xl border p-6"
        style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(17,17,17,0.9)' }}
      >
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
          AI Comparison
        </p>
        <h3 className="mt-4 text-2xl font-semibold" style={{ color: '#f5f5f5' }}>
          Transparent, ranked, justified.
        </h3>
        <p className="mt-3 text-sm" style={{ color: '#71717a' }}>
          Cards expand into side-by-side comparisons with auto-counting signals and
          confidence scores.
        </p>
        <div className="mt-6 flex items-center gap-4">
          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(124,58,237,0.25)' }}>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#71717a' }}>
              Confidence
            </p>
            <p className="text-3xl font-bold" style={{ color: '#c4b5fd' }}>
              {score}%
            </p>
          </div>
          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(124,58,237,0.25)' }}>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#71717a' }}>
              Speed
            </p>
            <p className="text-3xl font-bold" style={{ color: '#c4b5fd' }}>
              8s
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        className="rounded-3xl border p-6"
        style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(17,17,17,0.9)' }}
      >
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
          Expandable Insight
        </p>
        <motion.div
          layout
          className="mt-4 rounded-2xl border p-4"
          style={{ borderColor: 'rgba(124,58,237,0.2)', background: 'rgba(12,12,12,0.9)' }}
        >
          <p className="text-sm" style={{ color: '#f5f5f5' }}>
            Lenovo LOQ 15
          </p>
          <p className="text-xs mt-1" style={{ color: '#71717a' }}>
            Price -12%, reviews +18%, GPU tier A
          </p>
          <div className="mt-4 h-1.5 rounded-full bg-[#1a1a1a]">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: '78%',
                background: 'linear-gradient(90deg, #6d28d9, #a855f7)',
              }}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

function DemoTimeline() {
  const ref = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 80%', 'end 10%'],
  })
  const progress = useTransform(scrollYProgress, [0, 1], [0, 100])

  return (
    <div ref={ref} className="relative mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div className="sticky top-28 self-start space-y-4">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
          Workflow demo
        </p>
        <h3 className="text-2xl font-semibold" style={{ color: '#f5f5f5' }}>
          Scroll to watch the agent think.
        </h3>
        <p className="text-sm" style={{ color: '#71717a' }}>
          Each scroll slice reveals a new stage of the autonomous shopping pipeline.
        </p>
        <div className="h-2 w-full rounded-full bg-[#1a1a1a]">
          <motion.div
            className="h-2 rounded-full"
            style={{
              width: progress,
              background: 'linear-gradient(90deg, #6d28d9, #a855f7)',
            }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {['Intent captured', 'Search streams', 'Comparison scored', 'Decision explained'].map(
          (label, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20%' }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 200, damping: 22 }}
              className="rounded-3xl border p-5"
              style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(17,17,17,0.9)' }}
            >
              <p className="text-sm font-semibold" style={{ color: '#f5f5f5' }}>
                {label}
              </p>
              <p className="mt-2 text-xs" style={{ color: '#71717a' }}>
                Timeline step {i + 1} animates as you scroll, like a product movie.
              </p>
            </motion.div>
          )
        )}
      </div>
    </div>
  )
}

function MagneticButton({ label }: { label: string }) {
  const ref = useRef<HTMLButtonElement | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 16 })
  const sy = useSpring(y, { stiffness: 220, damping: 16 })

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    if (Math.hypot(dx, dy) < 90) {
      x.set(dx * 0.2)
      y.set(dy * 0.2)
    }
  }

  return (
    <motion.button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => {
        x.set(0)
        y.set(0)
      }}
      style={{ x: sx, y: sy }}
      className="relative rounded-full px-6 py-3 text-sm font-semibold"
    >
      <span
        className="absolute inset-0 rounded-full blur-lg"
        style={{ background: 'rgba(124,58,237,0.25)' }}
      />
      <span
        className="relative rounded-full border px-6 py-3"
        style={{ borderColor: 'rgba(124,58,237,0.4)', background: '#0f0f12', color: '#f5f5f5' }}
      >
        {label}
      </span>
    </motion.button>
  )
}

export default function LandingPage() {
  const { sx, sy } = useCursorOrb()

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#0a0a0a' }}>
      <ParticleField />
      <div className="absolute inset-0 opacity-70 gradient-bg" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.18),transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(124,58,237,0.12),transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(124,58,237,0.15),transparent_50%)]" />

      <motion.div
        className="pointer-events-none fixed z-50 h-6 w-6 rounded-full"
        style={{
          x: sx,
          y: sy,
          background: 'radial-gradient(circle, rgba(124,58,237,0.8), rgba(124,58,237,0.2))',
          boxShadow: '0 0 24px rgba(124,58,237,0.6)',
        }}
      />

      <main className="relative z-10">
        {/* Hero */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20 }}
            className="text-xs uppercase tracking-[0.2em]"
            style={{ color: '#a78bfa' }}
          >
            Autonomous AI Agent
          </motion.p>
          <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight">
            <span style={{ color: '#f5f5f5' }}>
              <WordReveal text="Your AI brain for shopping decisions." />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-sm" style={{ color: '#a1a1aa' }}>
            Neural background, intelligent timelines, and a data-driven decision engine
            built to feel premium in seconds.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <MagneticButton label="Launch Demo" />
            <Link
              href="/"
              className="rounded-full border px-5 py-3 text-sm"
              style={{ borderColor: 'rgba(124,58,237,0.4)', color: '#c4b5fd' }}
            >
              Explore the agent
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-24">
          <SectionTitle
            eyebrow="How it works"
            title="Three moments. One autonomous flow."
            subtitle="Scroll-based storytelling with AI signal cards, animated flow lines, and morphing UI shapes."
          />
          <StepFlow />
        </section>

        {/* Product discovery */}
        <section className="px-6 py-24">
          <SectionTitle
            eyebrow="Discovery"
            title="Swipe through AI-curated picks."
            subtitle="Interactive card stack with hover reveals and tilt to show every option feels alive."
          />
          <div className="mt-12">
            <SwipeDeck />
          </div>
        </section>

        {/* Decision / comparison */}
        <section className="px-6 py-24">
          <SectionTitle
            eyebrow="Decision engine"
            title="Not just flashy, genuinely smart."
            subtitle="Shared-element style expansions, animated numbers, and confidence driven ranking."
          />
          <DecisionSection />
        </section>

        {/* Demo / workflow */}
        <section className="px-6 py-24">
          <SectionTitle
            eyebrow="Workflow"
            title="A scroll-driven product movie."
            subtitle="Sticky storytelling that walks through the agent’s reasoning like a cinematic process."
          />
          <DemoTimeline />
        </section>

        {/* CTA */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-4xl rounded-[32px] border px-8 py-16 text-center relative overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 30% 20%, rgba(124,58,237,0.2), transparent 55%)',
              }}
            />
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
                Ready to launch
              </p>
              <h2 className="mt-4 text-3xl font-bold" style={{ color: '#f5f5f5' }}>
                Build your autonomous commerce experience.
              </h2>
              <p className="mt-3 text-sm" style={{ color: '#71717a' }}>
                Magnetic CTA, glow pulse, and a final AI mesh to close the loop.
              </p>
              <div className="mt-8 flex justify-center gap-4">
                <MagneticButton label="Start now" />
                <Link
                  href="/"
                  className="rounded-full border px-5 py-3 text-sm"
                  style={{ borderColor: 'rgba(124,58,237,0.4)', color: '#c4b5fd' }}
                >
                  View live search
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style jsx global>{`
        .gradient-bg {
          background: linear-gradient(-45deg, #0a0a0a, #0f0820, #080f1a, #0a0a0a);
          background-size: 400% 400%;
          animation: gradient-shift 18s ease infinite;
        }
      `}</style>
    </div>
  )
}
