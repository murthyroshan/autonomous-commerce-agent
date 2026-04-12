'use client'

import { ProductCard } from './ProductCard'
import type { ScoredProduct } from '@/hooks/useAgentStream'

interface ProductGridProps {
  products: ScoredProduct[]
}

export function ProductGrid({ products }: ProductGridProps) {
  if (!products || products.length === 0) return null

  // Winner is first with highest score (already sorted by backend)
  const [winner, ...rest] = products

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <ProductCard key={winner.title + winner.price} product={winner} isWinner />
      {rest.map((product) => (
        <ProductCard
          key={product.title + product.price}
          product={product}
          isWinner={false}
        />
      ))}
    </div>
  )
}
