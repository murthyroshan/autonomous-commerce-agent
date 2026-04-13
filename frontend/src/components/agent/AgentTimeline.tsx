'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { colors, transitions } from '@/design-system/tokens'

const typeColors = {
  search: colors.accent.cyan,
  filter: colors.text.secondary,
  score: colors.accent.amber,
  decide: colors.accent.amber,
  done: colors.accent.cyan,
  error: colors.accent.red,
}

const typeIcons = {
  search: '⊕',
  filter: '⊘',
  score: '◈',
  decide: '◉',
  done: '✓',
  error: '⊗',
}

export function AgentTimeline() {
  const { timelineEvents } = useAppStore()

  if (!timelineEvents.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
      transition={transitions.spring}
      className="mx-auto w-full max-w-2xl"
    >
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: colors.border.default,
          background: colors.bg.surface1,
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: colors.border.default }}
        >
          <span
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            style={{ color: colors.text.muted }}
          >
            Agent Pipeline
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: colors.border.default }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1 p-4">
          <AnimatePresence initial={false}>
            {timelineEvents.map((event, idx) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -12, height: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, x: 0, height: 'auto', filter: 'blur(0px)' }}
                transition={transitions.spring}
                className="flex items-start gap-3 py-1.5"
              >
                <div className="mt-0.5 flex flex-col items-center gap-1">
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={transitions.springFast}
                    className="font-mono text-[14px] leading-none"
                    style={{ color: typeColors[event.type] }}
                  >
                    {event.status === 'active' ? (
                      <motion.span
                        animate={{ opacity: [1, 0.35, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        {typeIcons[event.type]}
                      </motion.span>
                    ) : (
                      typeIcons[event.type]
                    )}
                  </motion.span>
                  {idx < timelineEvents.length - 1 && (
                    <div
                      className="h-4 w-px"
                      style={{ background: colors.border.default }}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-[13px] leading-none"
                      style={{ color: colors.text.primary }}
                    >
                      {event.message}
                    </span>
                    {event.status === 'active' && (
                      <span className="dot-pulse ml-1 inline-flex gap-0">
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </div>
                  {event.detail && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="mt-0.5 truncate font-mono text-[11px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {event.detail}
                    </motion.p>
                  )}
                </div>

                <span
                  className="shrink-0 font-mono text-[10px]"
                  style={{ color: colors.text.muted }}
                >
                  {new Date(event.ts).toLocaleTimeString('en', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
