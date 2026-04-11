# Autonomous Commerce AI Agent

An AI-powered shopping assistant that takes a natural-language query, searches Google Shopping, scores and compares products, and generates a recommendation. Confirmed purchases are logged as transactions on the Algorand blockchain.

## Demo flow

```
"Find me the best gaming laptop under ₹80,000"
        ↓
Search agent   → Serper.dev Google Shopping (live Indian results)
        ↓
Compare agent  → Min-max normalized scoring (price, rating, reviews)
        ↓
Decision agent → Groq LLM recommendation with justification
        ↓
UI             → Ranked product cards, winner highlighted
        ↓
Confirm        → Algorand testnet transaction logged
```

## Quick start

```bash
# 1. Enter the folder
cd autonomous-commerce-agent

# 2. Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env
# Edit .env — add SERPER_API_KEY and GROQ_API_KEY (both free, see below)

# 5. Run the API server
uvicorn api.main:app --reload --port 8000

# 6. Test it
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "gaming laptop under 80000"}'
```

## Free API keys needed

| Key | Where to get | Cost |
|-----|-------------|------|
| `SERPER_API_KEY` | [serper.dev](https://serper.dev) — sign up, no credit card | 2,500 free searches |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) — sign up | Free tier |

No keys? Set `MOCK_ONLY=true` in `.env` to run entirely on hardcoded sample data.

## Run tests

```bash
MOCK_ONLY=true python -m pytest tests/ -v
# Expected: 45 passed
```

## Project structure

```
autonomous-commerce-agent/
├── CLAUDE.md              ← AI coding assistant context (read this first)
├── IMPLEMENTATION.md      ← Phase-by-phase build plan with code templates
├── README.md              ← You are here
├── .env.example           ← Environment variable reference
├── requirements.txt
├── pytest.ini
├── agents/
│   ├── state.py           ← AgentState TypedDict (shared data bus)
│   ├── mock_data.py       ← Fallback product data (no API needed)
│   ├── search_agent.py    ← Serper.dev → Groq → mock fallback chain
│   ├── compare_agent.py   ← Normalized scoring logic
│   ├── decision_agent.py  ← Groq LLM justification
│   └── pipeline.py        ← Orchestrates all three agents
├── api/
│   ├── main.py            ← FastAPI app entry point
│   ├── routes.py          ← /search, /search/stream (SSE), /confirm
│   └── models.py          ← Pydantic request/response models
├── blockchain/
│   └── algorand.py        ← Algorand testnet payment logging (Phase 4)
├── tests/
│   ├── test_agents.py     ← Unit tests for each agent
│   ├── test_pipeline.py   ← Integration tests for full pipeline
│   └── test_api.py        ← FastAPI endpoint tests
├── docs/
│   └── architecture.md    ← System diagram and data flow
└── frontend/              ← Next.js UI (Phase 3 — see frontend/SETUP.md)
```

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/search` | Full pipeline, single JSON response |
| `GET` | `/api/search/stream?query=...` | SSE streaming — live agent status |
| `POST` | `/api/confirm` | Log purchase to Algorand testnet |

Interactive docs at `http://localhost:8000/docs` when the server is running.

## Build phases

| Phase | What gets built | Status |
|-------|----------------|--------|
| 1 | Agent pipeline + FastAPI + mock data | Ready to run |
| 2 | Serper.dev live data + retry logic | Needs SERPER_API_KEY |
| 3 | Next.js frontend + SSE streaming | See frontend/SETUP.md |
| 4 | Algorand testnet payment logging | Needs ALGORAND_MNEMONIC |
| 5 | PyTeal smart contract + Pera wallet | After Phase 4 |
| 6 | User preferences + purchase history | After Phase 3 |

## Tech stack

- **Backend:** Python 3.11, FastAPI, Pydantic v2
- **Agents:** Plain Python functions + optional LangGraph (see `pipeline.py`)
- **LLM:** Groq API — llama-3.3-70b-versatile (free tier)
- **Product data:** Serper.dev Google Shopping API
- **Blockchain:** Algorand testnet via py-algorand-sdk + AlgoNode (free)
- **Frontend:** Next.js 14, Tailwind CSS, shadcn/ui (Phase 3)

## For AI coding assistants

Read `CLAUDE.md` first — it contains the architecture rules, coding conventions,
and the exact next steps for whichever phase you are implementing.
