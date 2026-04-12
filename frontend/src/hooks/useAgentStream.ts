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

  useEffect(() => {
    if (!query) return

    // Close any existing connection
    if (esRef.current) {
      esRef.current.close()
    }

    setLoading(true)
    setResult(null)
    setStatus('')
    setStreamError(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
    const url = `${apiUrl}/api/search/stream?query=${encodeURIComponent(query)}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'result') {
          setResult(data as StreamResult)
          setLoading(false)
          es.close()
        } else if (data.type === 'error') {
          setStreamError(data.message)
          setStatus(data.message)
          setLoading(false)
          es.close()
        } else if (data.type === 'status') {
          setStatus(data.message)
        }
      } catch {
        // non-JSON frame — ignore
      }
    }

    es.onerror = () => {
      setLoading(false)
      es.close()
    }

    return () => {
      es.close()
    }
  }, [query])

  return { status, result, loading, streamError }
}
