'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface ChatFlowProps {
  onSearch: (query: string) => void
  disabled?: boolean
}

type FlowState = 'IDLE' | 'CLARIFYING' | 'SEARCHING'

async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number = 12000
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(input, { ...init, signal: controller.signal })
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

export function ChatFlow({ onSearch, disabled }: ChatFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>('IDLE')
  const [query, setQuery] = useState('')
  const [enrichedQuery, setEnrichedQuery] = useState('')
  const [isClarifyingLoading, setIsClarifyingLoading] = useState(false)
  
  // Clarification questions & answers
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [revealedIdx, setRevealedIdx] = useState(-1) // how many questions are visible
  const [isEnriching, setIsEnriching] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  
  // Trigger cascade reveal of questions
  useEffect(() => {
    if (flowState === 'CLARIFYING' && questions.length > 0) {
      if (revealedIdx < questions.length - 1) {
        const timer = setTimeout(() => {
          setRevealedIdx(prev => prev + 1)
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [flowState, questions, revealedIdx])

  async function handleInitialSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q || disabled) return
    
    setIsClarifyingLoading(true)
    setQuestions([])
    setAnswers({})
    setRevealedIdx(-1)

    try {
      const data = await fetchJsonWithTimeout(`${API}/api/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, user_id: 'demo' })
      })
      
      if (data.needs_clarification && data.questions && data.questions.length > 0) {
        setQuestions(data.questions)
        setFlowState('CLARIFYING')
      } else {
        // Go straight to searching
        triggerFinalSearch(q)
      }
    } catch {
      // Fail open on error
      triggerFinalSearch(q)
    } finally {
      setIsClarifyingLoading(false)
    }
  }

  async function handleEnrichSearch(e: React.FormEvent) {
    e.preventDefault()
    if (isEnriching) return
    setIsEnriching(true)
    
    try {
      const data = await fetchJsonWithTimeout(`${API}/api/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_query: query, answers })
      })
      const finalQ = data.enriched_query || query
      triggerFinalSearch(finalQ)
    } catch {
      triggerFinalSearch(query)
    } finally {
      setIsEnriching(false)
    }
  }

  function triggerFinalSearch(q: string) {
    setEnrichedQuery(q)
    setFlowState('SEARCHING')
    onSearch(q)
  }

  function handleReset() {
    setFlowState('IDLE')
    setQuery('')
    setEnrichedQuery('')
    setQuestions([])
    setAnswers({})
    setRevealedIdx(-1)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 10)
  }

  if (flowState === 'SEARCHING') {
    return (
      <motion.div layout layoutId="chatflow-container" className="flex flex-col items-center gap-4 w-full animate-fade-in-up">
        <motion.div 
          layout
          className="relative flex items-center gap-3 rounded-full px-5 py-2.5 shadow-lg overflow-hidden border border-purple-500/30 bg-black/50 backdrop-blur-md"
        >
          {/* Animated background glow */}
          <motion.div 
            animate={{ x: ['-100%', '100%'] }} 
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent w-1/2" 
          />
          <div className="relative z-10 flex items-center gap-2">
            {/* Audio Visualizer Sim */}
            <div className="flex items-end gap-1 h-4">
              {[1, 2, 3].map(i => (
                <motion.div 
                  key={i}
                  animate={{ height: ['4px', '16px', '4px'] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                  className="w-1 bg-purple-500 rounded-full"
                />
              ))}
            </div>
            <span className="text-sm font-medium" style={{ color: '#f5f5f5' }}>
              Synthesizing parameters for: <strong style={{ color: '#a78bfa' }}>{enrichedQuery}</strong>
            </span>
          </div>
        </motion.div>
        <button
          onClick={handleReset}
          className="text-xs transition-colors text-zinc-500 hover:text-purple-400"
        >
          [ ABORT ROUTINE ]
        </button>
      </motion.div>
    )
  }

  if (flowState === 'CLARIFYING') {
    return (
      <motion.div 
        layoutId="chatflow-container"
        className="relative w-full max-w-2xl mx-auto rounded-3xl p-6 shadow-2xl flex flex-col gap-6 overflow-hidden border border-white/5 bg-black/60 backdrop-blur-2xl"
      >
        {/* Terminal Matrix Overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

        {/* User original query */}
        <motion.div layout className="flex w-full justify-end relative z-10">
          <div 
            className="rounded-2xl rounded-tr-none px-4 py-2.5 text-sm"
            style={{ background: 'rgba(124,58,237,0.15)', color: '#d8b4fe', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            {query}
          </div>
        </motion.div>

        {/* Questions from agent */}
        <div className="flex flex-col gap-6 relative z-10">
          {/* Neural Tracer Trunk Path */}
          <div className="absolute left-4 top-8 bottom-0 w-px bg-gradient-to-b from-purple-500 via-purple-500/20 to-transparent -translate-x-1/2" />

          <form onSubmit={handleEnrichSearch} className="flex flex-col gap-6">
            <AnimatePresence>
              {questions.map((q, idx) => {
                if (idx > revealedIdx) return null
                return (
                  <motion.div 
                    key={idx} 
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="flex gap-4 relative"
                  >
                    {/* Node Dot on Tracer */}
                    <div className="absolute left-[-16px] top-4 w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_10px_#a855f7]" />

                    {/* Agent Avatar */}
                    <div 
                      className="flex shrink-0 h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-lg border border-purple-500/50"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff' }}
                    >
                      K
                    </div>
                    
                    {/* Question Bubble + Input */}
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <div 
                        className="rounded-2xl rounded-tl-none px-4 py-2.5 text-sm w-fit shadow-md border border-white/10 bg-white/5 backdrop-blur-sm text-zinc-200"
                      >
                        {q}
                      </div>

                      {/* User answer input */}
                      <input
                        type="text"
                        placeholder="[ ENTER DATA ]"
                        value={answers[q] || ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                        className="w-full max-w-md rounded-xl px-4 py-2.5 text-sm outline-none transition-all placeholder:text-zinc-600 focus:ring-1 focus:ring-purple-500/50 border border-white/5 bg-black/40 text-white"
                        autoFocus={idx === revealedIdx}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            
            {/* Submit button when all queries are shown */}
            {revealedIdx === questions.length - 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end pt-2"
              >
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={isEnriching}
                  className="group relative overflow-hidden rounded-xl px-6 py-2.5 text-sm font-bold text-black transition-opacity disabled:opacity-50 border border-white/10"
                  style={{ background: 'linear-gradient(135deg, #f5f5f5, #a3a3a3)' }}
                >
                  <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-[150%]" />
                  <span className="relative z-10 flex items-center gap-2">
                    {isEnriching ? 'Compiling...' : 'Execute Search'}
                    <span className="animate-pulse">_</span>
                  </span>
                </motion.button>
              </motion.div>
            )}
          </form>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.form 
      layoutId="chatflow-container"
      onSubmit={handleInitialSearch}
      className={`relative w-full max-w-2xl transition-opacity duration-300 ${disabled || isClarifyingLoading ? 'opacity-50' : 'opacity-100'}`}
    >
      <div className="relative group">
        {/* Conic Gradient Warp Border */}
        <div className="absolute -inset-[2px] rounded-full overflow-hidden blur-sm opacity-50 transition duration-500 group-hover:opacity-100">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
            className="absolute -inset-[100%] rounded-full bg-[conic-gradient(from_0deg,transparent_0%,transparent_50%,#8b5cf6_70%,#d8b4fe_100%)]" 
          />
        </div>
        
        {/* Core Input Layer */}
        <div className="relative flex items-center p-1.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl transition-all duration-300 focus-within:border-white/30 focus-within:bg-black/60">
          <div className="pl-5 pr-2 pointer-events-none">
            <span className="text-xl" style={{ filter: 'grayscale(0.6)' }}>🛍️</span>
          </div>
          
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent px-2 py-4 text-white text-lg outline-none placeholder:text-zinc-500 min-w-0"
            placeholder="Initialize query block..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled || isClarifyingLoading}
            autoFocus
          />
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={disabled || isClarifyingLoading || !query.trim()}
            className="shrink-0 mr-1 overflow-hidden relative group/btn rounded-full px-8 py-3.5 text-sm font-black text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #f5f5f5 0%, #a3a3a3 100%)',
              boxShadow: '0 4px 14px 0 rgba(255,255,255,0.1)'
            }}
          >
            {/* Liquid wipe effect inside button */}
            <div className="absolute inset-0 -translate-x-[150%] bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-500 ease-out group-hover/btn:translate-x-[150%]" />
            <span className="relative z-10 flex items-center gap-1">
              {isClarifyingLoading ? 'Processing' : 'Execute'} 
              <span className="animate-pulse">_</span>
            </span>
          </motion.button>
        </div>
      </div>
    </motion.form>
  )
}
