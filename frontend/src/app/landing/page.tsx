'use client'

import { motion, AnimatePresence, useInView } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'

const DEMO_QUERIES = [
  { q: 'gaming laptop under ₹60,000', cat: 'laptop' },
  { q: 'OnePlus 13', cat: 'phone' },
  { q: 'wireless earbuds under ₹3,000', cat: 'earbuds' },
  { q: 'Sony 4K TV under ₹50,000', cat: 'tv' },
  { q: 'mechanical keyboard', cat: 'keyboard' },
] as const

type Category = (typeof DEMO_QUERIES)[number]['cat']

type GhostProduct = {
  title: string
  price: number
  rating: number
  score: number
  source: string
}

const MOCK_RESULTS: Record<Category, GhostProduct[]> = {
  laptop: [
    {
      title: 'ASUS TUF Gaming A15',
      price: 58990,
      rating: 4.4,
      score: 0.89,
      source: 'Amazon',
    },
    {
      title: 'HP Victus 15',
      price: 54999,
      rating: 4.2,
      score: 0.82,
      source: 'Flipkart',
    },
    {
      title: 'Lenovo IdeaPad Gaming 3',
      price: 62990,
      rating: 4.1,
      score: 0.71,
      source: 'Croma',
    },
  ],
  phone: [
    {
      title: 'OnePlus 13 5G 16GB/512GB',
      price: 69999,
      rating: 4.6,
      score: 0.94,
      source: 'OnePlus Store',
    },
    {
      title: 'Samsung Galaxy S24',
      price: 74999,
      rating: 4.3,
      score: 0.81,
      source: 'Amazon',
    },
    {
      title: 'Google Pixel 9',
      price: 79999,
      rating: 4.5,
      score: 0.76,
      source: 'Flipkart',
    },
  ],
  earbuds: [
    {
      title: 'Nothing CMF Buds 2a',
      price: 2499,
      rating: 4.7,
      score: 0.91,
      source: 'Amazon',
    },
    {
      title: 'boAt Airdopes 141',
      price: 1299,
      rating: 4.1,
      score: 0.84,
      source: 'Amazon',
    },
    {
      title: 'OnePlus Nord Buds 3r',
      price: 1999,
      rating: 4.4,
      score: 0.79,
      source: 'Flipkart',
    },
  ],
  tv: [
    {
      title: 'Sony Bravia X74L 55"',
      price: 79990,
      rating: 4.5,
      score: 0.88,
      source: 'Sony Store',
    },
    {
      title: 'Samsung Crystal 4K 55"',
      price: 62990,
      rating: 4.3,
      score: 0.82,
      source: 'Amazon',
    },
    {
      title: 'LG NanoCell 55"',
      price: 74990,
      rating: 4.4,
      score: 0.78,
      source: 'Croma',
    },
  ],
  keyboard: [
    {
      title: 'Keychron K2 Pro',
      price: 8499,
      rating: 4.7,
      score: 0.92,
      source: 'Amazon',
    },
    {
      title: 'Royal Kludge RK84',
      price: 4999,
      rating: 4.4,
      score: 0.85,
      source: 'Flipkart',
    },
    {
      title: 'Logitech MX Keys',
      price: 9999,
      rating: 4.6,
      score: 0.81,
      source: 'Amazon',
    },
  ],
}

const GITHUB_URL = 'https://github.com/yourusername/kartiq'

function ProblemSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  const problems = [
    {
      before: 'You spend 2+ hours comparing products across tabs',
      after: 'Kartiq does it in under 10 seconds',
      icon: '⏱',
    },
    {
      before: 'Review scores are gamed, fake, and untrustworthy',
      after: 'We validate ratings against review volume confidence',
      icon: '★',
    },
    {
      before: 'You forget what you paid and when',
      after: 'Every purchase logged immutably on Algorand blockchain',
      icon: '⛓',
    },
    {
      before: 'Budget ignored — results always over your price',
      after: 'Budget enforced at every layer, not just filtered later',
      icon: '₹',
    },
  ]

  return (
    <section ref={ref} className="px-8 py-24 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        className="space-y-4 mb-16 text-center"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#888884]">
          The problem
        </span>
        <h2 className="font-display text-[42px] font-[600] tracking-[-0.04em] text-[#f2f2f0]">
          Online shopping is broken.
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {problems.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, type: 'spring', stiffness: 280, damping: 24 }}
            className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111110] p-5 space-y-3"
          >
            <span className="text-[24px]">{p.icon}</span>
            <p className="text-[14px] text-[#888884] line-through leading-relaxed">{p.before}</p>
            <p className="text-[14px] text-[#00d4aa] font-[500] leading-relaxed">→ {p.after}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function HowItWorksSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const steps = [
    {
      num: '01',
      title: 'You describe it',
      detail:
        'Type anything. Budget, brand, specs. Natural language. The agent understands.',
      color: '#e8a045',
      tech: 'Groq Llama 3 intent parsing',
    },
    {
      num: '02',
      title: 'Agent searches',
      detail:
        'Hits Google Shopping via Serper. Pulls 20–50 real products from Amazon, Flipkart, and official stores.',
      color: '#00d4aa',
      tech: 'Serper.dev Google Shopping API',
    },
    {
      num: '03',
      title: 'Quality filter',
      detail: 'Removes accessories, fake prices, and suspicious listings. What you see is real.',
      color: '#888884',
      tech: 'Price sanity · relevance filter · dedup',
    },
    {
      num: '04',
      title: 'Scores everything',
      detail:
        'Multi-dimensional normalized scoring: price, rating confidence, reviews, relevance, trust tier.',
      color: '#e8a045',
      tech: 'Min-max normalization · badge engine',
    },
    {
      num: '05',
      title: 'AI recommends',
      detail:
        'Groq LLM explains exactly why the winner is the best — aware of store trust, price anomalies, and your preferences.',
      color: '#00d4aa',
      tech: 'Groq llama-3.3-70b-versatile',
    },
    {
      num: '06',
      title: 'Blockchain proof',
      detail:
        'Confirm the purchase. Your decision is logged on Algorand testnet — immutable, permanent, verifiable.',
      color: '#7c6af7',
      tech: 'Algorand · PyTeal · Pera Wallet',
    },
  ]

  return (
    <section id="how" ref={ref} className="px-8 py-24 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        className="text-center space-y-4 mb-16"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#888884]">
          How it works
        </span>
        <h2 className="font-display text-[42px] font-[600] tracking-[-0.04em] text-[#f2f2f0]">
          Six steps. Zero effort.
        </h2>
      </motion.div>

      <div className="relative">
        <div className="absolute left-[27px] top-8 bottom-8 w-px bg-[rgba(255,255,255,0.06)]" />

        <div className="space-y-3">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 26 }}
              className="flex gap-5 items-start"
            >
              <div
                className="w-[54px] h-[54px] rounded-full shrink-0 flex items-center justify-center border font-mono text-[13px] font-[500] bg-[#111110] z-10"
                style={{
                  borderColor: `${step.color}40`,
                  color: step.color,
                }}
              >
                {step.num}
              </div>

              <div className="flex-1 p-4 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111110] hover:border-[rgba(255,255,255,0.10)] transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h3 className="text-[15px] font-[600] tracking-[-0.02em] text-[#f2f2f0] mb-1">
                      {step.title}
                    </h3>
                    <p className="text-[13px] text-[#888884] leading-relaxed">{step.detail}</p>
                  </div>
                  <span
                    className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-[0.04em] border self-start"
                    style={{
                      color: step.color,
                      borderColor: `${step.color}30`,
                      background: `${step.color}10`,
                    }}
                  >
                    {step.tech}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const features = [
    {
      icon: '◈',
      title: 'Multi-dimensional scoring',
      body: 'Price, confidence-adjusted rating, review volume, query relevance, store trust — all normalized and weighted. Not just sorting by price.',
      accent: '#e8a045',
    },
    {
      icon: '⊘',
      title: 'Data quality filter',
      body: 'Removes accessories, fake prices 35%+ below median, duplicate listings, and irrelevant products before you ever see them.',
      accent: '#00d4aa',
    },
    {
      icon: '◎',
      title: 'Price watchlist',
      body: 'Set a target price. The agent checks daily and alerts you the moment it drops. Silent, automatic, accurate.',
      accent: '#e8a045',
    },
    {
      icon: '⊕',
      title: 'Exact model matching',
      body: 'Search "OnePlus 13" and get the OnePlus 13 — not the 13R, 13S, or 13T. Relevance scoring penalizes variant matches.',
      accent: '#00d4aa',
    },
    {
      icon: '⛓',
      title: 'Blockchain receipts',
      body: 'Every confirmed purchase is a real Algorand transaction. Immutable proof of what you decided and when.',
      accent: '#7c6af7',
    },
    {
      icon: '◉',
      title: 'Preference memory',
      body: 'Tell it once — "I prefer Sony" or "never refurbished". It remembers and adjusts every future recommendation.',
      accent: '#e8a045',
    },
    {
      icon: '⊞',
      title: 'Side-by-side compare',
      body: 'Pin any two or three products. See every dimension head-to-head. Best values highlighted automatically.',
      accent: '#00d4aa',
    },
    {
      icon: '✦',
      title: 'Trust badge engine',
      body: 'Official store, trusted retailer, or unverified seller — every product is classified and scored accordingly.',
      accent: '#7c6af7',
    },
  ]

  return (
    <section id="features" ref={ref} className="px-8 py-24 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        className="text-center space-y-4 mb-16"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#888884]">
          Features
        </span>
        <h2 className="font-display text-[42px] font-[600] tracking-[-0.04em] text-[#f2f2f0]">
          Built different.
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.06 }}
            className="p-4 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111110] hover:border-[rgba(255,255,255,0.10)] transition-colors group spotlight"
          >
            <span className="text-[22px] mb-3 block" style={{ color: f.accent }}>
              {f.icon}
            </span>
            <h3 className="text-[14px] font-[600] text-[#f2f2f0] tracking-[-0.02em] mb-2">{f.title}</h3>
            <p className="text-[12px] text-[#888884] leading-relaxed">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function TechSection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  const stack = [
    { name: 'Python 3.11', role: 'Backend' },
    { name: 'FastAPI', role: 'API' },
    { name: 'Groq', role: 'LLM' },
    { name: 'Serper.dev', role: 'Search' },
    { name: 'Algorand', role: 'Blockchain' },
    { name: 'PyTeal', role: 'Smart contract' },
    { name: 'Next.js 14', role: 'Frontend' },
    { name: 'Framer Motion', role: 'Animation' },
    { name: 'ChromaDB', role: 'Memory' },
  ]

  return (
    <section ref={ref} className="px-8 py-20 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        className="text-center mb-10"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#888884]">
          Built with
        </span>
      </motion.div>
      <div className="flex flex-wrap justify-center gap-3">
        {stack.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: i * 0.05 }}
            className="px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.14)] transition-colors"
          >
            <span className="text-[13px] font-[500] text-[#f2f2f0] tracking-[-0.01em]">{s.name}</span>
            <span className="text-[11px] text-[#888884] font-mono ml-2">{s.role}</span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function FinalCTA() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section ref={ref} className="px-8 py-32 text-center max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="space-y-8"
      >
        <h2 className="font-display text-[56px] font-[600] tracking-[-0.05em] leading-[1.05] text-[#f2f2f0]">
          Your AI shopping agent
          <br />
          <span className="text-[#e8a045]">is ready.</span>
        </h2>
        <p className="text-[16px] text-[#888884] leading-relaxed">
          No sign up. No credit card. Two free API keys and you&apos;re running a production-grade autonomous agent.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="px-8 py-4 rounded-xl text-[15px] font-[600] bg-[#e8a045] text-[#0a0a09] hover:bg-[#f0ae52] transition-colors tracking-[-0.01em] w-full sm:w-auto text-center"
          >
            Try Kartiq free →
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-xl text-[15px] font-[500] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.10)] text-[#888884] hover:text-[#f2f2f0] transition-all tracking-[-0.01em] w-full sm:w-auto text-center"
          >
            View on GitHub
          </a>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.3 }}
        className="mt-20 pt-8 border-t border-[rgba(255,255,255,0.06)] flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 font-mono text-[11px] text-[#333330]"
      >
        <span>Kartiq © 2026</span>
        <Link href="/" className="hover:text-[#888884] transition-colors">
          App
        </Link>
        <Link href="/history" className="hover:text-[#888884] transition-colors">
          History
        </Link>
        <Link href="/watchlist" className="hover:text-[#888884] transition-colors">
          Watchlist
        </Link>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#888884] transition-colors">
          GitHub
        </a>
      </motion.div>
    </section>
  )
}

