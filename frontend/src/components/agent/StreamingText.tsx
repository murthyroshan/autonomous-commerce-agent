'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { colors } from '@/design-system/tokens'

interface StreamingTextProps {
  text: string
  speed?: number
  className?: string
  onDone?: () => void
}

export function StreamingText({
  text,
  speed = 18,
  className = '',
  onDone,
}: StreamingTextProps) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1))
        i += 1
      } else {
        clearInterval(interval)
        setDone(true)
        onDone?.()
      }
    }, speed)
    return () => clearInterval(interval)
  }, [onDone, speed, text])

  return (
    <span className={className}>
      {displayed}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
          className="ml-[1px] inline-block h-[1em] w-[2px] align-middle"
          style={{ background: colors.accent.amber }}
        />
      )}
    </span>
  )
}
