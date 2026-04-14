'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  motion,
  useMotionValue,
  useSpring,
} from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

gsap.registerPlugin(ScrollTrigger)

type Node = {
  id: number
  position: [number, number, number]
  energy: number
}

type LinkEdge = {
  id: number
  a: number
  b: number
}

const SECTIONS = [
  'hero',
  'how',
  'discovery',
  'decision',
  'demo',
  'cta',
] as const

function useSystemState() {
  const [density, setDensity] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [focus, setFocus] = useState<'cta' | 'cards' | 'neutral'>('neutral')
  const [pulse, setPulse] = useState(0)

  const bumpPulse = useCallback(() => {
    setPulse((p) => (p + 1) % 9999)
  }, [])

  return { density, setDensity, speed, setSpeed, focus, setFocus, pulse, bumpPulse }
}

function useCursorOrb() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 120, damping: 22 })
  const sy = useSpring(y, { stiffness: 120, damping: 22 })
  const target = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const mode = useRef<'follow' | 'scan'>('scan')

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      target.current = { x: e.clientX - 12, y: e.clientY - 12 }
      if (mode.current === 'follow') {
        x.set(target.current.x)
        y.set(target.current.y)
      }
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [x, y])

  useEffect(() => {
    const anchors = [
      { x: 140, y: 180 },
      { x: 220, y: 120 },
      { x: 260, y: 240 },
      { x: 180, y: 280 },
    ]
    let idx = 0
    const interval = setInterval(() => {
      if (mode.current === 'scan') {
        const next = anchors[idx % anchors.length]
        x.set(next.x)
        y.set(next.y)
        idx += 1
      }
    }, 1800)
    return () => clearInterval(interval)
  }, [x, y])

  const setMode = useCallback(
    (next: 'follow' | 'scan') => {
      mode.current = next
      if (next === 'follow') {
        x.set(target.current.x)
        y.set(target.current.y)
      }
    },
    [x, y]
  )

  const moveTo = useCallback(
    (nx: number, ny: number) => {
      target.current = { x: nx, y: ny }
      x.set(nx)
      y.set(ny)
    },
    [x, y]
  )

  const pulse = useCallback(() => {
    const tl = gsap.timeline()
    tl.to('.ai-orb', { scale: 1.2, duration: 0.2 })
      .to('.ai-orb', { scale: 0.9, duration: 0.2 })
      .to('.ai-orb', { scale: 1, duration: 0.25 })
  }, [])

  return { sx, sy, setMode, moveTo, pulse }
}

function NeuralField({
  density,
  speed,
  focus,
  pulse,
}: {
  density: number
  speed: number
  focus: 'cta' | 'cards' | 'neutral'
  pulse: number
}) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<LinkEdge[]>([])

  useEffect(() => {
    const count = Math.round(24 * density)
    const nextNodes = Array.from({ length: count }, (_, i) => ({
      id: i,
      position: [
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 2,
      ] as [number, number, number],
      energy: Math.random(),
    }))
    const nextEdges: LinkEdge[] = []
    nextNodes.forEach((node, i) => {
      const targets = nextNodes.slice(i + 1).slice(0, 3)
      targets.forEach((t) => {
        nextEdges.push({ id: nextEdges.length, a: node.id, b: t.id })
      })
    })
    setNodes(nextNodes)
    setEdges(nextEdges)
  }, [density])

  if (nodes.length === 0) return null

  return (
    <Canvas
      className="absolute inset-0 z-0"
      camera={{ position: [0, 0, 6], fov: 50 }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <NeuralNodes nodes={nodes} speed={speed} focus={focus} pulse={pulse} />
      <NeuralEdges nodes={nodes} edges={edges} speed={speed} focus={focus} />
      <DataPackets nodes={nodes} edges={edges} speed={speed} />
    </Canvas>
  )
}

function NeuralNodes({
  nodes,
  speed,
  focus,
  pulse,
}: {
  nodes: Node[]
  speed: number
  focus: 'cta' | 'cards' | 'neutral'
  pulse: number
}) {
  const pulseRef = useRef(0)
  useEffect(() => {
    pulseRef.current = pulseRef.current + 1
  }, [pulse])

  return (
    <>
      {nodes.map((node) => (
        <NodePoint
          key={node.id}
          node={node}
          speed={speed}
          focus={focus}
          pulse={pulseRef.current}
        />
      ))}
    </>
  )
}

