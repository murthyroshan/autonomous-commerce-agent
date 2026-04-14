'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, Sparkles, MeshTransmissionMaterial } from '@react-three/drei'
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionTemplate,
  useMotionValue,
  useVelocity,
  useSpring,
} from 'framer-motion'
import { usePeraWallet } from '@/hooks/usePeraWallet'
import * as THREE from 'three'

// ─── MAGNETIC EFFECT CONTAINER ────────────────────────────────────────────────
function Magnetic({ children, intensity = 0.2 }: { children: React.ReactNode; intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const { clientX, clientY } = e
    const { height, width, left, top } = ref.current.getBoundingClientRect()
    const middleX = clientX - (left + width / 2)
    const middleY = clientY - (top + height / 2)
    setPosition({ x: middleX * intensity, y: middleY * intensity })
  }

  const reset = () => setPosition({ x: 0, y: 0 })

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
    >
      {children}
    </motion.div>
  )
}

// ─── CYPHER TEXT SCRAMBLE ─────────────────────────────────────────────────────
const CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>/?1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
function ScrambleText({ text, isHovered }: { text: string; isHovered: boolean }) {
  const [displayText, setDisplayText] = useState(text)

  const prevHovered = useRef(isHovered)
  if (isHovered !== prevHovered.current) {
    prevHovered.current = isHovered
    if (!isHovered) {
      setDisplayText(text)
    }
  }

  useEffect(() => {
    if (!isHovered) return

    let iterations = 0
    const interval = setInterval(() => {
      setDisplayText((old) =>
        old
          .split('')
          .map((char, index) => {
            if (index < iterations) return text[index]
            return CHARS[Math.floor(Math.random() * CHARS.length)]
          })
          .join('')
      )

      if (iterations >= text.length) {
        clearInterval(interval)
      }
      iterations += 1 / 2 // Speed of decryption
    }, 30)

    return () => clearInterval(interval)
  }, [isHovered, text])

  return <span className="font-mono tabular-nums tracking-widest sm:font-sans sm:tracking-normal">{displayText}</span>
}

// ─── 3D STELLAR LOGO ──────────────────────────────────────────────────────────
function AnimatedLogo() {
  const meshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const timeRef = useRef(0)

  useFrame((state, delta) => {
    timeRef.current += delta
    const elapsed = timeRef.current
    if (meshRef.current) {
      meshRef.current.rotation.y = elapsed * 0.4
      meshRef.current.rotation.x = elapsed * 0.2
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = elapsed * -0.2
      ringRef.current.rotation.x = Math.sin(elapsed * 0.5) * 0.2
    }
  })

  return (
    <Float speed={2.5} rotationIntensity={1.2} floatIntensity={1.5}>
      {/* Core Torus Knot */}
      <mesh ref={meshRef} scale={0.7}>
        <torusKnotGeometry args={[0.8, 0.25, 100, 16]} />
        <meshPhysicalMaterial
          color="#a78bfa"
          roughness={0.1}
          metalness={0.8}
          transmission={0.9}
          thickness={0.5}
        />
      </mesh>
      
      {/* Outer Orbiting Ring */}
      <mesh ref={ringRef} scale={1.2}>
        <torusGeometry args={[1, 0.02, 16, 100]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0.4} />
      </mesh>
    </Float>
  )
}

const NAV_LINKS = [
  { name: 'Home', href: '/' },
  { name: 'Search', href: '/search' },
  { name: 'History', href: '/history' },
  { name: 'Watchlist', href: '/watchlist' },
]

