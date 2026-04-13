# AGENTS.md â€” Autonomous Commerce AI Agent

## Project identity

This is an **Autonomous Commerce AI Agent** â€” a personal shopping assistant that takes a
natural-language query ("Find me the best gaming laptop under â‚¹80,000"), searches Google
Shopping via Serper.dev, compares and scores products using min-max normalization, and
produces an AI-generated recommendation. Confirmed purchases are logged as transactions on
the Algorand testnet.

**Stack at a glance**
- Backend: Python 3.11 + FastAPI + LangGraph (state machine)
- Agents: three plain Python functions â€” search, compare, decision
- LLM: Groq API (llama-3.3-70b-versatile) â€” free tier, no cost during dev
- Product data: Serper.dev Google Shopping API (2,500 free searches on signup)
- Blockchain: Algorand testnet via py-algorand-sdk (Phase 4+)
- Frontend: Next.js 14 + Tailwind + shadcn/ui (Phase 3+)

---

## Repository layout

```
autonomous-commerce-agent/
â”œâ”€â”€ AGENTS.md              â† YOU ARE HERE â€” read this first
â”œâ”€â”€ IMPLEMENTATION.md      â† full phase-by-phase plan
â”œâ”€â”€ .env.example           â† all required env vars with descriptions
â”œâ”€â”€ requirements.txt       â† Python dependencies
â”œâ”€â”€ agents/
â”‚   â”œâ”€â”€ __init__.py
â”‚   â”œâ”€â”€ state.py           â† AgentState TypedDict (shared data bus)
â”‚   â”œâ”€â”€ search_agent.py    â† Serper.dev â†’ product list
â”‚   â”œâ”€â”€ compare_agent.py   â† min-max scoring, no LLM needed
â”‚   â”œâ”€â”€ decision_agent.py  â† Groq LLM justification
â”‚   â”œâ”€â”€ mock_data.py       â† hardcoded fallback products
â”‚   â””â”€â”€ pipeline.py        â† wires agents together (plain Python or LangGraph)
â”œâ”€â”€ api/
â”‚   â”œâ”€â”€ __init__.py
â”‚   â”œâ”€â”€ main.py            â† FastAPI app entry point
â”‚   â”œâ”€â”€ routes.py          â† /search, /confirm endpoints + SSE stream
â”‚   â””â”€â”€ models.py          â† Pydantic request/response models
â”œâ”€â”€ blockchain/
â”‚   â”œâ”€â”€ __init__.py
â”‚   â””â”€â”€ algorand.py        â† record_purchase_intent() â€” Phase 4
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ test_agents.py
â”‚   â”œâ”€â”€ test_pipeline.py
â”‚   â””â”€â”€ test_api.py
â”œâ”€â”€ frontend/              â† Next.js app (Phase 3)
â”‚   â””â”€â”€ README.md
â””â”€â”€ docs/
    â””â”€â”€ architecture.md
```

---

## Critical architecture rules

### 1. AgentState is the only shared data bus
Every agent reads from `AgentState` and returns a partial dict update.
Agents MUST NOT call each other directly. The pipeline wires them.

```python
# CORRECT
def search_agent(state: AgentState) -> dict:
    ...
    return {"search_results": results}

# WRONG â€” never do this
def compare_agent(state: AgentState) -> dict:
    results = search_agent(state)   # â† direct call, breaks decoupling
```

### 2. Three-tier fallback â€” always
Search agent falls through: Serper.dev â†’ Groq web search â†’ mock_data.
Never let a missing API key crash the pipeline. Set `state["error"]` and continue.

### 3. Normalize before scoring
**Always** min-max normalize all dimensions to 0â€“1 before applying weights.
Price is inverted (lower price = higher normalized score).
Weights: price=0.45, rating=0.35, review_count=0.20

### 4. Error field propagation
`AgentState["error"]` is `Optional[str]`. On partial failure, set it and keep going.
The frontend renders an amber warning banner when `error` is not None.
Never raise unhandled exceptions from agent functions.

