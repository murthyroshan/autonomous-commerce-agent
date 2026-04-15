'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface SocialProofData {
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral'
  sentiment_emoji: string
  highlights: string[]
  source_count: number
  reddit_url: string | null
  youtube_url: string | null
}

const sentimentStyle: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  positive: {
    color:  '#34d399',
    bg:     'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.25)',
    label:  'Positive buzz',
  },
  negative: {
    color:  '#f87171',
    bg:     'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.25)',
    label:  'Negative buzz',
  },
  mixed: {
    color:  '#fbbf24',
    bg:     'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.25)',
    label:  'Mixed buzz',
  },
  neutral: {
    color:  '#a1a1aa',
    bg:     'rgba(161,161,170,0.06)',
    border: 'rgba(161,161,170,0.2)',
    label:  'Community signals',
  },
}

interface Props {
  title: string
  query?: string
}

export function SocialProofPanel({ title, query = '' }: Props) {
  const [data, setData]       = useState<SocialProofData | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(false)

  useEffect(() => {
    if (!title) return
    setLoading(true)
    const params = new URLSearchParams({ title, query })
    fetch(`${API}/api/social-proof?${params}`)
      .then(r => r.json())
      .then((d: SocialProofData) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [title, query])

  const style = sentimentStyle[data?.sentiment ?? 'neutral']

  return (
    <div className="mt-3 w-full">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(p => !p)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition-all"
        style={{
          background: style.bg,
          border:     `1px solid ${style.border}`,
          color:      style.color,
        }}
        onMouseEnter={e =>
          (e.currentTarget.style.background = style.bg.replace('0.08', '0.13'))
        }
        onMouseLeave={e =>
          (e.currentTarget.style.background = style.bg)
        }
      >
        <span className="flex items-center gap-1.5 font-semibold">
          {loading ? (
            <span className="animate-pulse">Loading community signals…</span>
          ) : (
            <>
              <span>{data?.sentiment_emoji ?? '⚪'}</span>
              <span>{style.label}</span>
              {data && data.source_count > 0 && (
                <span style={{ color: style.color, opacity: 0.7 }}>
                  ({data.source_count} sources)
                </span>
              )}
            </>
          )}
        </span>
        {!loading && (
          <span style={{ opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
        )}
      </button>

      {/* Expandable body */}
      <AnimatePresence>
        {open && data && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="mt-1 rounded-xl p-3 text-xs"
              style={{
                background: style.bg,
                border:     `1px solid ${style.border}`,
              }}
            >
              {/* Highlights */}
              {data.highlights.length > 0 ? (
                <ul className="space-y-2">
                  {data.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 leading-relaxed" style={{ color: '#a1a1aa' }}>
                      <span style={{ color: style.color, flexShrink: 0 }}>›</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: '#52525b' }}>No community highlights found.</p>
              )}

              {/* Link row */}
              {(data.reddit_url || data.youtube_url) && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {data.reddit_url && (
                    <a
                      href={data.reddit_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity"
                      style={{
                        background: 'rgba(255,87,0,0.12)',
                        color:      '#ff5700',
                        border:     '1px solid rgba(255,87,0,0.3)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      Reddit thread →
                    </a>
                  )}
                  {data.youtube_url && (
                    <a
                      href={data.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity"
                      style={{
                        background: 'rgba(255,0,0,0.10)',
                        color:      '#f87171',
                        border:     '1px solid rgba(255,0,0,0.25)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      YouTube review →
                    </a>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