export default function LandingPage() {
  const [queryIdx, setQueryIdx] = useState(0)
  const [typedQuery, setTypedQuery] = useState('')
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const query = DEMO_QUERIES[queryIdx].q
    let i = 0
    setTypedQuery('')
    setShowResults(false)

    let showResultsTimeout: ReturnType<typeof setTimeout> | undefined
    let cycleTimeout: ReturnType<typeof setTimeout> | undefined

    const typeInterval = setInterval(() => {
      if (i < query.length) {
        setTypedQuery(query.slice(0, i + 1))
        i++
      } else {
        clearInterval(typeInterval)
        showResultsTimeout = setTimeout(() => setShowResults(true), 400)
        cycleTimeout = setTimeout(() => {
          setQueryIdx((idx) => (idx + 1) % DEMO_QUERIES.length)
        }, 3500)
      }
    }, 60)

    return () => {
      clearInterval(typeInterval)
      if (showResultsTimeout) clearTimeout(showResultsTimeout)
      if (cycleTimeout) clearTimeout(cycleTimeout)
    }
  }, [queryIdx])

  const currentCat = DEMO_QUERIES[queryIdx].cat
  const currentResults = MOCK_RESULTS[currentCat] ?? []

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0a0a09]">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-8 py-5 border-b border-[rgba(255,255,255,0.04)] bg-[rgba(10,10,9,0.85)] backdrop-blur-xl">
        <span className="font-display text-[18px] font-[600] tracking-[-0.02em]">Kartiq</span>
        <div className="flex items-center gap-3 sm:gap-8">
          <a href="#how" className="text-[12px] sm:text-[13px] text-[#888884] hover:text-[#f2f2f0] transition-colors">
            How it works
          </a>
          <a href="#features" className="text-[12px] sm:text-[13px] text-[#888884] hover:text-[#f2f2f0] transition-colors">
            Features
          </a>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl text-[13px] font-[500] bg-[#e8a045] text-[#0a0a09] hover:bg-[#f0ae52] transition-colors whitespace-nowrap"
          >
            Try it free →
          </Link>
        </div>
      </nav>

      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-24 sm:pt-20 pb-16 gap-12 sm:gap-16">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] font-mono text-[11px] uppercase tracking-[0.08em] text-[#888884]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
          AI-powered · Blockchain-secured · Free to try
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 280, damping: 24 }}
          className="text-center space-y-4 max-w-4xl px-2"
        >
          <h1 className="font-display text-[clamp(2.25rem,6vw,4.5rem)] font-[600] tracking-[-0.05em] leading-[0.95] text-[#f2f2f0]">
            Stop comparing.
            <br />
            <span className="text-[#e8a045]">Start buying smarter.</span>
          </h1>
          <p className="text-[16px] sm:text-[18px] text-[#888884] leading-relaxed tracking-[-0.01em] max-w-xl mx-auto">
            Kartiq is an autonomous AI agent that searches every major platform, scores every product, and tells you
            exactly what to buy — with proof on the blockchain.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-3xl space-y-4"
        >
          <div className="relative flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 px-5 py-4 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[#111110]">
            <span className="text-[#444440] text-[14px] shrink-0">⌕</span>
            <span className="flex-1 min-w-0 text-[14px] sm:text-[15px] text-[#f2f2f0] tracking-[-0.01em] cursor-blink break-words">
              {typedQuery || <span className="text-[#444440]">Type a product query...</span>}
            </span>
            <span className="px-3 py-1.5 rounded-lg text-[12px] font-[500] bg-[rgba(232,160,69,0.12)] text-[#e8a045] border border-[rgba(232,160,69,0.2)] whitespace-nowrap shrink-0">
              AI Searching…
            </span>
          </div>

          <AnimatePresence mode="wait">
            {showResults && (
              <motion.div
                key={queryIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {currentResults.map((product, i) => (
                  <motion.div
                    key={`${queryIdx}-${product.title}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`rounded-xl p-3 border ${
                      i === 0
                        ? 'border-[rgba(232,160,69,0.25)] bg-[#18181a]'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#18181a]'
                    }`}
                  >
                    {i === 0 && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-1 h-1 rounded-full bg-[#e8a045]" />
                        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#e8a045]">
                          Best match
                        </span>
                      </div>
                    )}
                    <p className="text-[12px] font-[500] text-[#f2f2f0] leading-tight line-clamp-2 mb-2">{product.title}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[13px] text-[#f2f2f0]">
                        ₹{product.price.toLocaleString('en-IN')}
                      </span>
                      <span
                        className="font-mono text-[10px] shrink-0"
                        style={{ color: product.score > 0.85 ? '#00d4aa' : '#e8a045' }}
                      >
                        {Math.round(product.score * 100)}%
                      </span>
                    </div>
                    <div className="mt-2 h-[2px] bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(product.score * 100)}%` }}
                        transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
                        className="h-full rounded-full"
                        style={{
                          background: product.score > 0.85 ? '#00d4aa' : '#e8a045',
                        }}
                      />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            href="/"
            className="px-6 py-3 rounded-xl text-[14px] font-[500] bg-[#e8a045] text-[#0a0a09] hover:bg-[#f0ae52] transition-colors w-full sm:w-auto text-center"
          >
            Try Kartiq free →
          </Link>
          <a
            href="#how"
            className="px-6 py-3 rounded-xl text-[14px] font-[500] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-[#888884] hover:text-[#f2f2f0] transition-all w-full sm:w-auto text-center"
          >
            How it works
          </a>
        </motion.div>

        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-[#333330] text-[12px] font-mono"
        >
          ↓ scroll
        </motion.div>
      </section>

      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <TechSection />
      <FinalCTA />
    </main>
  )
}
