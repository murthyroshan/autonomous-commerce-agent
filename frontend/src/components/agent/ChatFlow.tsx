'use client'

import { FormEvent, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { colors, transitions } from '@/design-system/tokens'
import { StreamingText } from '@/components/agent/StreamingText'

interface ChatFlowProps {
  query: string
  questions: string[]
  loading?: boolean
  onSubmit: (answers: Record<string, string>) => void
}

export function ChatFlow({ query, questions, loading = false, onSubmit }: ChatFlowProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit(answers)
  }

  if (!questions.length) return null

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={transitions.spring}
      className="mx-auto w-full max-w-2xl rounded-2xl border p-4"
      style={{
        borderColor: colors.border.default,
        background: colors.bg.surface1,
      }}
    >
      <div className="mb-4 flex justify-end">
        <div
          className="rounded-2xl px-3 py-2 text-[13px]"
          style={{
            color: colors.text.primary,
            background: colors.bg.surface2,
            border: `1px solid ${colors.border.default}`,
          }}
        >
          {query}
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {questions.map((question) => (
            <motion.div
              key={question}
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={transitions.spring}
              className="space-y-2"
            >
              <div className="font-mono text-[12px]" style={{ color: colors.text.secondary }}>
                <StreamingText text={question} />
              </div>
              <input
                value={answers[question] ?? ''}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [question]: e.target.value }))
                }
                className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                style={{
                  borderColor: colors.border.default,
                  background: colors.bg.base,
                  color: colors.text.primary,
                }}
                placeholder="Type your answer..."
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl px-4 py-2 text-[13px] font-[500] transition-opacity disabled:opacity-50"
          style={{
            background: colors.accent.amber,
            color: colors.bg.base,
          }}
        >
          {loading ? 'Refining...' : 'Continue Search'}
        </button>
      </div>
    </motion.form>
  )
}
