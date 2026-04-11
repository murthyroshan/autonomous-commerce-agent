# IMPLEMENTATION.md — Autonomous Commerce AI Agent

## Project overview

An autonomous AI shopping agent that:
1. Takes a natural-language query from the user
2. Searches Google Shopping via Serper.dev
3. Scores products using normalized multi-dimensional scoring
4. Generates an AI recommendation via Groq LLM
5. Optionally logs the confirmed purchase to Algorand testnet

**Core principle:** Each phase produces a fully demo-able system.
Never have two half-built phases simultaneously.

---

## Phase 1 — Core agent pipeline (mock data only)
**Goal:** Working end-to-end pipeline, no external APIs needed.
**Time estimate:** 2–3 days

### Files to create

#### `agents/state.py`
```python
from typing import TypedDict, Optional

class AgentState(TypedDict):
    query:            str
    search_results:   list[dict]   # raw from search agent
    scored_products:  list[dict]   # with 'score' field added
    recommendation:   dict         # top product + justification
    error:            Optional[str]
```

#### `agents/mock_data.py`
Provide at least 5 products per category. Fields required on every product:
- `title` (str)
- `price` (float, INR)
- `rating` (float, 0–5)
- `review_count` (int)
- `source` (str: "Amazon" | "Flipkart" | "Croma" etc.)
- `link` (str)

Categories to cover: `laptop`, `phone`, `tv`, `headphones`, `tablet`

#### `agents/search_agent.py`
Phase 1: return mock data only.
Signature: `def search_agent(state: AgentState) -> dict`
Returns: `{"search_results": [...]}`
In Phase 2 this will call Serper.dev first, fall back to mock.

#### `agents/compare_agent.py`
Min-max normalize price (inverted), rating, review_count.
Weights: `price=0.45, rating=0.35, review_count=0.20`
Signature: `def compare_agent(state: AgentState) -> dict`
Returns: `{"scored_products": [...]}` sorted descending by score.

Normalization formula:
```
normalized = (value - min) / (max - min)
price_score = 1 - normalized_price   # invert: lower price = better
final_score = 0.45*price_score + 0.35*rating_score + 0.20*review_score
```
Edge case: if all values are equal, assign 1.0 to all.

#### `agents/decision_agent.py`
Phase 1: generate justification using Groq API.
Signature: `def decision_agent(state: AgentState) -> dict`
Returns: `{"recommendation": {**top_product, "justification": str}}`

Groq model: `llama-3.3-70b-versatile`
Prompt: include title, price, rating, review_count, score.
Ask for exactly 2 sentences explaining the price-to-performance tradeoff.
Max tokens: 120

#### `agents/pipeline.py`
Phase 1: plain Python, no LangGraph.
```python
def run_pipeline(query: str) -> AgentState:
    state = {"query": query, "search_results": [], 
             "scored_products": [], "recommendation": {}, "error": None}
    state.update(search_agent(state))
    if not state["search_results"]:
        return state
    state.update(compare_agent(state))
    if not state["scored_products"]:
        return state
    state.update(decision_agent(state))
    return state
```

#### `api/main.py`
FastAPI app with CORS enabled for `http://localhost:3000`.
Mount routes from `api/routes.py`.

#### `api/routes.py`
- `POST /search` — accepts `{"query": str}`, runs pipeline, returns full state
- `GET /health` — returns `{"status": "ok"}`

#### `api/models.py`
Pydantic models:
- `SearchRequest(query: str)` — validate query is non-empty, max 200 chars
- `ProductResult` — mirrors the scored product dict fields
- `SearchResponse` — contains list of ProductResult + recommendation + optional error

### Phase 1 acceptance test
```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "gaming laptop under 80000"}'
```
Expected: JSON with `scored_products` array (sorted by score), `recommendation` with
`justification` field, `error: null`.

---

## Phase 2 — Real data + resilience
**Goal:** Replace mock with live Serper.dev data. Add retry logic and fallback.
**Time estimate:** 3–4 days
**Requires:** `SERPER_API_KEY` from serper.dev (free, no credit card)

### Changes to `agents/search_agent.py`

Add `_call_serper(query)` using `tenacity`:
```python
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
def _call_serper(query: str) -> list[dict]:
    r = requests.post(
        "https://google.serper.dev/shopping",
        headers={"X-API-KEY": os.getenv("SERPER_API_KEY")},
        json={"q": query, "gl": "in", "num": 10},
        timeout=10
    )
    r.raise_for_status()
    return _parse_serper_response(r.json())
```

