'use client'

import { AnimatePresence, motion } from 'framer-motion'

interface CompareDrawerProps {
  items: any[]
  open: boolean
  onClose: () => void
  onRemove: (title: string) => void
}

export function CompareDrawer({
  items,
  open,
  onClose,
  onRemove,
}: CompareDrawerProps) {
  const fields = [
    {
      key: 'price',
      label: 'Price',
      fmt: (v: number) => `₹${v.toLocaleString('en-IN')}`,
      better: 'lower',
    },
    {
      key: '_adj_rating',
      label: 'Adj. rating',
      fmt: (v: number) => (v > 0 ? `${v.toFixed(1)}★` : 'N/A'),
      better: 'higher',
    },
    {
      key: 'review_count',
      label: 'Reviews',
      fmt: (v: number) => v.toLocaleString(),
      better: 'higher',
    },
    {
      key: 'score',
      label: 'Score',
      fmt: (v: number) => `${Math.round(v * 100)}%`,
      better: 'higher',
    },
    {
      key: 'relevance_score',
      label: 'Relevance',
      fmt: (v: number) => `${Math.round((v ?? 0) * 100)}%`,
      better: 'higher',
    },
  ]

  const getBest = (field: (typeof fields)[0]) => {
    const vals = items.map((p) => Number(p[field.key] ?? 0))
    return field.better === 'lower' ? Math.min(...vals) : Math.max(...vals)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[rgba(0,0,0,0.7)] backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="
              fixed bottom-0 left-0 right-0 z-50
              rounded-t-3xl border-t
              border-[rgba(255,255,255,0.08)]
              bg-[rgba(17,17,16,0.95)] backdrop-blur-2xl
              max-h-[75vh] overflow-auto
            "
            style={{ boxShadow: '0 -20px 60px rgba(0,0,0,0.5)' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
            </div>

            <div className="px-6 pb-10">
              <div className="flex items-center justify-between mb-6 mt-2">
                <h3 className="font-display text-[20px] font-[600] tracking-[-0.03em]">
                  Compare
                </h3>
                <button
                  onClick={onClose}
                  className="text-[#888884] hover:text-[#f2f2f0] transition-colors text-[18px] w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[rgba(255,255,255,0.06)]"
                >
                  ✕
                </button>
              </div>

              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `160px repeat(${items.length}, 1fr)`,
                }}
              >
                {/* Labels */}
                <div className="space-y-3 pt-20">
                  {fields.map((f) => (
                    <div key={f.key} className="h-11 flex items-center">
                      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#888884]">
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Product columns */}
                {items.map((product, i) => (
                  <div key={i} className="space-y-3">
                    <div className="relative p-3 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]">
                      <button
                        onClick={() => onRemove(product.title)}
                        className="absolute top-2 right-2 text-[#444440] hover:text-[#f2f2f0] transition-colors text-[12px] w-5 h-5 flex items-center justify-center"
                      >
                        ✕
                      </button>
                      <p className="text-[12px] font-[500] text-[#f2f2f0] leading-tight line-clamp-2 pr-5">
                        {product.title}
                      </p>
                    </div>

                    {fields.map((f) => {
                      const val = Number(product[f.key] ?? 0)
                      const best = getBest(f)
                      const isBest = val === best

                      return (
                        <div
                          key={f.key}
                          className={`
                            h-11 flex items-center px-3 rounded-xl
                            font-mono text-[13px]
                            transition-colors
                            ${isBest ? 'bg-[rgba(0,212,170,0.08)] text-[#00d4aa]' : 'text-[#888884]'}
                          `}
                        >
                          {f.fmt(val)}
                          {isBest && <span className="ml-1.5 text-[10px]">✦</span>}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
