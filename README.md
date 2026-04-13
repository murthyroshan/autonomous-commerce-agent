# Kartiq — Autonomous AI Shopping Agent

Kartiq is an AI agent that shops for you. Describe what you want in plain English — it searches Google Shopping, scores results against your budget, compares prices and ratings, and returns the best option with a clear explanation.

Confirmed purchases are logged as immutable transactions on the Algorand blockchain.

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## How it works

```text
"Find the best gaming laptop under ₹60,000"
             │
     ┌───────▼────────┐
     │  Search Agent  │  → Serper.dev Google Shopping (live Indian results)
     └───────┬────────┘    Falls back to Groq web search, then mock data
             │
     ┌───────▼────────┐
     │ Compare Agent  │  → Normalizes price, rating, reviews to 0–1 scale
     └───────┬────────┘    Weights: price 45% · rating 35% · reviews 20%
             │
     ┌───────▼────────┐
     │ Decision Agent │  → Groq LLM picks winner and explains why
     └───────┬────────┘
             │
     ┌───────▼────────┐
     │   Next.js UI   │  → Live streaming status, ranked product cards
     └───────┬────────┘
             │
     ┌───────▼────────┐
     │    Algorand    │  → Purchase intent logged on testnet blockchain
     └────────────────┘
```

---

## Features

- Natural language queries with budget constraints
- Budget enforcement at every layer (not post-filter only)
- Multi-category support: laptops, phones, TVs, headphones, earbuds, speakers, watches, tablets, keyboards, cameras
- Data quality layer: removes fake prices, filters accessories, collapses duplicates, flags unverified ratings
- 3-tier fallback: Serper → Groq web search → mock data
- Real-time streaming via SSE
- Blockchain logging for confirmed purchases

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| Agents | Plain Python functions + optional LangGraph |
| LLM | Groq API (`llama-3.3-70b-versatile`) |
| Product data | Serper.dev Google Shopping API |
| Blockchain | Algorand testnet, py-algorand-sdk, AlgoNode |
| Smart contract | PyTeal, Algorand LogicSig |
| Wallet | Pera WalletConnect |
| Memory | ChromaDB (local), JSON files |
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Streaming | Server-Sent Events (SSE) |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Two free API keys:
  - Serper.dev: https://serper.dev
  - Groq: https://console.groq.com

---

## Getting started

### 1) Clone the repository

```bash
git clone https://github.com/murthyroshan/autonomous-commerce-agent.git
cd autonomous-commerce-agent
```

### 2) Set up backend

```bash
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Set keys in `.env`:

```env
SERPER_API_KEY=your_serper_key_here
GROQ_API_KEY=your_groq_key_here
```

### 3) Run backend

```bash
uvicorn api.main:app --reload --port 8000
```

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

### 4) Set up frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 5) Run frontend

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Running without API keys

Set `MOCK_ONLY=true` in `.env`:

```bash
MOCK_ONLY=true uvicorn api.main:app --reload --port 8000
```

---

## Running tests

```bash
MOCK_ONLY=true python -m pytest tests/ -v
```

Expected: `59+ passed`

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/search` | Full pipeline, JSON result |
| GET | `/api/search/stream?query=...` | SSE live agent status |
| POST | `/api/confirm` | Log purchase to Algorand testnet |

### Example request

```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "wireless earbuds under 3000"}'
```

### Example response

```json
{
  "query": "wireless earbuds under 3000",
  "scored_products": [
    {
      "title": "boAt Airdopes 141 TWS Earbuds",
      "price": 1299.0,
      "rating": 4.1,
      "review_count": 45000,
      "source": "Amazon",
      "score": 0.8712
    }
  ],
  "recommendation": {
    "title": "boAt Airdopes 141 TWS Earbuds",
    "price": 1299.0,
    "score": 0.8712,
    "justification": "The boAt Airdopes 141 offers exceptional value at ₹1,299 with 45,000+ reviews and a 4.1-star rating."
  },
  "error": null
}
```

---

## Project structure

```text
autonomous-commerce-agent/
├── agents/
│   ├── state.py
│   ├── mock_data.py
│   ├── search_agent.py
│   ├── compare_agent.py
│   ├── decision_agent.py
│   └── pipeline.py
├── api/
│   ├── main.py
│   ├── routes.py
│   └── models.py
├── blockchain/
│   └── algorand.py
├── frontend/
│   └── src/
├── tests/
│   ├── test_agents.py
│   ├── test_pipeline.py
│   └── test_api.py
├── .env.example
├── requirements.txt
└── pytest.ini
```

---

## Roadmap

- [x] Phase 1 — Core agent pipeline + mock data
- [x] Phase 2 — Live Serper data + retry logic
- [x] Phase 3 — Frontend + SSE streaming
- [x] Phase 4 — Algorand testnet payment logging
- [x] Phase 5 — PyTeal smart contract + Pera wallet signing
- [x] Phase 6 — Memory + purchase history + watchlist
- [ ] Phase 7 — UI overhaul + landing page + advanced chatbot with RAG memory

---

## License

MIT