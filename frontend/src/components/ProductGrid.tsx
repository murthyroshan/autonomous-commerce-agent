'use client'

import { ProductCard } from './ProductCard'
import type { ScoredProduct, Recommendation } from '@/hooks/useAgentStream'

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
          communitySentiment={recommendation?.community_sentiment}
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