### 5. SSE not WebSockets
Streaming agent progress to the frontend uses Server-Sent Events (`text/event-stream`),
not WebSockets. One-directional is all that's needed. See `api/routes.py`.

### 6. Blockchain is append-only logging in Phase 4
Phase 4 = a plain `PaymentTxn` with a `note` field. No smart contracts until Phase 5.
The blockchain layer MUST NOT block the main pipeline â€” run it in a background task.

---

## Environment variables

Copy `.env.example` to `.env` before running. Never commit `.env`.

Required for Phase 1â€“2:
- `SERPER_API_KEY` â€” from serper.dev (free, no credit card)
- `GROQ_API_KEY` â€” from console.groq.com (free)

Required for Phase 4+:
- `ALGORAND_MNEMONIC` â€” 25-word testnet account mnemonic
- `ALGORAND_RECEIVER` â€” testnet receiver address

Optional:
- `MOCK_ONLY=true` â€” force mock data, skip all API calls (useful for offline dev)

---

## Running the project

```bash
# 1. Install dependencies
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Set environment variables
cp .env.example .env
# Edit .env and fill in SERPER_API_KEY and GROQ_API_KEY

# 3. Run the API server
uvicorn api.main:app --reload --port 8000

# 4. Test the pipeline directly
python -c "from agents.pipeline import run_pipeline; import json; print(json.dumps(run_pipeline('gaming laptop under 80000'), indent=2))"

# 5. Run tests
pytest tests/ -v
```

---

## Phase status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core agent pipeline (mock data) | ✅ DONE |
| 2 | Real data + Serper.dev + retries | ✅ DONE |
| 3 | Frontend + SSE streaming | ✅ DONE |
| 4 | Algorand testnet payment log | ✅ DONE |
| 5 | Smart contract + Pera wallet | ✅ DONE |
| 6 | Memory + polish | ✅ DONE |
| 7 | UI overhaul, landing page, advanced chatbot with RAG memory | 🔲 TODO |

Update this table as phases complete.

---

## What to build next (always current)

When this file says Phase 1 is TODO, your next task is:
1. Implement `agents/state.py` â€” the `AgentState` TypedDict
2. Implement `agents/mock_data.py` â€” 5+ products for laptop, phone, tv categories
3. Implement `agents/search_agent.py` â€” mock-only first, Serper in Phase 2
4. Implement `agents/compare_agent.py` â€” min-max scoring
5. Implement `agents/decision_agent.py` â€” Groq justification call
6. Implement `agents/pipeline.py` â€” plain Python `run_pipeline()`
7. Wire into `api/main.py` + `api/routes.py`
8. Confirm `curl -X POST localhost:8000/search -d '{"query":"gaming laptop under 80000"}' -H "Content-Type: application/json"` returns a recommendation

---

## Coding conventions

- Python: type hints everywhere, docstrings on all public functions
- No print statements in agent code â€” use `logging.getLogger(__name__)`
- All monetary values stored as `float` in INR, displayed with `f"â‚¹{price:,.0f}"`
- Scores stored as `float` rounded to 4 decimal places
- All agent functions are synchronous. FastAPI routes use `async def` with `asyncio.to_thread()` to call them without blocking.
- Tests use `pytest` with `unittest.mock.patch` for API calls â€” never make real HTTP calls in tests

---

## Known constraints and decisions

- Flipkart has no public API. Products from Flipkart appear in Serper Google Shopping results organically â€” do not attempt direct Flipkart scraping.
- Amazon PA-API requires affiliate approval. Use Serper Google Shopping instead.
- Groq `llama-3.3-70b-versatile` is the primary LLM. If rate-limited, fall back to `llama3-8b-8192`.
- Algorand testnet faucet: https://testnet.algoexplorer.io/dispenser
- Do not add ChromaDB or any vector database until Phase 6 and only if needed.
- Do not implement WebSockets â€” SSE only.