`_parse_serper_response` must:
- Strip `₹` and `,` from price strings, cast to float
- Default `rating` to `3.5` if missing
- Default `review_count` to `0` if missing
- Skip products with no price

Fallback order in `search_agent()`:
1. Try `_call_serper()`
2. On failure, try `_call_groq_search()` (Groq Compound model)
3. On failure, return mock data + set `state["error"]`

### `_call_groq_search(query)` — Groq fallback
Use `model="groq/compound"` which has built-in web search.
Prompt it to return a JSON array of products.
Parse the response with regex: `re.search(r'\[.*?\]', text, re.DOTALL)`.
Wrap in try/except — if parse fails, raise so pipeline falls to mock.

### Data normalization edge cases to handle
- Price strings: `"₹54,990"`, `"54990.0"`, `"54990"` → all become `54990.0`
- Rating missing → `3.5`
- Review count as string `"2,847"` → strip comma → `2847`
- Products with price `0` or `None` → filter out

### Phase 2 acceptance test
With `SERPER_API_KEY` set:
```bash
curl -X POST http://localhost:8000/search \
  -d '{"query": "gaming laptop under 80000"}' \
  -H "Content-Type: application/json"
```
Expected: real Amazon/Flipkart products in `scored_products`, sources say
"Amazon" or "Flipkart", prices are realistic INR values.

With `SERPER_API_KEY` unset (fallback test):
Same curl — should return mock data with `"error": "Live search unavailable..."`

---

## Phase 3 — Frontend + SSE streaming
**Goal:** React UI with live status updates as the pipeline runs.
**Time estimate:** 3–4 days

### Changes to `api/routes.py`

Add SSE endpoint:
```python
@router.get("/search/stream")
async def search_stream(query: str):
    async def event_generator():
        yield f"data: {json.dumps({'status': 'Searching products...'})}\n\n"
        results = await asyncio.to_thread(search_agent, state)
        yield f"data: {json.dumps({'status': 'Comparing prices...'})}\n\n"
        # ... continue for each agent
        yield f"data: {json.dumps({'type': 'result', **final_state})}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})
```

### Frontend: `frontend/`

Tech: Next.js 14, Tailwind CSS, shadcn/ui
```
frontend/
├── app/
│   ├── page.tsx           ← main search page
│   └── layout.tsx
├── components/
│   ├── SearchBar.tsx      ← input + submit button
│   ├── StatusTicker.tsx   ← live SSE status messages
│   ├── ProductCard.tsx    ← single product display
│   ├── ProductGrid.tsx    ← grid of ProductCards
│   └── ErrorBanner.tsx    ← amber warning when error set
└── hooks/
    └── useAgentStream.ts  ← EventSource hook
```

#### `hooks/useAgentStream.ts`
```typescript
export function useAgentStream(query: string | null) {
  const [status, setStatus] = useState<string>('')
  const [result, setResult] = useState<SearchResult | null>(null)
  
  useEffect(() => {
    if (!query) return
    const es = new EventSource(`/api/search/stream?query=${encodeURIComponent(query)}`)
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'result') { setResult(data); es.close() }
      else setStatus(data.status)
    }
    return () => es.close()
  }, [query])
  
  return { status, result }
}
```

#### `components/ProductCard.tsx`
Show: title, source badge (Amazon/Flipkart), price (₹XX,XXX), rating stars,
review count, score bar (0–100%), "Confirm Purchase" button.
Highlight winning product: `border-2 border-blue-500` + "Recommended" badge.

### Phase 3 acceptance test
- Open `http://localhost:3000`
- Type "gaming laptop under 80000" and submit
- Status ticker shows "Searching...", "Comparing..." sequentially
- Product cards appear with the winner highlighted
- Error banner appears when `error` is set in response

---

## Phase 4 — Algorand testnet payment log
**Goal:** Log confirmed purchases as Algorand transactions.
**Time estimate:** 2 days
**Requires:** Algorand testnet account (AlgoKit or manual keygen)

### Setup
```bash
pip install py-algorand-sdk
# Generate testnet account
python -c "from algosdk import account; sk, pk = account.generate_account(); print('Address:', pk); print('Mnemonic:', account.from_key(sk))"
# Fund it: https://testnet.algoexplorer.io/dispenser
```

