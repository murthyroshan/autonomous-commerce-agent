'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { AlertCircle, Sparkles, Target } from 'lucide-react'

interface ExplainDrawerProps {
  product: any
  allProducts: any[]
  isWinner?: boolean
  open: boolean
  onClose: () => void
}

interface LoserReason {
  primary: string;
  stats: string[];
}

function getLosingReason(loser: any, winner: any): LoserReason {
  const priceDiff = loser.price - winner.price
  const ratingDiff = (loser.rating ?? 0) - (winner.rating ?? 0)
  const reviewDiff = (loser.review_count ?? 0) - (winner.review_count ?? 0)

  let primary = `Lower overall match score`
  if (priceDiff > 5000) primary = `₹${priceDiff.toLocaleString('en-IN')} more expensive`
  else if ((loser.review_count ?? 0) < 50) primary = `Only ${loser.review_count} reviews (low confidence)`
  else if ((loser.relevance_score ?? 0) < 0.4) primary = `Poor match for your query`
  else if (loser.trust_tier === 'unknown') primary = `Unverified seller`
  else if (loser.price_suspicious) primary = `Suspicious price detected`

  const stats: string[] = []
  if (priceDiff !== 0) stats.push(`Price: ${winner.price.toLocaleString('en-IN')} → ${loser.price.toLocaleString('en-IN')} (+₹${priceDiff.toLocaleString('en-IN')})`)
  if (ratingDiff !== 0) stats.push(`Rating: ${winner.rating ?? 'N/A'} → ${loser.rating ?? 'N/A'} (${ratingDiff > 0 ? '+' : ''}${ratingDiff.toFixed(1)})`)
  if (reviewDiff !== 0) stats.push(`Reviews: ${winner.review_count ?? 0} → ${loser.review_count ?? 0} (${reviewDiff > 0 ? '+' : ''}${reviewDiff})`)

  return { primary, stats }
}

export function ExplainDrawer({ product, allProducts, isWinner = false, open, onClose }: ExplainDrawerProps) {
  if (!open || !product || !allProducts) return null

  const [activeTab, setActiveTab] = useState<'overview' | 'competitors'>('overview')

  const validProducts = allProducts.filter(p => p.score_breakdown)
  const avgScores = {
    price: validProducts.reduce((acc, p) => acc + (p.score_breakdown?.price_score ?? 0), 0) / (validProducts.length || 1),
    rating: validProducts.reduce((acc, p) => acc + (p.score_breakdown?.rating_score ?? 0), 0) / (validProducts.length || 1),
    reviews: validProducts.reduce((acc, p) => acc + (p.score_breakdown?.review_score ?? 0), 0) / (validProducts.length || 1),
    relevance: validProducts.reduce((acc, p) => acc + (p.relevance_score ?? 0), 0) / (validProducts.length || 1),
  }

  const chartData = [
    { dimension: 'Price', score: Math.round((product.score_breakdown?.price_score ?? 0) * 100), average: Math.round(avgScores.price * 100), fullMark: 100 },
    { dimension: 'Rating', score: Math.round((product.score_breakdown?.rating_score ?? 0) * 100), average: Math.round(avgScores.rating * 100), fullMark: 100 },
    { dimension: 'Reviews', score: Math.round((product.score_breakdown?.review_score ?? 0) * 100), average: Math.round(avgScores.reviews * 100), fullMark: 100 },
    { dimension: 'Relevance', score: Math.round((product.relevance_score ?? 0) * 100), average: Math.round(avgScores.relevance * 100), fullMark: 100 },
    { dimension: 'Trust', score: Math.round((product.trust_multiplier ?? 1) * 80), average: 80, fullMark: 100 },
  ]

  const losers = allProducts.filter(p => p.title !== product.title).slice(0, 3)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-md transition-all duration-300"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border-t border-[rgba(255,255,255,0.1)] bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full"
          onClick={e => e.stopPropagation()}
        >
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-[rgba(255,255,255,0.1)]" />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-wide text-[#f2f2f0]">
              <Sparkles size={18} className="text-[#e8a045]" />
              Why {product.title.length > 25 ? product.title.slice(0, 25) + '...' : product.title}?
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[#888884] transition-all hover:bg-[rgba(255,255,255,0.15)] hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Tab Bar */}
          {isWinner && (
            <div className="mb-4 flex space-x-4 border-b border-[rgba(255,255,255,0.1)]">
              <button
                className={`pb-2 ${activeTab === 'overview' ? 'border-b-2 border-[#e8a045] text-[#e8a045]' : 'text-[#a1a1aa]'} transition-colors`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`pb-2 ${activeTab === 'competitors' ? 'border-b-2 border-[#e8a045] text-[#e8a045]' : 'text-[#a1a1aa]'} transition-colors`}
                onClick={() => setActiveTab('competitors')}
              >
                Why others lost
              </button>
            </div>
          )}

          {/* Content */}
          {(!isWinner || activeTab === 'overview') && (
            <div className="mb-6 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(26,26,26,0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                      padding: '10px',
                    }}
                    itemStyle={{ color: '#e8a045', fontWeight: 600 }}
                  />
                  <Radar
                    name="Batch Average"
                    dataKey="average"
                    stroke="rgba(255,255,255,0.2)"
                    fill="transparent"
                    strokeWidth={2}
                    dot={{ fill: 'rgba(255,255,255,0.5)', r: 2 }}
                  />
                  <Radar
                    name={product.title.slice(0, 15) + '...'}
                    dataKey="score"
                    stroke="#e8a045"
                    fill="rgba(232,160,69,0.12)"
                    strokeWidth={2}
                    dot={{ fill: '#e8a045', r: 3 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex items-center justify-center gap-6 text-xs font-medium text-[#a1a1aa]">
                <div className="flex items-center gap-2 rounded-full border border-[rgba(232,160,69,0.2)] bg-[rgba(232,160,69,0.05)] px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-[#e8a045] shadow-[0_0_8px_rgba(232,160,69,0.8)]" />
                  <span className="text-[#e8a045]">This Product</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] px-3 py-1">
                  <span className="h-2 w-2 rounded-full border border-[rgba(255,255,255,0.5)] bg-transparent" />
                  <span>Batch Average</span>
                </div>
              </div>
            </div>
          )}

          {isWinner && activeTab === 'competitors' && (
            <div>
              <div className="my-6 h-px w-full bg-[rgba(255,255,255,0.05)]" />
              {losers.map((loser, i) => {
                const reason = getLosingReason(loser, product)
                return (
                  <div
                    key={i}
                    className="group flex items-start gap-4 rounded-xl border border-[rgba(255,255,255,0.03)] bg-[rgba(255,255,255,0.02)] p-5 transition-all duration-300 hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                  >
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)] text-red-400 group-hover:bg-[rgba(239,68,68,0.15)] group-hover:shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-all">
                      <AlertCircle size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 text-sm font-semibold text-[#f2f2f0] group-hover:text-white transition-colors">
                        {loser.title.length > 50 ? loser.title.slice(0, 50) + '...' : loser.title}
                      </div>
                      <div className="mb-4 text-sm font-medium text-red-400/90">{reason.primary}</div>
                      <div className="flex flex-wrap gap-2">
                        {reason.stats.map(stat => (
                          <span
                            key={stat}
                            className="rounded border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#888884] group-hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                          >
                            {stat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