export function Navbar() {
  const pathname = usePathname()
  const { address, connected, connect, disconnect } = usePeraWallet()
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)

  // Scroll tracking for dynamic navbar shrinkage and blur
  const { scrollY } = useScroll()
  const navHeightInit = 80
  const navHeightScrolled = 64
  
  const navHeight = useTransform(scrollY, [0, 80], [navHeightInit, navHeightScrolled])
  const headerBg = useTransform(scrollY, [0, 80], ['rgba(5,5,5,0)', 'rgba(20,20,30,0.15)'])
  const headerBorder = useTransform(scrollY, [0, 80], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.03)'])
  const headerBlur = useTransform(scrollY, [0, 80], ['blur(0px)', 'blur(24px)'])

  // Velocity dynamics: Skew navbar on fast scroll
  const scrollVelocity = useVelocity(scrollY)
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 })
  const skewVelocity = useTransform(smoothVelocity, [-1000, 1000], [2, -2])

  // Spotlight effect bound to cursor
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  const spotlightBackground = useMotionTemplate`
    radial-gradient(
      400px circle at ${mouseX}px ${mouseY}px,
      rgba(139, 92, 246, 0.15),
      transparent 80%
    )
  `

  // Ensures client-side rendering for motion elements relying on scroll/window
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  if (pathname === '/') return null

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 80, delay: 0.1 }}
      className="fixed top-0 left-0 right-0 z-[100] w-full"
    >
      <motion.div
        onMouseMove={handleMouseMove}
        style={{
          height: navHeight,
          backgroundColor: headerBg,
          borderColor: headerBorder,
          backdropFilter: headerBlur,
          WebkitBackdropFilter: headerBlur,
          skewY: skewVelocity,
        }}
        className="group relative mx-auto flex w-full max-w-7xl items-center justify-between overflow-hidden border-b transition-shadow duration-500 px-6 sm:px-12 origin-top"
      >
        {/* Dynamic Spotlight Glow */}
        <motion.div
          className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: spotlightBackground,
          }}
        />

        {/* ── Brand / Logo ── */}
        <Magnetic intensity={0.1}>
          <Link href="/" className="group/logo relative z-10 flex items-center gap-3">
            <div className="h-12 w-12 pt-1 transition-transform duration-500 group-hover/logo:scale-110">
              <Canvas camera={{ position: [0, 0, 3] }} frameloop="always">
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#c4b5fd" />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
                <Sparkles count={40} scale={2.5} size={1.5} speed={0.4} opacity={0.5} noise={0.2} color="#a78bfa" />
                <AnimatedLogo />
                <Environment preset="city" />
              </Canvas>
            </div>
            <span className="relative text-2xl font-black tracking-tighter text-white">
              Kart<span className="text-purple-500 transition-colors duration-300 group-hover/logo:text-purple-400">IQ</span>
            </span>
          </Link>
        </Magnetic>

        {/* ── Navigation Links ── */}
        <nav className="relative z-10 hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || (link.name === 'Home' && pathname === '/')
            return (
              <Magnetic intensity={0.2} key={link.name}>
                <Link
                  href={link.href}
                  onMouseEnter={() => setHoveredLink(link.name)}
                  onMouseLeave={() => setHoveredLink(null)}
                  className="relative px-4 py-2 text-sm font-semibold transition-colors"
                  style={{ color: isActive ? '#fff' : '#a1a1aa' }}
                >
                  <span className="relative z-10 block transition-transform duration-300 group-hover:text-white">
                    <ScrambleText text={link.name} isHovered={hoveredLink === link.name} />
                  </span>
                  
                  {/* Active Link Glow / Line */}
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      className="absolute inset-x-2 -bottom-px h-[2px] bg-gradient-to-r from-purple-500/0 via-purple-500 to-purple-500/0"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      style={{ boxShadow: '0 -2px 10px rgba(168, 85, 247, 0.4)' }}
                    />
                  )}
                  
                  {/* Hover Pill Background */}
                  <AnimatePresence>
                    {hoveredLink === link.name && !isActive && (
                      <motion.div
                        layoutId="hover-nav-pill"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="absolute inset-0 z-0 rounded-lg bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                      />
                    )}
                  </AnimatePresence>
                </Link>
              </Magnetic>
            )
          })}
        </nav>

        {/* ── Wallet / Action Button ── */}
        <div className="relative z-10 flex items-center">
          {!connected ? (
            <Magnetic intensity={0.1}>
              <motion.button
                whileHover="hover"
                whileTap={{ scale: 0.95 }}
                onClick={() => void connect()}
                className="group/btn relative overflow-hidden rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white shadow-xl transition-colors hover:bg-zinc-800"
              >
                {/* Rotating Gradient Border using a conic gradient pseudo-element */}
                <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
                    className="absolute -inset-[100%] z-0 rounded-full"
                    style={{
                      background: 'conic-gradient(from 0deg, transparent 0%, transparent 60%, #8b5cf6 80%, #d8b4fe 100%)',
                    }}
                  />
                  {/* Inner masking to create the border look */}
                  <div className="absolute inset-[1px] z-10 rounded-[11px] bg-zinc-950 transition-colors duration-300 group-hover/btn:bg-zinc-900" />
                </div>

                {/* Shimmer on Hover */}
                <motion.div
                  variants={{
                    hover: { x: ['-100%', '100%'] }
                  }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  className="absolute inset-0 z-20 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover/btn:opacity-100"
                />

                <span className="relative z-30 flex items-center gap-2 tracking-wide">
                  <svg className="h-4 w-4 text-purple-400 group-hover/btn:animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  Connect Wallet
                </span>
              </motion.button>
            </Magnetic>
          ) : (
            <div className="flex items-center gap-2">
              <Magnetic intensity={0.1}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="group/connected flex cursor-pointer items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-2 shadow-inner transition-colors hover:bg-purple-500/20"
                >
                  <div className="relative flex h-2 w-2 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 hidden group-hover/connected:inline-flex"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 transition-colors group-hover/connected:bg-emerald-400"></span>
                  </div>
                  <span className="text-sm font-semibold tracking-wide text-purple-200">
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                  </span>
                </motion.div>
              </Magnetic>
              
              <Magnetic intensity={0.2}>
                <button
                  onClick={disconnect}
                  className="group/disconnect relative flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900/50 text-zinc-400 outline outline-1 outline-white/5 transition-all hover:bg-red-500/10 hover:text-red-400 hover:outline-red-500/20"
                  title="Disconnect Wallet"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover/disconnect:rotate-90">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                    <line x1="12" y1="2" x2="12" y2="12"></line>
                  </svg>
                </button>
              </Magnetic>
            </div>
          )}
        </div>
      </motion.div>
    </motion.header>
  )
}
