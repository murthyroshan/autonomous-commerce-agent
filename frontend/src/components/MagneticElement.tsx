'use client'

import React, { useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useGlobalState } from '@/store/globalStore'

export function MagneticElement({
  children,
  strength = 0.2,
  variant = 'magnetic',
  className = ''
}: {
  children: React.ReactNode
  strength?: number
  variant?: 'magnetic' | 'hover' | 'search'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { setCursorVariant } = useGlobalState()
  
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  
  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 })
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 })

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const { clientX, clientY } = e
    const { height, width, left, top } = ref.current.getBoundingClientRect()
    const middleX = clientX - (left + width / 2)
    const middleY = clientY - (top + height / 2)
    x.set(middleX * strength)
    y.set(middleY * strength)
  }

  const reset = () => {
    x.set(0)
    y.set(0)
    setCursorVariant('default')
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      onMouseEnter={() => setCursorVariant(variant)}
      style={{ x: springX, y: springY }}
      className={`relative z-50 ${className}`}
    >
      {children}
    </motion.div>
  )
}