### `blockchain/algorand.py`
```python
from algosdk import account, mnemonic, transaction
from algosdk.v2client import algod
import json, os

ALGOD_ADDRESS = "https://testnet-api.algonode.cloud"
ALGOD_TOKEN   = ""  # AlgoNode is free, no token needed

def get_client():
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

def record_purchase_intent(product: dict, user_id: str = "demo") -> dict:
    """
    Sends a 1-microALGO PaymentTxn with a note encoding the purchase intent.
    Returns: {"tx_id": str, "explorer_url": str}
    """
    client = get_client()
    sender_mnemonic = os.getenv("ALGORAND_MNEMONIC")
    private_key = mnemonic.to_private_key(sender_mnemonic)
    sender = account.address_from_private_key(private_key)
    receiver = os.getenv("ALGORAND_RECEIVER", sender)  # send to self if no receiver

    note_data = {
        "product_id": product.get("link", "")[-20:],
        "title":      product.get("title", "")[:50],
        "price_inr":  product.get("price"),
        "source":     product.get("source"),
        "user_id":    user_id,
    }
    note = json.dumps(note_data).encode()

    params = client.suggested_params()
    txn = transaction.PaymentTxn(
        sender=sender,
        sp=params,
        receiver=receiver,
        amt=1,       # 1 microALGO
        note=note,
    )
    signed = txn.sign(private_key)
    tx_id = client.send_transaction(signed)

    return {
        "tx_id":         tx_id,
        "explorer_url":  f"https://testnet.algoexplorer.io/tx/{tx_id}",
    }
```

### `api/routes.py` — add confirm endpoint
```python
@router.post("/confirm")
async def confirm_purchase(product: ProductResult):
    try:
        result = await asyncio.to_thread(record_purchase_intent, product.dict())
        return {"success": True, **result}
    except Exception as e:
        # blockchain failure MUST NOT block user — log and return gracefully
        logger.error(f"Algorand tx failed: {e}")
        return {"success": False, "error": "Transaction failed — purchase noted locally"}
```

### Phase 4 acceptance test
1. Make a search, get a recommendation
2. POST to `/confirm` with the top product
3. Receive `{"success": true, "tx_id": "...", "explorer_url": "..."}`
4. Open the explorer URL and see the transaction with the note field

---

## Phase 5 — Smart contract + Pera wallet
**Goal:** User signs the transaction from their own wallet. Add escrow contract.
**Time estimate:** 4–5 days
**Requires:** PyTeal, AlgoKit sandbox, Pera Wallet (mobile or web)

### Smart contract concept
A stateless LogicSig contract that approves a payment only if:
- The transaction note contains a valid `product_id`
- The amount is > 0
- The receiver is the expected merchant address

This prevents transaction tampering — the note can't be changed post-signing.

### `blockchain/contract.py`
```python
from pyteal import *

def approval_program():
    product_id_check = Txn.note() != Bytes("")
    amount_check = Txn.amount() > Int(0)
    return And(product_id_check, amount_check)

if __name__ == "__main__":
    print(compileTeal(approval_program(), mode=Mode.Signature, version=6))
```

### Frontend wallet integration
Install: `npm install @perawallet/connect`

Flow:
1. User clicks "Confirm Purchase"
2. Frontend calls `POST /confirm/prepare` — backend builds unsigned txn, returns base64
3. Frontend passes base64 txn to Pera for signing
4. Frontend submits signed txn to `POST /confirm/submit`

**Fallback:** If no wallet connected, use the pre-funded testnet account (Phase 4 path).
This keeps the demo functional even without a connected wallet.

---

## Phase 6 — Memory + polish
**Goal:** User preferences, purchase history, price alerts, final UI polish.
**Time estimate:** 3–4 days

### User preferences (JSON file store — no vector DB yet)
```python
# agents/memory.py
import json, os

PREFS_DIR = "prefs"

def load_prefs(user_id: str) -> dict:
    path = f"{PREFS_DIR}/{user_id}.json"
    if os.path.exists(path):
        return json.load(open(path))
    return {"preferred_brands": [], "max_price": None, "preferred_sources": []}

def save_pref(user_id: str, key: str, value) -> None:
    os.makedirs(PREFS_DIR, exist_ok=True)
    prefs = load_prefs(user_id)
    prefs[key] = value
    json.dump(prefs, open(f"{PREFS_DIR}/{user_id}.json", "w"), indent=2)
```

