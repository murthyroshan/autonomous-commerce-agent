'use client'
import { useState }      from 'react'
import { motion }        from 'framer-motion'
import { buildShareUrl, copyToClipboard } from '@/lib/share'

interface ShareButtonProps {
  query:         string
  recommendation: any
  totalCompared: number
}

export function ShareButton({
  query, recommendation, totalCompared
}: ShareButtonProps) {
  const [state, setState] = useState<
    'idle' | 'copied' | 'error'
  >('idle')

  const handleShare = async () => {
    const url = buildShareUrl({
      query,
      winner: {
        title:        recommendation.title,
        price:        recommendation.price,
        source:       recommendation.source,
        link:         recommendation.link,
        score:        recommendation.score,
        justification: recommendation.justification,
        rating:       recommendation.rating,
        review_count: recommendation.review_count,
      },
      total_compared: totalCompared,
      timestamp:      new Date().toISOString(),
    })

    const success = await copyToClipboard(url)
    setState(success ? 'copied' : 'error')
    setTimeout(() => setState('idle'), 2500)
  }

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={handleShare}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-xl
        text-[12px] font-mono border
        transition-all duration-150
        ${state === 'copied'
          ? 'bg-[rgba(0,212,170,0.08)] border-[rgba(0,212,170,0.2)] text-[#00d4aa]'
          : state === 'error'
          ? 'bg-[rgba(255,77,77,0.08)] border-[rgba(255,77,77,0.2)] text-[#ff4d4d]'
          : 'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] text-[#888884] hover:text-[#f2f2f0] hover:border-[rgba(255,255,255,0.14)]'
        }
      `}
    >
      {state === 'copied' ? (
        <>
          <span>✓</span>
          Link copied
        </>
      ) : state === 'error' ? (
        <>
          <span>⚠</span>
          Failed to copy
        </>
      ) : (
        <>
          <span>↗</span>
          Share result
        </>
      )}
    </motion.button>
  )
}
