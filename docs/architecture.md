# Architecture — Autonomous Commerce AI Agent

## System overview

```
User query (natural language)
        │
        ▼
┌─────────────────┐
│  Next.js UI     │  ← Phase 3+
│  (port 3000)    │
└────────┬────────┘
         │ SSE stream / POST
         ▼
┌─────────────────────────────────────────┐
│  FastAPI Backend (port 8000)            │
│                                         │
│  POST /api/search   → run_pipeline()    │
│  GET  /api/search/stream → SSE          │
│  POST /api/confirm  → Algorand tx       │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Agent Pipeline                         │
│                                         │
│  AgentState (shared TypedDict)          │
│       │                                 │
│  search_agent()   → Serper / Groq / Mock│
│       │                                 │
│  compare_agent()  → min-max scoring     │
│       │                                 │
│  decision_agent() → Groq LLM            │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  Algorand Testnet (Phase 4+)            │
│  PaymentTxn with JSON note              │
│  AlgoNode public endpoint (free)        │
└─────────────────────────────────────────┘
```

## Data flow

### Search flow
1. User submits query "gaming laptop under ₹80,000"
2. Frontend opens `EventSource` to `/api/search/stream?query=...`
3. Backend streams status events as each agent runs
4. Final `result` event contains full scored product list + recommendation
5. Frontend renders product cards, highlights winner

### Purchase confirmation flow
1. User clicks "Confirm Purchase" on recommended product
2. Frontend POSTs product details to `/api/confirm`
3. Backend calls `record_purchase_intent()` (Phase 4+)
4. Algorand testnet transaction created with product details in note field
5. Frontend shows tx_id + explorer link

## AgentState contract

All agents share a single `AgentState` TypedDict:

| Field | Type | Set by |
|-------|------|--------|
| `query` | `str` | `initial_state()` |
| `search_results` | `list[dict]` | `search_agent` |
| `scored_products` | `list[dict]` | `compare_agent` |
| `recommendation` | `dict` | `decision_agent` |
| `error` | `Optional[str]` | any agent on failure |

**Rule:** Agents return partial dicts. The pipeline merges them with `state.update()`.
Agents never call each other directly.

## Scoring formula

```
price_norm    = 1 - (price - min_price) / (max_price - min_price)
rating_norm   = (rating - min_rating) / (max_rating - min_rating)
review_norm   = (reviews - min_reviews) / (max_reviews - min_reviews)

score = 0.45 × price_norm + 0.35 × rating_norm + 0.20 × review_norm
```

Edge case: if all values in a dimension are equal, assign 1.0 to all.

## Data source tiers

| Tier | Source | Cost | Reliability |
|------|--------|------|-------------|
| 1 | Serper.dev `/shopping` | 2,500 free, then $1/1K | High |
| 2 | Groq Compound (web search) | Free | Medium |
| 3 | Mock dataset | Free | 100% |

Tier 1 is tried first. On failure (after 3 retries with exponential backoff),
falls to Tier 2. If Tier 2 also fails, falls to Tier 3.
`state["error"]` is set whenever a fallback is used, so the UI can warn the user.

## Phase gating

| Phase | New components | Prerequisite |
|-------|---------------|--------------|
| 1 | 3 agents + FastAPI + mock data | Nothing |
| 2 | Serper.dev + retry logic | SERPER_API_KEY |
| 3 | Next.js UI + SSE | Phase 2 working |
| 4 | Algorand testnet tx | ALGORAND_MNEMONIC funded |
| 5 | PyTeal contract + Pera wallet | Phase 4 working |
| 6 | JSON prefs + history | Phase 3 working |
