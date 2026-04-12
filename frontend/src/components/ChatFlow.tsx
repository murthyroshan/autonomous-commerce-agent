'use client'

import { useState, useRef, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface ChatFlowProps {
  onSearch: (query: string) => void
  disabled?: boolean
}

type FlowState = 'IDLE' | 'CLARIFYING' | 'SEARCHING'

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
      const res = await fetch(`${API}/api/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, user_id: 'demo' })
      })
      const data = await res.json()
      
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
      const res = await fetch(`${API}/api/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_query: query, answers })
      })
      const data = await res.json()
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
      <div className="flex flex-col items-center gap-4 w-full animate-fade-in-up">
        <div 
          className="flex items-center gap-3 rounded-full px-5 py-2.5 shadow-lg"
          style={{ background: '#111', border: '1px solid #7c3aed' }}
        >
          <span className="animate-spin-slow">✨</span>
          <span className="text-sm font-medium" style={{ color: '#f5f5f5' }}>
            Searching for: <strong style={{ color: '#a78bfa' }}>{enrichedQuery}</strong>
          </span>
        </div>
        <button
          onClick={handleReset}
          className="text-xs transition-colors"
          style={{ color: '#71717a' }}
          onMouseEnter={e => e.currentTarget.style.color = '#a78bfa'}
          onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
        >
          ← New search
        </button>
      </div>
    )
  }

  if (flowState === 'CLARIFYING') {
    return (
      <div 
        className="w-full max-w-2xl mx-auto rounded-3xl p-6 shadow-2xl flex flex-col gap-6 animate-fade-in-up"
        style={{ background: '#111', border: '1px solid #222' }}
      >
        {/* User original query */}
        <div className="flex w-full justify-end">
          <div 
            className="rounded-2xl rounded-tr-none px-4 py-2.5 text-sm"
            style={{ background: 'rgba(124,58,237,0.15)', color: '#d8b4fe', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            {query}
          </div>
        </div>

        {/* Questions from agent */}
        <div className="flex flex-col gap-6">
          <form onSubmit={handleEnrichSearch} className="flex flex-col gap-6">
            {questions.map((q, idx) => {
              if (idx > revealedIdx) return null
              return (
                <div key={idx} className="flex gap-3 animate-fade-in-up">
                  {/* Agent Avatar */}
                  <div 
                    className="flex shrink-0 h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff' }}
                  >
                    K
                  </div>
                  
                  {/* Question Bubble + Input */}
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div 
                      className="rounded-2xl rounded-tl-none px-4 py-2.5 text-sm w-fit shadow-md"
                      style={{ background: '#1a1a1a', color: '#f5f5f5', border: '1px solid #333' }}
                    >
                      {q}
                    </div>
                    {/* User answer input */}
                    <input
                      type="text"
                      placeholder="Type your answer..."
                      value={answers[q] || ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q]: e.target.value }))}
                      className="w-full max-w-md rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                      style={{ background: '#0a0a0a', color: '#f5f5f5', border: '1px solid #333' }}
                      onFocus={e => e.currentTarget.style.borderColor = '#7c3aed'}
                      onBlur={e => e.currentTarget.style.borderColor = '#333'}
                      autoFocus={idx === revealedIdx}
                    />
                  </div>
                </div>
              )
            })}
            
            {/* Submit button when all queries are shown */}
            {revealedIdx === questions.length - 1 && (
              <div className="flex justify-end pt-2 animate-fade-in-up">
                <button
                  type="submit"
                  disabled={isEnriching}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: '#f5f5f5', color: '#0a0a0a' }}
                >
                  {isEnriching ? 'Refining...' : 'Search now →'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    )
  }

  // IDLE state (Single Input)
  return (
    <form 
      onSubmit={handleInitialSearch}
      className={`relative w-full max-w-2xl transition-opacity duration-300 ${disabled || isClarifyingLoading ? 'opacity-50' : 'opacity-100'}`}
    >
      <div className="relative group">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 opacity-20 blur-md transition duration-500 group-hover:opacity-40" />
        <div className="relative flex items-center p-1 rounded-full bg-[#111111] border border-[#333333] shadow-2xl transition-all duration-300 focus-within:border-violet-500 focus-within:bg-[#161616]">
          <div className="pl-5 pr-2 pointer-events-none">
            <span className="text-xl" style={{ filter: 'grayscale(0.6)' }}>🛍️</span>
          </div>
          
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent px-2 py-4 text-[#f5f5f5] text-lg outline-none placeholder:text-[#52525b] min-w-0"
            placeholder="What are you looking for..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled || isClarifyingLoading}
            autoFocus
          />
          
          <button
            type="submit"
            disabled={disabled || isClarifyingLoading || !query.trim()}
            className="shrink-0 mr-2 rounded-full px-8 py-3.5 text-sm font-semibold text-[#0a0a0a] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 100%)',
              boxShadow: '0 4px 14px 0 rgba(255,255,255,0.1)'
            }}
          >
            {isClarifyingLoading ? 'Thinking...' : 'Search'}
          </button>
        </div>
      </div>
    </form>
  )
}
