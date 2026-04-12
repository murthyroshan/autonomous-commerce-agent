# Kartiq — Autonomous AI Shopping Agent

Kartiq is an AI agent that shops for you. Describe what you want in plain English — it searches Google Shopping, scores every result against your budget, compares prices and ratings, and hands you the best option with a clear explanation of why.

Confirmed purchases are logged as immutable transactions on the Algorand blockchain.

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## How it works

```
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
     │ Decision Agent │  → Groq LLM picks the winner and explains why
     └───────┬────────┘
             │
     ┌───────▼────────┐
     │   Next.js UI   │  → Live streaming status, ranked product cards
     └───────┬────────┘    Violet glow on winner, animated score bars
             │
     ┌───────▼────────┐
     │    Algorand    │  → Purchase intent logged on testnet blockchain
     └────────────────┘
```

---

## Features

- **Natural language queries** — type exactly what you want, including budget
- **Budget enforcement** — "under ₹30,000" is respected at every layer, not just filtered after the fact
- **Multi-category** — laptops, phones, TVs, headphones, earbuds, speakers, watches, tablets, keyboards, cameras
- **Data quality layer** — fake prices removed, accessories filtered out, duplicates collapsed, unverified ratings flagged
- **3-tier fallback** — Serper → Groq web search → mock data, so it never fully breaks
- **Real-time streaming** — watch the agent work live via SSE
- **Blockchain logging** — every confirmed purchase gets an Algorand transaction ID

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| Agents | Plain Python functions + optional LangGraph |
| LLM | Groq API — llama-3.3-70b-versatile |
| Product data | Serper.dev Google Shopping API |
| Blockchain | Algorand testnet, py-algorand-sdk, AlgoNode |
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Streaming | Server-Sent Events (SSE) |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- Two free API keys (no credit card needed for either):
  - **Serper.dev** → [serper.dev](https://serper.dev) — 2,500 free searches
  - **Groq** → [console.groq.com](https://console.groq.com) — free tier

---

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/murthyroshan/autonomous-commerce-agent.git
cd autonomous-commerce-agent
```

### 2. Set up the backend

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Open `.env` and fill in your keys:

```env
SERPER_API_KEY=your_serper_key_here
GROQ_API_KEY=your_groq_key_here
```

### 3. Run the backend

```bash
uvicorn api.main:app --reload --port 8000
```

API is now live at `http://localhost:8000`  
Interactive docs at `http://localhost:8000/docs`

### 4. Set up the frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 5. Run the frontend

```bash
npm run dev
```

Open `http://localhost:3000` — type a query and search.

---

## Running without API keys

Set `MOCK_ONLY=true` in your `.env` to run entirely on hardcoded sample data — no API keys needed. Useful for development and testing.

```bash
MOCK_ONLY=true uvicorn api.main:app --reload --port 8000
```

---

## Running tests

```bash
# From the project root
MOCK_ONLY=true python -m pytest tests/ -v
```

Expected output: **45 passed**

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/search` | Full pipeline — returns JSON |
| `GET` | `/api/search/stream?query=...` | SSE stream — live agent status |
| `POST` | `/api/confirm` | Log purchase to Algorand testnet |

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
    "justification": "The boAt Airdopes 141 offers exceptional value at ₹1,299 with 45,000+ verified reviews backing its 4.1★ rating. Among all compared options it combines the lowest price with the highest buyer confidence."
  },
  "error": null
}
```

---

## Project structure

```
kartiq/
├── agents/
│   ├── state.py            ← AgentState TypedDict — shared data bus
│   ├── mock_data.py        ← Fallback product data, category keywords
│   ├── search_agent.py     ← Serper → Groq → mock, with full data validation
│   ├── compare_agent.py    ← Normalized scoring logic
│   ├── decision_agent.py   ← Groq LLM recommendation
│   └── pipeline.py         ← Orchestrates all three agents
├── api/
│   ├── main.py             ← FastAPI app, CORS config
│   ├── routes.py           ← All endpoints including SSE stream
│   └── models.py           ← Pydantic request/response models
├── blockchain/
│   └── algorand.py         ← Algorand testnet purchase logging
├── frontend/               ← Next.js 14 UI
│   └── src/
│       ├── app/
│       ├── components/
│       └── hooks/
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

- [ ] Phase 4 — Algorand testnet payment logging
- [ ] Phase 5 — PyTeal smart contract + Pera wallet signing
- [ ] Phase 6 — User preferences + purchase history
- [ ] Price drop alerts
- [ ] Side-by-side product comparison mode
- [ ] Voice input
- [ ] Shareable recommendation links
- [ ] Budget slider UI control

---

## License

MIT
