'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ProductCard } from './ProductCard'
import { CompareDrawer } from './CompareDrawer'

interface ProductGridProps {
  products: any[]
  recommendation: any
  query: string
  totalCompared?: number
}

export function ProductGrid({
  products,
  recommendation,
  query,
  totalCompared,
}: ProductGridProps) {
  const [compareItems, setCompareItems] = useState<any[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  const addToCompare = (product: any) => {
    if (compareItems.find((p) => p.title === product.title)) return
    const next =
      compareItems.length >= 3
        ? [...compareItems.slice(1), product]
        : [...compareItems, product]
    setCompareItems(next)
    setDrawerOpen(true)
  }

  const winner = recommendation
  const others = products.filter((p) => p.title !== winner?.title)

  return (
    <div className="w-full space-y-8">
      {/* Winner — full width, prominent */}
      {winner && (
        <ScrollRevealSection>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-[#e8a045]"
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#e8a045]">
                Best match
              </span>
              <div className="flex-1 h-px bg-[rgba(232,160,69,0.15)]" />
              <span className="font-mono text-[11px] text-[#444440]">
                1 of {products.length}
              </span>
            </div>
            <ProductCard
              product={winner}
              winner
              index={0}
              onCompare={addToCompare}
            />
          </div>
        </ScrollRevealSection>
      )}

      {/* Others grid */}
      {others.length > 0 && (
        <ScrollRevealSection delay={0.1}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#444440]">
                All results
              </span>
              <div className="flex-1 h-px bg-[rgba(255,255,255,0.04)]" />
              {compareItems.length > 0 && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="
                    font-mono text-[11px] text-[#888884]
                    hover:text-[#f2f2f0] transition-colors
                    flex items-center gap-1.5
                  "
                >
                  <span>⊞</span>
                  Compare ({compareItems.length})
                </button>
              )}
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((product, i) => (
                <ProductCard
                  key={`${product.title}-${i}`}
                  product={product}
                  winner={false}
                  index={i + 1}
                  onCompare={addToCompare}
                />
              ))}
            </div>
          </div>
        </ScrollRevealSection>
      )}

      {/* Compare drawer */}
      <CompareDrawer
        items={compareItems}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRemove={(title) =>
          setCompareItems(compareItems.filter((p) => p.title !== title))
        }
      />
    </div>
  )
}

/* Helper — scroll reveal wrapper */
function ScrollRevealSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!ref.current || visible) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true)
      },
      { threshold: 0.1 }
    )
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [visible])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{
        delay,
        type: 'spring',
        stiffness: 260,
        damping: 24,
      }}
    >
      {children}
    </motion.div>
  )
}
