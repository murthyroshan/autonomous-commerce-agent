'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { ScoredProduct } from '@/hooks/useAgentStream'

interface ProductCardProps {
  product: ScoredProduct
  isWinner?: boolean
}

function sourceColor(source: string): string {
  const lower = source.toLowerCase()
  if (lower.includes('amazon')) return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300'
  if (lower.includes('flipkart')) return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rating ${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) return <span key={i} className="text-amber-400 text-sm">★</span>
        if (i === full && half) return <span key={i} className="text-amber-400 text-sm opacity-60">★</span>
        return <span key={i} className="text-gray-300 dark:text-gray-600 text-sm">★</span>
      })}
      <span className="ml-1 text-xs text-muted-foreground font-medium">{rating.toFixed(1)}</span>
    </span>
  )
}

export function ProductCard({ product, isWinner = false }: ProductCardProps) {
  const scorePercent = Math.round(product.score * 100)

  return (
    <Card
      className={`relative flex flex-col gap-0 overflow-hidden transition-shadow hover:shadow-lg ${
        isWinner
          ? 'border-2 border-blue-500 shadow-blue-100 dark:shadow-blue-900/30'
          : 'border'
      }`}
    >
      {isWinner && (
        <div className="absolute top-0 right-0">
          <Badge
            className="rounded-none rounded-bl-lg rounded-tr-none bg-blue-500 text-white text-xs px-2 py-0.5"
          >
            ✦ Recommended
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <a
            href={product.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-3"
          >
            {product.title}
          </a>
        </div>

        <Badge
          variant="outline"
          className={`mt-1 w-fit text-xs font-medium ${sourceColor(product.source)}`}
        >
          {product.source}
        </Badge>
      </CardHeader>

      <CardContent className="px-4 pb-4 flex flex-col gap-2 flex-1">
        {/* Price */}
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
          ₹{product.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <RatingStars rating={product.rating} />
          <span className="text-xs text-muted-foreground">
            ({product.review_count.toLocaleString()} reviews)
          </span>
        </div>

        {/* Score bar */}
        <div className="mt-auto pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium">AI Score</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {scorePercent}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