function NodePoint({
  node,
  speed,
  focus,
  pulse,
}: {
  node: Node
  speed: number
  focus: 'cta' | 'cards' | 'neutral'
  pulse: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  const base = useMemo(() => node.energy * 0.8 + 0.2, [node.energy])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime() * speed
    const pulseBoost = focus === 'cta' ? 0.6 : focus === 'cards' ? 0.3 : 0.15
    const scale = base + Math.sin(t + node.id) * 0.1 + pulseBoost * 0.1
    ref.current.scale.setScalar(scale)
  })

  return (
    <mesh ref={ref} position={node.position}>
      <sphereGeometry args={[0.05, 12, 12]} />
      <meshBasicMaterial color="#7c3aed" />
    </mesh>
  )
}

function NeuralEdges({
  nodes,
  edges,
  speed,
  focus,
}: {
  nodes: Node[]
  edges: LinkEdge[]
  speed: number
  focus: 'cta' | 'cards' | 'neutral'
}) {
  const ref = useRef<THREE.LineSegments>(null)

  const geometry = useMemo(() => {
    const positions: number[] = []
    edges.forEach((edge) => {
      const a = nodes[edge.a]
      const b = nodes[edge.b]
      positions.push(...a.position, ...b.position)
    })
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geom
  }, [edges, nodes])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime() * speed
    const alpha = focus === 'cta' ? 0.5 : focus === 'cards' ? 0.35 : 0.22
    ;(ref.current.material as THREE.Material).opacity = alpha + Math.sin(t) * 0.05
  })

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#5b21b6" transparent opacity={0.25} />
    </lineSegments>
  )
}

function DataPackets({
  nodes,
  edges,
  speed,
}: {
  nodes: Node[]
  edges: LinkEdge[]
  speed: number
}) {
  return (
    <>
      {edges.slice(0, 8).map((edge) => (
        <Packet key={edge.id} a={nodes[edge.a]} b={nodes[edge.b]} speed={speed} />
      ))}
    </>
  )
}

function Packet({ a, b, speed }: { a: Node; b: Node; speed: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const progress = useRef(Math.random())

  useFrame((_, delta) => {
    if (!ref.current) return
    progress.current += delta * 0.4 * speed
    if (progress.current > 1) progress.current = 0
    const t = progress.current
    const x = a.position[0] + (b.position[0] - a.position[0]) * t
    const y = a.position[1] + (b.position[1] - a.position[1]) * t
    const z = a.position[2] + (b.position[2] - a.position[2]) * t
    ref.current.position.set(x, y, z)
  })

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.03, 10, 10]} />
      <meshBasicMaterial color="#c4b5fd" />
    </mesh>
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

