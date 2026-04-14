'use client'

import React, { useEffect } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useGlobalState } from '@/store/globalStore'

export function CursorEnergy() {
  const { cursorVariant, isLowEnd } = useGlobalState()
  
  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)
  
  // Smooth spring for the outer glow (trailing effect)
  const springConfig = { damping: 25, stiffness: 200, mass: 0.5 }
  const glowX = useSpring(mouseX, springConfig)
  const glowY = useSpring(mouseY, springConfig)

  useEffect(() => {
    if (isLowEnd) return // disable for low end
    const manageMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }
    window.addEventListener('mousemove', manageMouseMove)
    return () => {
      window.removeEventListener('mousemove', manageMouseMove)
    }
  }, [mouseX, mouseY, isLowEnd])

  if (isLowEnd) return null

  // Variants map for the core dot
  const variants = {
    default: {
      height: 12,
      width: 12,
      backgroundColor: 'rgba(255, 255, 255, 1)',
      border: '0px solid transparent'
    },
    magnetic: {
      height: 60,
      width: 60,
      backgroundColor: 'rgba(255, 255, 255, 0)',
      border: '1px solid rgba(255, 255, 255, 0.4)'
    },
    hover: {
      height: 48,
      width: 48,
      backgroundColor: 'rgba(168, 85, 247, 0.2)',
      border: '1px solid rgba(168, 85, 247, 0.8)'
    },
    search: {
      height: 80,
      width: 80,
      backgroundColor: 'rgba(168, 85, 247, 0.1)',
      border: '2px solid rgba(168, 85, 247, 0.6)'
    }
  }

  return (
    <div className="hidden md:block">
      {/* Inner sharp dot */}
      <motion.div
        className="fixed top-0 left-0 z-[10000] pointer-events-none rounded-full flex items-center justify-center mix-blend-screen"
        style={{
          x: mouseX,
          y: mouseY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        variants={variants}
        animate={cursorVariant}
        transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.5 }}
      >
        {cursorVariant === 'search' && (
          <motion.div 
            className="w-full h-full rounded-full border border-purple-400 absolute"
            animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </motion.div>
      
      {/* Trailing soft glow */}
      <motion.div
        className="fixed top-0 left-0 z-[9999] pointer-events-none rounded-full blur-2xl mix-blend-screen"
        style={{
          x: glowX,
          y: glowY,
          translateX: '-50%',
          translateY: '-50%',
          width: 300,
          height: 300,
          background: cursorVariant === 'search' 
            ? 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 60%)' 
            : 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 50%)',
        }}
        animate={{
          scale: cursorVariant === 'search' ? 1.5 : (cursorVariant === 'hover' ? 1.2 : 1),
        }}
        transition={{ type: 'spring', ...springConfig }}
      />
    </div>
  )
}
