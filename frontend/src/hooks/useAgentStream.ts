'use client'

import { useState, useEffect, useRef } from 'react'

export interface ScoredProduct {
  title: string
  price: number
  rating: number
  review_count: number
  source: string
  link: string
  score: number
  /** True when Serper/Groq returned an actual rating (not defaulted) */
  rating_verified?: boolean
  /** Raw signal from Serper — false means rating was missing in API response */
  has_real_rating?: boolean
}

export interface Recommendation extends ScoredProduct {
  justification: string
  rank: number
  total_compared: number
}

export interface StreamResult {
  type: 'result'
  query: string
  scored_products: ScoredProduct[]
  recommendation: Recommendation | null
  error: string | null
}

export function useAgentStream(query: string | null) {
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<StreamResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query) return
    let isActive = true
    let usedFallback = false

    // Close any existing connection
    if (esRef.current) {
      esRef.current.close()
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setLoading(true)
    setResult(null)
    setStatus('')
    setStreamError(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
    const url = `${apiUrl}/api/search/stream?query=${encodeURIComponent(query)}`
    const es = new EventSource(url)
    esRef.current = es

    const runFallbackSearch = async (reason: string) => {
      if (usedFallback || !isActive) return
      usedFallback = true
      setStatus('Live stream interrupted. Retrying...')
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 25000)
        const res = await fetch(`${apiUrl}/api/search?user_id=demo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!isActive) return
        setResult({
          type: 'result',
          query: data.query ?? query,
          scored_products: data.scored_products ?? [],
          recommendation: data.recommendation ?? null,
          error: data.error ?? null,
        })
        setStreamError(reason)
        setLoading(false)
      } catch {
        if (!isActive) return
        setStreamError('Connection to agent server failed. Is the API running?')
        setLoading(false)
      }
    }

    const armTimeout = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        runFallbackSearch('Live stream timed out. Loaded fallback response.')
        es.close()
      }, 30000)
    }

    armTimeout()

    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        armTimeout()
        if (data.type === 'result') {
          setResult(data as StreamResult)
          setLoading(false)
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          es.close()
        } else if (data.type === 'error') {
          setStreamError(data.message)
          setStatus(data.message)
          setLoading(false)
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          es.close()
        } else if (data.type === 'status') {
          setStatus(data.message)
        }
      } catch {
        // non-JSON frame — ignore
      }
    }

    es.onerror = () => {
      // EventSource doesn't give detailed errors, but if it fires, we lost connection or failed to connect.
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      es.close()
      runFallbackSearch('Live stream disconnected. Loaded fallback response.')
    }

    return () => {
      isActive = false
      es.close()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [query])

  return { status, result, loading, streamError }
}