function HowItWorks() {
  const branchRef = useRef<SVGPathElement | null>(null)
  const rerouteRef = useRef<SVGPathElement | null>(null)
  const [active, setActive] = useState<'intent' | 'analyze' | 'compare'>('intent')

  useEffect(() => {
    if (!branchRef.current || !rerouteRef.current) return
    gsap.set(rerouteRef.current, { strokeDasharray: 200, strokeDashoffset: 200 })
    gsap.set(branchRef.current, { strokeDasharray: 200, strokeDashoffset: 0 })
  }, [])

  const trigger = useCallback(
    (target: 'intent' | 'analyze' | 'compare') => {
      setActive(target)
      if (!branchRef.current || !rerouteRef.current) return
      const tl = gsap.timeline()
      if (target === 'analyze') {
        tl.to(branchRef.current, { strokeDashoffset: 200, duration: 0.5 })
          .to(rerouteRef.current, { strokeDashoffset: 0, duration: 0.6 }, '-=0.2')
      } else {
        tl.to(rerouteRef.current, { strokeDashoffset: 200, duration: 0.5 })
          .to(branchRef.current, { strokeDashoffset: 0, duration: 0.6 }, '-=0.2')
      }
    },
    []
  )

  return (
    <div className="relative mt-12">
      <svg className="absolute inset-0 hidden lg:block" viewBox="0 0 900 260">
        <path
          d="M40 130 C240 30, 420 30, 520 130 C620 230, 720 230, 860 130"
          stroke="rgba(124,58,237,0.25)"
          strokeWidth="2"
          fill="none"
        />
        <path
          ref={branchRef}
          d="M100 130 C260 40, 420 40, 520 130"
          stroke="rgba(124,58,237,0.6)"
          strokeWidth="2"
          fill="none"
        />
        <path
          ref={rerouteRef}
          d="M100 130 C260 200, 420 200, 520 130"
          stroke="rgba(199,173,255,0.7)"
          strokeWidth="2"
          fill="none"
        />
      </svg>

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          {
            id: 'intent',
            title: 'Intent signal',
            copy: 'Search bar expands. Signal locked.',
          },
          {
            id: 'analyze',
            title: 'Analyze',
            copy: 'Neural reroute with node activation.',
          },
          {
            id: 'compare',
            title: 'Compare',
            copy: 'Parallel paths fight to rank.',
          },
        ].map((step) => (
          <motion.button
            key={step.id}
            whileHover={{ y: -4 }}
            onHoverStart={() => trigger(step.id as any)}
            onFocus={() => trigger(step.id as any)}
            onClick={() => trigger(step.id as any)}
            className="rounded-3xl border px-6 py-6 text-left"
            style={{
              borderColor:
                active === step.id ? 'rgba(124,58,237,0.5)' : 'rgba(124,58,237,0.2)',
              background: 'rgba(17,17,17,0.85)',
            }}
          >
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
              {step.id.toUpperCase()}
            </p>
            <h3 className="mt-3 text-lg font-semibold" style={{ color: '#f5f5f5' }}>
              {step.title}
            </h3>
            <p className="mt-2 text-sm" style={{ color: '#71717a' }}>
              {step.copy}
            </p>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function PredictiveCards({ onFocus }: { onFocus: (focus: 'cards' | 'neutral') => void }) {
  const [cards, setCards] = useState([
    { id: 1, title: 'Lenovo LOQ 15', score: 0.91 },
    { id: 2, title: 'Acer Nitro 5', score: 0.78 },
    { id: 3, title: 'ASUS TUF A15', score: 0.72 },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setCards((prev) => {
        const next = [...prev]
        const top = next.shift()
        if (top) next.push(top)
        return next
      })
    }, 4200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="relative mx-auto mt-10 grid gap-4 md:grid-cols-3"
      onMouseEnter={() => onFocus('cards')}
      onMouseLeave={() => onFocus('neutral')}
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.id}
          layout
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="rounded-3xl border p-5"
          style={{
            borderColor: 'rgba(124,58,237,0.25)',
            background: 'rgba(17,17,17,0.85)',
            boxShadow: `0 0 ${Math.round(card.score * 40)}px rgba(124,58,237,0.35)`,
          }}
        >
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
            Predicted {Math.round(card.score * 100)}%
          </p>
          <h3 className="mt-3 text-lg font-semibold" style={{ color: '#f5f5f5' }}>
            {card.title}
          </h3>
          <p className="mt-2 text-sm" style={{ color: '#71717a' }}>
            AI preselects this card before you move.
          </p>
        </motion.div>
      ))}
      <GhostCursor />
    </div>
  )
}

function GhostCursor() {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const tl = gsap.timeline({ repeat: -1, defaults: { duration: 1.6, ease: 'power2.inOut' } })
    tl.to(ref.current, { x: 120, y: -20 })
      .to(ref.current, { x: 220, y: 10 })
      .to(ref.current, { x: 60, y: 30 })
  }, [])

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute -top-6 left-1/2 h-6 w-6 rounded-full border"
      style={{
        borderColor: 'rgba(124,58,237,0.4)',
        boxShadow: '0 0 18px rgba(124,58,237,0.35)',
      }}
    />
  )
}

