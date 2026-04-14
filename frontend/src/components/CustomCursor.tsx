'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export function CustomCursor() {
  const [mounted, setMounted] = useState(false)
  const [clicking, setClicking] = useState(false)
  const [hovering, setHovering] = useState(false)

  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)

  // Fluid trailing physical springs
  // Smoother and lower mass than before
  const springX = useSpring(cursorX, { stiffness: 600, damping: 30, mass: 0.1 })
  const springY = useSpring(cursorY, { stiffness: 600, damping: 30, mass: 0.1 })
  
  // Secondary slower trail
  const trailX = useSpring(cursorX, { stiffness: 200, damping: 25, mass: 0.5 })
  const trailY = useSpring(cursorY, { stiffness: 200, damping: 25, mass: 0.5 })

  useEffect(() => {
    setMounted(true)
    const move = (e: MouseEvent) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
      
      const target = e.target as HTMLElement
      const isHoverable = target.closest('button') || target.closest('a') || target.closest('input')
      setHovering(!!isHoverable)
    }
    const down = () => setClicking(true)
    const up = () => setClicking(false)

    window.addEventListener('mousemove', move)
    window.addEventListener('mousedown', down)
    window.addEventListener('mouseup', up)
    
    // Add a global class to hide the default cursor everywhere
    document.body.classList.add('hide-cursor')

    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mousedown', down)
      window.removeEventListener('mouseup', up)
      document.body.classList.remove('hide-cursor')
    }
  }, [cursorX, cursorY])

  if (!mounted) return null

  return (
    <>
      {/* Small Core Dot */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9999] rounded-full bg-purple-500 shadow-sm"
        style={{
          x: springX,
          y: springY,
          translateX: '-50%',
          translateY: '-50%',
          width: '8px',
          height: '8px',
          boxShadow: '0 0 10px 2px rgba(168, 85, 247, 0.4)'
        }}
        animate={{ scale: clicking ? 0.8 : 1, opacity: hovering ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      />
      
      {/* Outer Ring */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[9998] rounded-full border border-purple-500/80"
        style={{
          x: trailX,
          y: trailY,
          translateX: '-50%',
          translateY: '-50%',
          width: '32px',
          height: '32px',
        }}
        animate={{ 
          scale: hovering ? 1.5 : clicking ? 0.9 : 1,
          borderColor: hovering ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.8)',
          backgroundColor: hovering ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0)',
          borderWidth: '1.5px'
        }}
      />
    </>
  )
}