### Decision agent preference boost
In `compare_agent.py`, after scoring:
```python
prefs = load_prefs(user_id)
for product in scored:
    if any(brand.lower() in product["title"].lower() 
           for brand in prefs.get("preferred_brands", [])):
        product["score"] = min(1.0, product["score"] + 0.10)
```

### Purchase history
Append each confirmed purchase to `history/{user_id}.jsonl` (one JSON per line).
Frontend page at `/history` reads and displays this file.

### Price watchlist
`POST /watch` — saves a product + target price to `watchlist/{user_id}.json`.
APScheduler job runs every 24h: re-searches watched products, sends a log alert
(Phase 6 scope: log only, push notifications are post-MVP).

### Upgrade trigger for ChromaDB
Only migrate to ChromaDB when:
- User count > 50, OR
- Preference JSON files exceed 500 entries total, OR
- You need semantic similarity (e.g. "find products similar to what I bought before")

---

## Testing strategy

### `tests/test_agents.py`
Unit test each agent in isolation with mocked external calls.

```python
from unittest.mock import patch, MagicMock
from agents.state import AgentState
from agents.search_agent import search_agent
from agents.compare_agent import compare_agent

def make_state(**kwargs) -> AgentState:
    return {"query": "test", "search_results": [], 
            "scored_products": [], "recommendation": {}, 
            "error": None, **kwargs}

def test_compare_agent_sorts_by_score():
    products = [
        {"title": "A", "price": 80000.0, "rating": 4.0, "review_count": 100},
        {"title": "B", "price": 50000.0, "rating": 4.5, "review_count": 2000},
    ]
    state = make_state(search_results=products)
    result = compare_agent(state)
    assert result["scored_products"][0]["title"] == "B"

def test_compare_agent_all_equal_prices():
    # when all prices equal, price_score = 1.0 for all — no division by zero
    products = [
        {"title": "A", "price": 50000.0, "rating": 4.0, "review_count": 100},
        {"title": "B", "price": 50000.0, "rating": 4.5, "review_count": 200},
    ]
    state = make_state(search_results=products)
    result = compare_agent(state)
    assert all(0 <= p["score"] <= 1 for p in result["scored_products"])

@patch("agents.search_agent.requests.post")
def test_search_agent_falls_back_on_api_error(mock_post):
    mock_post.side_effect = Exception("API down")
    state = make_state(query="laptop")
    result = search_agent(state)
    assert len(result["search_results"]) > 0   # mock data returned
    assert result.get("error") is not None      # error set
```

### `tests/test_pipeline.py`
Integration test the full pipeline end-to-end using mock data only.

```python
import os
os.environ["MOCK_ONLY"] = "true"

from agents.pipeline import run_pipeline

def test_pipeline_returns_recommendation():
    result = run_pipeline("gaming laptop under 80000")
    assert result["recommendation"].get("title")
    assert result["recommendation"].get("score", 0) > 0
    assert result["recommendation"].get("justification")

def test_pipeline_handles_empty_query():
    result = run_pipeline("")
    # should not raise — should return error state
    assert isinstance(result, dict)
```

---

## Common issues and fixes

| Issue | Likely cause | Fix |
|-------|-------------|-----|
| `KeyError: 'shopping'` from Serper | Query returned no shopping results | Add `.get("shopping", [])` — already in template |
| Price is `None` after parse | Product has no price in Serper response | Filter out in `_parse_serper_response` |
| Groq rate limit (429) | Free tier limit hit | Fall back to `llama3-8b-8192`, slower but lower limits |
| Algorand `{"message": "overspend"}` | Testnet account not funded | Fund at testnet.algoexplorer.io/dispenser |
| SSE connection drops immediately | Missing `Cache-Control: no-cache` header | Add to `StreamingResponse` headers |
| All scores equal 0.75 | Only one product found — normalization gives all 1.0 | Expected behavior. Add note in UI if < 3 products found |

---

## Dependencies reference

### `requirements.txt`
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
pydantic==2.7.1
python-dotenv==1.0.1
requests==2.31.0
tenacity==8.3.0
groq==0.9.0
py-algorand-sdk==2.6.1
pytest==8.2.0
httpx==0.27.0
```

### Add in Phase 3+ (frontend)
```
# No extra Python deps for frontend — it's a separate Next.js project
```

### Add in Phase 5+ (smart contracts)
```
pyteal==0.25.0
algokit-utils==2.2.1
```
