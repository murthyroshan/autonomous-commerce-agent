import { create } from 'zustand'

export type AgentStatus =
  | 'idle'
  | 'clarifying'
  | 'searching'
  | 'comparing'
  | 'deciding'
  | 'done'
  | 'error'

interface TimelineEvent {
  id: string
  type: 'search' | 'filter' | 'score' | 'decide' | 'done' | 'error'
  message: string
  detail?: string
  status: 'pending' | 'active' | 'done' | 'error'
  ts: number
}

interface Product {
  title: string
  price: number
  rating: number
  review_count: number
  source: string
  link: string
  image_url?: string
  score: number
  relevance_score: number
  primary_badge?: unknown
  secondary_badges?: unknown[]
  preference_boosted?: boolean
  price_suspicious?: boolean
  rating_verified?: boolean
  has_real_rating?: boolean
}

interface Recommendation extends Product {
  justification: string
  rank: number
  total_compared: number
}

interface SearchResult {
  query: string
  scored_products: Product[]
  recommendation: Recommendation | null
  error?: string
  weight_mode?: string
}

interface AppStore {
  agentState: AgentStatus
  query: string
  streamStatus: string
  timelineEvents: TimelineEvent[]
  result: SearchResult | null
  error: string | null
  setQuery: (q: string) => void
  setAgentState: (s: AgentStatus) => void
  setStreamStatus: (s: string) => void
  addTimelineEvent: (e: Omit<TimelineEvent, 'id' | 'ts'>) => void
  updateLastEvent: (update: Partial<TimelineEvent>) => void
  setResult: (r: SearchResult) => void
  setError: (e: string | null) => void
  reset: () => void
}

let eventCounter = 0

export const useAppStore = create<AppStore>((set) => ({
  agentState: 'idle',
  query: '',
  streamStatus: '',
  timelineEvents: [],
  result: null,
  error: null,

  setQuery: (q) => set({ query: q }),
  setAgentState: (s) => set({ agentState: s }),
  setStreamStatus: (s) => set({ streamStatus: s }),

  addTimelineEvent: (e) =>
    set((state) => ({
      timelineEvents: [
        ...state.timelineEvents,
        { ...e, id: `evt_${++eventCounter}`, ts: Date.now() },
      ],
    })),

  updateLastEvent: (update) =>
    set((state) => {
      const events = [...state.timelineEvents]
      if (events.length === 0) return {}
      events[events.length - 1] = { ...events[events.length - 1], ...update }
      return { timelineEvents: events }
    }),

  setResult: (r) => set({ result: r, agentState: 'done' }),
  setError: (e) => set({ error: e, agentState: 'error' }),

  reset: () =>
    set({
      agentState: 'idle',
      query: '',
      streamStatus: '',
      timelineEvents: [],
      result: null,
      error: null,
    }),
}))

export type { Product, Recommendation, SearchResult, TimelineEvent }
