'use client'

import { ProductCard } from './ProductCard'
import type { ScoredProduct, Recommendation } from '@/hooks/useAgentStream'

interface ProductGridProps {
  products: ScoredProduct[]
  recommendation: Recommendation | null
}

export function ProductGrid({ products, recommendation }: ProductGridProps) {
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
