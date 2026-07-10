'use client'

import { useEffect, useState } from 'react'
import { ProductCard } from './ProductCard'
import type { ScoredProduct, Recommendation } from '@/hooks/useAgentStream'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-white/5 p-5 min-h-[280px] flex flex-col gap-3">
      {/* Source badge + Recommended badge row */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 rounded-full bg-white/10" />
        <div className="h-5 w-28 rounded-full bg-white/10" />
      </div>
      {/* Title */}
      <div className="h-6 w-3/4 rounded bg-white/10" />
      <div className="h-4 w-1/2 rounded bg-white/10" />
      {/* Price */}
      <div className="mt-auto h-7 w-24 rounded bg-white/10" />
      {/* Rating row */}
      <div className="h-4 w-36 rounded bg-white/10" />
      {/* Button placeholder */}
      <div className="h-10 w-full rounded-xl bg-white/10" />
    </div>
  )
}

interface ProductGridProps {
  products: ScoredProduct[]
  recommendation: Recommendation | null
  loading?: boolean
}

export function ProductGrid({ products, recommendation, loading = false }: ProductGridProps) {
  // Community sentiment is fetched lazily (the backend no longer blocks the
  // search on it). Seed from the recommendation for backward compatibility.
  const winnerTitle = products?.[0]?.title
  const [sentiment, setSentiment] = useState<string | null>(
    recommendation?.community_sentiment ?? null,
  )

  useEffect(() => {
    if (!winnerTitle) return
    // If the payload already carried it (older backend), don't refetch.
    if (recommendation?.community_sentiment) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSentiment(recommendation.community_sentiment)
      return
    }
    let active = true
    // Intentional reset: clear the previous winner's sentiment before the new
    // fetch resolves, so stale text isn't shown during the request.
    setSentiment(null)
    const params = new URLSearchParams({ title: winnerTitle })
    fetch(`${API}/api/community-sentiment?${params}`)
      .then(r => r.json())
      .then((d: { community_sentiment?: string | null }) => {
        if (active) setSentiment(d.community_sentiment ?? null)
      })
      .catch(() => {
        if (active) setSentiment(null)
      })
    return () => {
      active = false
    }
  }, [winnerTitle, recommendation?.community_sentiment])

  // Show skeleton placeholders while loading and no products yet
  if (loading && (!products || products.length === 0)) {
    return (
      <div>
        <p className="mb-6 text-center text-sm" style={{ color: '#52525b' }}>
          Searching and comparing products…
        </p>
        <div className="mb-6">
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!products || products.length === 0) return null

  // Winner is first (already sorted by backend)
  const [winner, ...rest] = products

  const total = products.length

  return (
    <div>
      {/* Section heading */}
      <p
        className="mb-6 text-center text-sm"
        style={{ color: '#52525b' }}
      >
        Compared {total} product{total !== 1 ? 's' : ''} · Best match first
      </p>

      {/* Winner card — full width */}
      <div className="mb-6">
        <ProductCard
          key={`product-0`}
          product={winner}
          isWinner
          index={0}
          justification={recommendation?.justification}
          communitySentiment={sentiment ?? undefined}
          allProducts={products}
        />
      </div>

      {/* Remaining grid */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((product, i) => (
            <ProductCard
              key={`product-${i + 1}`}
              product={product}
              isWinner={false}
              index={i + 1}
              allProducts={products}
            />
          ))}
        </div>
      )}
    </div>
  )
}