function DecisionExplainable() {
  const [weights, setWeights] = useState({ price: 0.45, rating: 0.35, reviews: 0.2 })

  useEffect(() => {
    const interval = setInterval(() => {
      setWeights((prev) => {
        const price = Math.min(0.55, Math.max(0.3, prev.price + (Math.random() - 0.5) * 0.05))
        const rating = Math.min(0.5, Math.max(0.2, prev.rating + (Math.random() - 0.5) * 0.05))
        const reviews = Math.max(0.1, 1 - price - rating)
        return { price, rating, reviews }
      })
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border p-6" style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(17,17,17,0.9)' }}>
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
          Weight distribution
        </p>
        <div className="mt-6 space-y-4">
          {[
            { key: 'price', label: 'Price', value: weights.price },
            { key: 'rating', label: 'Rating', value: weights.rating },
            { key: 'reviews', label: 'Reviews', value: weights.reviews },
          ].map((w) => (
            <div key={w.key}>
              <div className="flex items-center justify-between text-xs" style={{ color: '#71717a' }}>
                <span>{w.label}</span>
                <span>{Math.round(w.value * 100)}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#1a1a1a]">
                <motion.div
                  className="h-2 rounded-full"
                  animate={{ width: `${Math.round(w.value * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                  style={{ background: 'linear-gradient(90deg, #6d28d9, #a855f7)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border p-6" style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(17,17,17,0.9)' }}>
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
          Competing options
        </p>
        <div className="mt-6 space-y-4">
          {[
            { name: 'Lenovo LOQ', score: weights.price * 0.9 + weights.rating * 0.88 + weights.reviews * 0.75 },
            { name: 'Acer Nitro', score: weights.price * 0.8 + weights.rating * 0.82 + weights.reviews * 0.78 },
            { name: 'ASUS TUF', score: weights.price * 0.7 + weights.rating * 0.9 + weights.reviews * 0.6 },
          ].map((item) => (
            <div key={item.name}>
              <div className="flex items-center justify-between text-xs" style={{ color: '#71717a' }}>
                <span>{item.name}</span>
                <span>{Math.round(item.score * 100)}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#1a1a1a]">
                <motion.div
                  className="h-2 rounded-full"
                  animate={{ width: `${Math.round(item.score * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                  style={{ background: 'linear-gradient(90deg, #7c3aed, #c4b5fd)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CinematicDemo() {
  const container = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!container.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.scene',
        { opacity: 0, scale: 0.94, y: 40 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          stagger: 0.2,
          scrollTrigger: {
            trigger: container.current,
            start: 'top 70%',
            end: 'bottom 30%',
            scrub: true,
          },
        }
      )
    }, container)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={container} className="mt-10 grid gap-6 lg:grid-cols-3">
      {['Intent capture', 'Multi-agent search', 'Decision publish'].map((label, i) => (
        <div
          key={label}
          className="scene rounded-3xl border p-6"
          style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(17,17,17,0.9)' }}
        >
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: '#a78bfa' }}>
            Scene 0{i + 1}
          </p>
          <h3 className="mt-3 text-lg font-semibold" style={{ color: '#f5f5f5' }}>
            {label}
          </h3>
          <p className="mt-2 text-sm" style={{ color: '#71717a' }}>
            Cinematic zoom and depth layering as the system evolves.
          </p>
        </div>
      ))}
    </div>
  )
}

function MagneticButton({
  label,
  onHover,
  pulse,
}: {
  label: string
  onHover?: (hovered: boolean) => void
  pulse?: boolean
}) {
  const ref = useRef<HTMLButtonElement | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 16 })
  const sy = useSpring(y, { stiffness: 220, damping: 16 })

  useEffect(() => {
    if (!pulse || !ref.current) return
    const tl = gsap.timeline({ repeat: -1, yoyo: true })
    tl.to(ref.current, { boxShadow: '0 0 24px rgba(124,58,237,0.45)', duration: 1.2 })
    return () => tl.kill()
  }, [pulse])

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
        onHover?.(false)
      }}
      onMouseEnter={() => onHover?.(true)}
      style={{ x: sx, y: sy }}
      className="relative rounded-full px-6 py-3 text-sm font-semibold"
      whileHover={{ scale: 1.03 }}
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
  const system = useSystemState()
  const { sx, sy, setMode, moveTo, pulse } = useCursorOrb()
  const [ctaHover, setCtaHover] = useState(false)
  const [idlePulse, setIdlePulse] = useState(false)
  const ctaRef = useRef<HTMLDivElement | null>(null)
  const setSpeed = system.setSpeed
  const setDensity = system.setDensity
  const setFocus = system.setFocus
  const bumpPulse = system.bumpPulse

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>
    const reset = () => {
      if (idleTimer) clearTimeout(idleTimer)
      setIdlePulse(false)
      idleTimer = setTimeout(() => setIdlePulse(true), 2400)
    }
    reset()
    window.addEventListener('mousemove', reset)
    return () => window.removeEventListener('mousemove', reset)
  }, [])

  useEffect(() => {
    if (ctaHover) {
      setFocus('cta')
      bumpPulse()
      pulse()
    } else {
      setFocus('neutral')
    }
  }, [bumpPulse, ctaHover, pulse, setFocus])

  useEffect(() => {
    if (!idlePulse || !ctaRef.current) return
    const rect = ctaRef.current.getBoundingClientRect()
    moveTo(rect.left + rect.width / 2 - 12, rect.top + rect.height / 2 - 12)
    pulse()
  }, [idlePulse, moveTo, pulse])

  useEffect(() => {
    const handleScroll = () => {
      const velocity = Math.min(3, Math.max(0.6, window.scrollY / 800))
      setSpeed(velocity)
      setDensity(velocity > 1.6 ? 1.3 : 1)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [setDensity, setSpeed])

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#0a0a0a' }}>
      <NeuralField
        density={system.density}
        speed={system.speed}
        focus={system.focus}
        pulse={system.pulse}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")",
        }}
      />

      <motion.div
        className="ai-orb pointer-events-none fixed z-50 h-6 w-6 rounded-full"
        style={{
          x: sx,
          y: sy,
          background: 'radial-gradient(circle, rgba(124,58,237,0.9), rgba(124,58,237,0.15))',
          boxShadow: '0 0 30px rgba(124,58,237,0.6)',
        }}
      />

      <main className="relative z-10">
        {/* Hero */}
        <section
          id="hero"
          className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
          onMouseEnter={() => setMode('scan')}
        >
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
            The system responds to cursor intent, scroll velocity, and hover signals.
            You are watching a live AI engine think.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <MagneticButton
              label="Launch Demo"
              onHover={(h) => setCtaHover(h)}
              pulse={idlePulse}
            />
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
        <section id="how" className="px-6 py-24">
          <SectionTitle
            eyebrow="How it works"
            title="Non-linear, reactive, interactive."
            subtitle="Hover or click any step to reroute the system. The network adapts in real time."
          />
          <HowItWorks />
        </section>

        {/* Product discovery */}
        <section id="discovery" className="px-6 py-24">
          <SectionTitle
            eyebrow="Discovery"
            title="Predictive AI selects before you do."
            subtitle="Cards reorder, glow by probability, and the AI cursor moves first."
          />
          <PredictiveCards
            onFocus={(focus) => {
              setFocus(focus)
              setMode(focus === 'cards' ? 'follow' : 'scan')
            }}
          />
        </section>

        {/* Decision / comparison */}
        <section id="decision" className="px-6 py-24">
          <SectionTitle
            eyebrow="Decision engine"
            title="Explainable AI, visible reasoning."
            subtitle="Weights adjust live, competing options fight, and the score evolves."
          />
          <DecisionExplainable />
        </section>

        {/* Demo / workflow */}
        <section id="demo" className="px-6 py-24">
          <SectionTitle
            eyebrow="Workflow"
            title="Cinematic system sequence."
            subtitle="Zoom, pan, and depth cues turn the pipeline into a movie."
          />
          <CinematicDemo />
        </section>

        {/* CTA */}
        <section id="cta" className="px-6 py-24">
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
                The AI orb nudges when you hover or pause, guiding you to act.
              </p>
              <div className="mt-8 flex justify-center gap-4">
                <div ref={ctaRef}>
                  <MagneticButton
                    label="Start now"
                    onHover={(h) => {
                      setCtaHover(h)
                      setMode(h ? 'follow' : 'scan')
                    }}
                    pulse={idlePulse}
                  />
                </div>
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
    </div>
  )
}
