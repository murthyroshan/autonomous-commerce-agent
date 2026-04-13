# Kartiq â€” Autonomous AI Shopping Agent

Kartiq is an AI agent that shops for you. Describe what you want in plain English â€” it searches Google Shopping, scores every result against your budget, compares prices and ratings, and hands you the best option with a clear explanation of why.

Confirmed purchases are logged as immutable transactions on the Algorand blockchain.

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## How it works

```
"Find the best gaming laptop under â‚¹60,000"
             â”‚
     â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚  Search Agent  â”‚  â†’ Serper.dev Google Shopping (live Indian results)
     â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜    Falls back to Groq web search, then mock data
             â”‚
     â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚ Compare Agent  â”‚  â†’ Normalizes price, rating, reviews to 0â€“1 scale
     â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜    Weights: price 45% Â· rating 35% Â· reviews 20%
             â”‚
     â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚ Decision Agent â”‚  â†’ Groq LLM picks the winner and explains why
     â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚
     â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚   Next.js UI   â”‚  â†’ Live streaming status, ranked product cards
     â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜    Violet glow on winner, animated score bars
             â”‚
     â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚    Algorand    â”‚  â†’ Purchase intent logged on testnet blockchain
     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Features

- **Natural language queries** â€” type exactly what you want, including budget
- **Budget enforcement** â€” "under â‚¹30,000" is respected at every layer, not just filtered after the fact
- **Multi-category** â€” laptops, phones, TVs, headphones, earbuds, speakers, watches, tablets, keyboards, cameras
- **Data quality layer** â€” fake prices removed, accessories filtered out, duplicates collapsed, unverified ratings flagged
- **3-tier fallback** â€” Serper â†’ Groq web search â†’ mock data, so it never fully breaks
- **Real-time streaming** â€” watch the agent work live via SSE
- **Blockchain logging** â€” every confirmed purchase gets an Algorand transaction ID

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| Agents | Plain Python functions + optional LangGraph |
| LLM | Groq API - llama-3.3-70b-versatile |
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
- Two free API keys (no credit card needed for either):
  - **Serper.dev** â†’ [serper.dev](https://serper.dev) â€” 2,500 free searches
  - **Groq** â†’ [console.groq.com](https://console.groq.com) â€” free tier

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

Open `http://localhost:3000` â€” type a query and search.

---

## Running without API keys

Set `MOCK_ONLY=true` in your `.env` to run entirely on hardcoded sample data â€” no API keys needed. Useful for development and testing.

```bash
MOCK_ONLY=true uvicorn api.main:app --reload --port 8000
```

---

## Running tests

```bash
# From the project root
MOCK_ONLY=true python -m pytest tests/ -v
```

Expected output: **59+ passed**

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/search` | Full pipeline â€” returns JSON |
| `GET` | `/api/search/stream?query=...` | SSE stream â€” live agent status |
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
    "justification": "The boAt Airdopes 141 offers exceptional value at â‚¹1,299 with 45,000+ verified reviews backing its 4.1â˜… rating. Among all compared options it combines the lowest price with the highest buyer confidence."
  },
  "error": null
}
```

---

## Project structure

```
kartiq/
â”œâ”€â”€ agents/
â”‚   â”œâ”€â”€ state.py            â† AgentState TypedDict â€” shared data bus
â”‚   â”œâ”€â”€ mock_data.py        â† Fallback product data, category keywords
â”‚   â”œâ”€â”€ search_agent.py     â† Serper â†’ Groq â†’ mock, with full data validation
â”‚   â”œâ”€â”€ compare_agent.py    â† Normalized scoring logic
â”‚   â”œâ”€â”€ decision_agent.py   â† Groq LLM recommendation
â”‚   â””â”€â”€ pipeline.py         â† Orchestrates all three agents
â”œâ”€â”€ api/
â”‚   â”œâ”€â”€ main.py             â† FastAPI app, CORS config
â”‚   â”œâ”€â”€ routes.py           â† All endpoints including SSE stream
â”‚   â””â”€â”€ models.py           â† Pydantic request/response models
â”œâ”€â”€ blockchain/
â”‚   â””â”€â”€ algorand.py         â† Algorand testnet purchase logging
â”œâ”€â”€ frontend/               â† Next.js 14 UI
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ app/
â”‚       â”œâ”€â”€ components/
â”‚       â””â”€â”€ hooks/
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ test_agents.py
â”‚   â”œâ”€â”€ test_pipeline.py
â”‚   â””â”€â”€ test_api.py
â”œâ”€â”€ .env.example
â”œâ”€â”€ requirements.txt
â””â”€â”€ pytest.ini
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
