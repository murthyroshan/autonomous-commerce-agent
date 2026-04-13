'use client'

import { useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { Product, Recommendation, SearchResult } from '@/stores/appStore'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export type ScoredProduct = Product
export type { Recommendation, SearchResult }

export function useAgentStream() {
  const {
    setAgentState,
    setStreamStatus,
    addTimelineEvent,
    updateLastEvent,
    setResult,
    setError,
    reset,
    setQuery,
  } = useAppStore()

  const search = useCallback(
    async (query: string) => {
      reset()
      setQuery(query)
      setAgentState('searching')

      addTimelineEvent({
        type: 'search',
        message: 'Connecting to search agent',
        status: 'active',
      })

      const url = `${API}/api/search/stream?query=${encodeURIComponent(query)}`
      const es = new EventSource(url)

      es.onmessage = (e) => {
        const data = JSON.parse(e.data)

        if (data.type === 'status') {
          setStreamStatus(data.message)

          if (data.message.includes('Searching')) {
            updateLastEvent({ status: 'done', message: 'Search agent connected' })
            addTimelineEvent({
              type: 'search',
              message: data.message,
              detail: 'Querying Serper Google Shopping API',
              status: 'active',
            })
          } else if (data.message.includes('Comparing')) {
            updateLastEvent({ status: 'done' })
            setAgentState('comparing')
            const count = data.message.match(/\d+/)?.[0] ?? '?'
            addTimelineEvent({
              type: 'score',
              message: `Scoring ${count} products`,
              detail: 'Price 38% · Rating 28% · Reviews 16% · Relevance 18%',
              status: 'active',
            })
          } else if (
            data.message.includes('quality') ||
            data.message.includes('Filtering')
          ) {
            updateLastEvent({ status: 'done' })
            addTimelineEvent({
              type: 'filter',
              message: 'Applying quality filters',
              detail: 'Removing accessories, fake prices, duplicates',
              status: 'active',
            })
          } else if (
            data.message.includes('recommendation') ||
            data.message.includes('Generating')
          ) {
            updateLastEvent({ status: 'done' })
            setAgentState('deciding')
            addTimelineEvent({
              type: 'decide',
              message: 'Decision agent reasoning',
              detail: 'Groq LLM generating recommendation',
              status: 'active',
            })
          }
        } else if (data.type === 'result') {
          updateLastEvent({ status: 'done' })
          addTimelineEvent({
            type: 'done',
            message: `Found ${data.scored_products?.length ?? 0} products`,
            detail: `Winner: ${data.recommendation?.title?.slice(0, 50) ?? 'N/A'}`,
            status: 'done',
          })
          setResult(data as SearchResult)
          es.close()
        } else if (data.type === 'error') {
          updateLastEvent({ status: 'error' })
          addTimelineEvent({
            type: 'error',
            message: data.message,
            status: 'error',
          })
          setError(data.message)
          es.close()
        }
      }

      es.onerror = () => {
        updateLastEvent({ status: 'error' })
        setError('Connection failed')
        es.close()
      }

      return () => es.close()
    },
    [
      addTimelineEvent,
      reset,
      setAgentState,
      setError,
      setQuery,
      setResult,
      setStreamStatus,
      updateLastEvent,
    ]
  )

  return { search }
}
