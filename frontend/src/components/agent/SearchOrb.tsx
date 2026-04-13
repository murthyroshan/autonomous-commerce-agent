'use client'

import { motion, useAnimation } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { colors, transitions } from '@/design-system/tokens'

type OrbState = 'idle' | 'listening' | 'searching' | 'comparing' | 'done' | 'error'

const orbColors: Record<OrbState, string> = {
  idle: 'rgba(232,160,69,0.5)',
  listening: 'rgba(232,160,69,0.7)',
  searching: 'rgba(0,212,170,0.6)',
  comparing: 'rgba(0,212,170,0.8)',
  done: '#e8a045',
  error: 'rgba(255,77,77,0.6)',
}

const orbSizes: Record<OrbState, number> = {
  idle: 120,
  listening: 140,
  searching: 100,
  comparing: 90,
  done: 110,
  error: 100,
}

const quickQueries = [
  { query: 'Gaming laptop under \u20b960,000', hint: 'Performance + value' },
  { query: 'OnePlus 13', hint: 'Flagship smartphone' },
  { query: 'Earbuds under \u20b93,000', hint: 'Best budget audio' },
  { query: 'Sony 4K TV under \u20b950,000', hint: 'Big-screen deals' },
  { query: 'Mechanical keyboard', hint: 'Gaming and typing picks' },
]

export function SearchOrb({ onSearch }: { onSearch: (q: string) => void }) {
  const { agentState } = useAppStore()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const controls = useAnimation()

  const orbState: OrbState =
    agentState === 'idle'
      ? 'idle'
      : agentState === 'searching'
        ? 'searching'
        : agentState === 'comparing' || agentState === 'deciding'
          ? 'comparing'
          : agentState === 'done'
            ? 'done'
            : agentState === 'error'
              ? 'error'
              : 'listening'

  useEffect(() => {
    if (orbState === 'idle') {
      void controls.start({
        scale: [1, 1.06, 1],
        opacity: [0.6, 0.9, 0.6],
        transition: {
          duration: 2.8,
          repeat: Infinity,
          repeatType: 'mirror',
        },
      })
      return
    }

    if (orbState === 'searching') {
      void controls.start({
        rotate: [0, 360],
        scale: [1, 1.1, 0.95, 1.05, 1],
        opacity: 0.95,
        transition: {
          rotate: { duration: 1.3, repeat: Infinity, ease: 'linear' },
          scale: { duration: 0.6, repeat: Infinity },
        },
      })
      return
    }

    if (orbState === 'done') {
      void controls.start({
        scale: [1, 1.3, 0.95, 1.02, 1],
        opacity: [1, 1, 1, 1, 1],
        transition: { duration: 0.45 },
      })
      return
    }

    void controls.start({
      scale: 1,
      rotate: 0,
      opacity: 0.9,
      transition: transitions.spring,
    })
  }, [controls, orbState])

  const handleSubmit = (value?: string) => {
    const next = (value ?? query).trim()
    if (!next) return
    setQuery(next)
    onSearch(next)
  }

  return (
    <div className="relative flex w-full flex-col items-center gap-6">
      <div
        className="relative cursor-pointer"
        onClick={() => inputRef.current?.focus()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            inputRef.current?.focus()
          }
        }}
      >
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 1.2 + i * 0.15, 1],
              opacity: [0.15 / i, 0.05 / i, 0.15 / i],
            }}
            transition={{
              duration: 2.4 + i * 0.4,
              repeat: Infinity,
              repeatType: 'mirror',
              delay: i * 0.35,
            }}
            style={{
              position: 'absolute',
              inset: `-${i * 20}px`,
              borderRadius: '50%',
              border: `1px solid ${orbColors[orbState]}`,
            }}
          />
        ))}

        <motion.div
          animate={controls}
          style={{
            width: orbSizes[orbState],
            height: orbSizes[orbState],
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${orbColors[orbState]}, rgba(232,160,69,0.08) 70%)`,
            border: `1px solid ${orbColors[orbState]}`,
            backdropFilter: 'blur(20px)',
          }}
          className="relative flex items-center justify-center"
          transition={{
            width: transitions.spring,
            height: transitions.spring,
          }}
        >
          {orbState === 'searching' && (
            <motion.div
              className="absolute inset-0 overflow-hidden rounded-full"
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute h-1 w-1 rounded-full"
                  style={{
                    background: colors.accent.cyan,
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${i * 60}deg) translateX(${orbSizes[orbState] * 0.35}px)`,
                  }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border bg-[#111110] transition-all duration-200 ${
          focused ? 'border-run' : ''
        }`}
        style={{
          borderColor: focused ? 'rgba(232,160,69,0.4)' : colors.border.default,
          background: colors.bg.surface1,
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Find the best gaming laptop under \u20b960,000..."
          disabled={['searching', 'comparing'].includes(orbState)}
          className="w-full bg-transparent px-5 py-4 text-[15px] font-[400] tracking-[-0.01em] outline-none placeholder-[#444440] disabled:opacity-50"
          style={{ color: colors.text.primary }}
        />
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => handleSubmit()}
          disabled={!query.trim() || ['searching', 'comparing'].includes(orbState)}
          className="absolute right-2 top-1/2 h-9 -translate-y-1/2 rounded-xl px-5 text-[13px] font-[500] transition-all duration-150 disabled:opacity-40"
          style={{
            background: query.trim() ? colors.accent.amber : colors.border.default,
            color: query.trim() ? colors.bg.base : colors.text.muted,
          }}
        >
          {['searching', 'comparing'].includes(orbState) ? (
            <span className="dot-pulse flex gap-0">
              <span />
              <span />
              <span />
            </span>
          ) : (
            'Search'
          )}
        </motion.button>
      </div>

      {orbState === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {quickQueries.map(({ query: quickQuery, hint }) => (
            <button
              key={quickQuery}
              onClick={() => {
                setQuery(quickQuery)
                onSearch(quickQuery)
              }}
              className="
                group w-full rounded-xl border px-4 py-3 text-left
                bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)]
                hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(232,160,69,0.4)]
                transition-all duration-200
              "
            >
              <p className="font-mono text-[12px] text-[#f2f2f0] tracking-[0.01em] leading-snug">
                {quickQuery}
              </p>
              <p className="mt-1 text-[11px] text-[#888884] group-hover:text-[#c2c2be] transition-colors">
                {hint}
              </p>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}