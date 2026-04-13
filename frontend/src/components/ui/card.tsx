'use client'
import { motion, HTMLMotionProps } from 'framer-motion'
import { useRef, useCallback } from 'react'
import { cardReveal } from '@/design-system/animations'

interface CardProps extends HTMLMotionProps<'div'> {
  spotlight?: boolean
  winner?: boolean
  delay?: number
}

export function Card({
  children,
  spotlight = true,
  winner = false,
  delay = 0,
  className = '',
  ...props
}: CardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!spotlight || !ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      ref.current.style.setProperty('--mouse-x', `${x}%`)
      ref.current.style.setProperty('--mouse-y', `${y}%`)
    },
    [spotlight]
  )

  return (
    <motion.div
      ref={ref}
      variants={cardReveal}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      onMouseMove={handleMouseMove}
      className={`
        relative rounded-[12px] p-5
        bg-[#111110] border
        transition-all duration-200
        ${spotlight ? 'spotlight' : ''}
        ${
          winner
            ? 'border-[rgba(232,160,69,0.35)] shadow-[0_0_0_1px_rgba(232,160,69,0.15),0_0_40px_rgba(232,160,69,0.06)]'
            : 'border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.10)]'
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  )
}
