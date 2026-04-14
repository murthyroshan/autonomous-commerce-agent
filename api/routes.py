"""api/routes.py — FastAPI route handlers."""

import asyncio
import json
import logging
import re

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from agents.pipeline import run_pipeline
from agents.state import initial_state
from agents.search_agent import search_agent
from agents.compare_agent import compare_agent
from agents.decision_agent import decision_agent
from agents.memory import load_prefs, save_pref, log_purchase, get_history
from .models import SearchRequest, SearchResponse, ConfirmRequest, ConfirmResponse

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Health check ──────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok"}


# ── POST /search — full pipeline, single response ────────────────────────────

@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest, user_id: str = Query(default="demo")):
    """
    Run the full agent pipeline and return the complete result.
    Use this for non-streaming clients.
    """
    try:
        result = await asyncio.to_thread(run_pipeline, request.query, user_id)
        return SearchResponse(
            query=result["query"],
            scored_products=result.get("scored_products", []),
            recommendation=result.get("recommendation") or None,
            error=result.get("error"),
        )
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /search/stream — SSE streaming endpoint ───────────────────────────────

@router.get("/search/stream")
async def search_stream(query: str, user_id: str = Query(default="demo")):
    """
    Run the pipeline step-by-step, streaming status updates via SSE.
    Frontend connects with EventSource("/search/stream?query=...").

    Events emitted:
        {"type": "status",  "message": "Searching products..."}
        {"type": "status",  "message": "Comparing prices..."}
        {"type": "status",  "message": "Generating recommendation..."}
        {"type": "result",  ...full SearchResponse fields...}
        {"type": "error",   "message": "..."}
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    async def event_generator():
        def sse(data: dict) -> str:
            return f"data: {json.dumps(data)}\n\n"

        try:
            from agents.pipeline import _detect_vs_query, _run_single_search, _pin_best_match, _is_relevant
            is_vs, side_a, side_b = _detect_vs_query(query.strip())
            state = initial_state(query.strip())

            if is_vs:
                yield sse({"type": "status", "message": f"Organizing matchup: {side_a} vs {side_b}..."})
                
                def run_dual_search():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                        fut_a = executor.submit(_run_single_search, side_a)
                        fut_b = executor.submit(_run_single_search, side_b)
                        return fut_a.result(), fut_b.result()

                results_a, results_b = await asyncio.to_thread(run_dual_search)
                
                if not results_a and not results_b:
                    yield sse({"type": "error", "message": f"No products found for '{side_a}' or '{side_b}'"})
                    return

                # Pin the BEST TITLE-MATCHING product from each side's pool
                # (prevents "oneplus 12" from pinning to an "oneplus 12r" result)
                contender_a = _pin_best_match(side_a, results_a) if results_a else None
                contender_b = _pin_best_match(side_b, results_b) if results_b else None

                # Guard: if both sides pinned to the same product, use pool fallback
                if (
                    contender_a and contender_b
                    and contender_a["title"] == contender_b["title"]
                ):
                    contender_a = results_a[0] if results_a else None
                    b_pool = [p for p in results_b if p["title"] != (contender_a or {}).get("title")]
                    contender_b = b_pool[0] if b_pool else (results_b[0] if results_b else None)

                all_products = results_a + results_b
                all_products.sort(key=lambda x: x.get("score", 0), reverse=True)
                # Deduplicate by title (keep first occurrence = highest score) and strict filter
                seen: set[str] = set()
                deduped: list[dict] = []
                for p in all_products:
                    if p["title"] not in seen and _is_relevant(p["title"], side_a, side_b):
                        seen.add(p["title"])
                        deduped.append(p)

                state["search_results"] = deduped
                state["scored_products"] = deduped

                if contender_a and contender_b:
                    state["battle_contenders"] = [contender_a, contender_b]

                yield sse({"type": "status", "message": "Referee evaluating matchup..."})
                decision_result = await asyncio.to_thread(decision_agent, state)
                state.update(decision_result)

            else:
                # ── Standard Mode ──
                # Step 1: Search
                yield sse({"type": "status", "message": "Searching products..."})
                search_result = await asyncio.to_thread(search_agent, state)
                state.update(search_result)

                if not state["search_results"]:
                    # Smart Budget Negotiation: emit nudge instead of plain error
                    if state.get("budget_miss"):
                        yield sse({
                            "type":         "result",
                            "query":        state["query"],
                            "scored_products": [],
                            "recommendation":  None,
                            "budget_miss":  state["budget_miss"],
                            "error":        state.get("error"),
                        })
                    else:
                        yield sse({"type": "error", "message": state.get("error", "No products found")})
                    return

                # Step 2: Compare
                yield sse({"type": "status", "message": f"Comparing {len(state['search_results'])} products..."})
                compare_result = await asyncio.to_thread(compare_agent, state, user_id)
                state.update(compare_result)

                # Extract battlefield contenders for standard mode
                scored = state.get("scored_products", [])
                if len(scored) >= 2:
                    state["battle_contenders"] = [scored[0], scored[1]]

                # Step 3: Decision
                yield sse({"type": "status", "message": "Generating recommendation..."})
                decision_result = await asyncio.to_thread(decision_agent, state)
                state.update(decision_result)

            # Final result
            yield sse({
                "type":             "result",
                "query":            state["query"],
                "scored_products":  state.get("scored_products", []),
                "recommendation":   state.get("recommendation"),
                "budget_miss":      state.get("budget_miss"),
                "battle_contenders": state.get("battle_contenders"),
                "battle_report":    state.get("battle_report"),
                "error":            state.get("error"),
            })

        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            yield sse({"type": "error", "message": f"Pipeline error: {str(e)}"})
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ── POST /confirm — log purchase to Algorand (Phase 4+) ──────────────────────

@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_purchase(request: ConfirmRequest):
    """
    Log a confirmed purchase to Algorand testnet and record in local history.
    Phase 4: plain PaymentTxn with note field.
    Phase 5: smart contract escrow.
    """
    tx_id = None
    explorer_url = None
    confirm_error = None

    try:
        # Lazy import — Algorand SDK not required until Phase 4
        from blockchain.algorand import record_purchase_intent
        result = await asyncio.to_thread(
            record_purchase_intent, request.model_dump(), request.user_id
        )
        tx_id = result.get("tx_id")
        explorer_url = result.get("explorer_url")
    except ImportError:
        logger.info("Blockchain module not available (Phase 4+) — logging locally only")
        tx_id = "local-" + request.title[:8].replace(" ", "-").lower()
        confirm_error = "Blockchain logging not enabled yet"
    except ValueError as e:
        logger.info(f"Blockchain not configured ({e}) — logging locally only")
        tx_id = "local-" + request.title[:8].replace(" ", "-").lower()
        confirm_error = "Blockchain credentials not configured — purchase noted locally"
    except Exception as e:
        logger.warning(f"Blockchain logging failed: {e}. Falling back to local history.")
        tx_id = "local-" + request.title[:8].replace(" ", "-").lower()
        confirm_error = f"Blockchain error: {str(e)} — purchase noted locally"

    # Phase 6: log to local purchase history — never block the response
    try:
        product_dict = request.model_dump()
        await asyncio.to_thread(log_purchase, request.user_id, product_dict, tx_id)
    except Exception as e:
        logger.warning(f"log_purchase failed (non-blocking): {e}")

    return ConfirmResponse(
        success=True,
        tx_id=tx_id,
        explorer_url=explorer_url,
        error=confirm_error,
    )


@router.post("/confirm/prepare")
async def prepare_transaction(request: ConfirmRequest):
    """
    Build an unsigned transaction for Pera wallet signing.
    Frontend calls this, gets txn_b64, passes to Pera,
    then calls /confirm/submit with the signed result.
    """
    try:
        from blockchain.algorand import build_unsigned_transaction

        result = await asyncio.to_thread(build_unsigned_transaction, request.model_dump())
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"prepare_transaction error: {e}")
        return {
            "success": False,
            "fallback": True,
            "error": "Wallet signing unavailable — use direct confirm",
        }


@router.post("/confirm/submit")
async def submit_transaction(signed_txn_b64: str, request: ConfirmRequest):
    """
    Accept a Pera-signed transaction and submit it to Algorand.
    Also logs the purchase to history.
    """
    try:
        from blockchain.algorand import submit_signed_transaction

        result = await asyncio.to_thread(submit_signed_transaction, signed_txn_b64)
        await asyncio.to_thread(
            log_purchase,
            request.user_id or "demo",
            request.model_dump(),
            result["tx_id"],
        )
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"submit_transaction error: {e}")
        return {"success": False, "error": str(e)}


# ── GET /api/history — purchase history ──────────────────────────────────────

@router.get("/history")
async def get_purchase_history(
    user_id: str = Query(default="demo"),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Return the last `limit` confirmed purchases for user_id, newest first."""
    try:
        history = await asyncio.to_thread(get_history, user_id, limit)
        return {"user_id": user_id, "history": history}
    except Exception as e:
        logger.error(f"get_history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/prefs — update a preference key ────────────────────────────────

class PrefsRequest(BaseModel):
    user_id: str = "demo"
    key: str
    value: str  # always a string from JSON; comma-separated → list


@router.post("/prefs")
async def update_prefs(req: PrefsRequest):
    """
    Set a preference key for user_id.
    If value is a comma-separated string and the key holds a list,
    it is split automatically into a list.
    """
    LIST_KEYS = {"preferred_brands", "avoided_brands", "preferred_sources", "rules"}
    value: object = req.value
    if req.key in LIST_KEYS:
        # comma-separated → list, strip whitespace
        value = [item.strip() for item in req.value.split(",") if item.strip()]
    elif req.key == "max_price":
        try:
            value = float(req.value)
        except ValueError:
            raise HTTPException(status_code=422, detail="max_price must be a number")

    try:
        await asyncio.to_thread(save_pref, req.user_id, req.key, value)
        return {"success": True}
    except Exception as e:
        logger.error(f"update_prefs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/prefs/rule — natural-language rule parsing ─────────────────────

class RuleRequest(BaseModel):
    user_id: str = "demo"
    rule: str


def _parse_rule(rule: str) -> dict:
    """
    Map a natural-language rule to a structured pref update.
    Examples:
        "no refurbished"    → avoided_brands: ["refurbished"]
        "avoid HP"          → avoided_brands: ["HP"]
        "prefer Dell"       → preferred_brands: ["Dell"]
        "under 50000"       → max_price: 50000.0
        "max 80000"         → max_price: 80000.0
    Returns: {"key": ..., "value": ...}
    """
    rule_lower = rule.strip().lower()

    # "no X" / "never X" / "avoid X" → avoided_brands
    m = re.match(r"^(?:no|never|avoid)\s+(.+)$", rule_lower)
    if m:
        brand = m.group(1).strip()
        return {"key": "avoided_brands", "value": brand, "action": "append"}

    # "prefer X" / "always X" → preferred_brands
    m = re.match(r"^(?:prefer|always)\s+(.+?)(?:\s+over\s+.+)?$", rule_lower)
    if m:
        brand = m.group(1).strip()
        return {"key": "preferred_brands", "value": brand, "action": "append"}

    # "under X" / "max X" → max_price
    m = re.match(r"^(?:under|max|maximum|below)\s+[\₹]?([\d,]+(?:\.\d+)?)", rule_lower)
    if m:
        price_str = m.group(1).replace(",", "")
        return {"key": "max_price", "value": float(price_str), "action": "set"}

    # Fallback: treat as a free-text rule added to the rules list
    return {"key": "rules", "value": rule.strip(), "action": "append"}


@router.post("/prefs/rule")
async def add_preference_rule(req: RuleRequest):
    """
    Parse a natural-language rule and save it to user preferences.
    Returns the interpreted action so the frontend can confirm it.
    """
    parsed = _parse_rule(req.rule)
    key    = parsed["key"]
    action = parsed.get("action", "set")
    value  = parsed["value"]

    try:
        prefs = await asyncio.to_thread(load_prefs, req.user_id)
        if action == "append":
            current: list = prefs.get(key, [])
            if value not in current:
                current.append(value)
            await asyncio.to_thread(save_pref, req.user_id, key, current)
            interpreted = {key: current}
        else:  # "set"
            await asyncio.to_thread(save_pref, req.user_id, key, value)
            interpreted = {key: value}

        return {"success": True, "interpreted_as": interpreted}
    except Exception as e:
        logger.error(f"add_preference_rule error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Watchlist endpoints (Part B) ──────────────────────────────────────────────

class WatchlistAddRequest(BaseModel):
    user_id:       str   = "demo"
    title:         str
    current_price: float
    target_price:  float
    source:        str   = ""
    link:          str   = ""
    query:         str   = ""


class WatchlistRemoveRequest(BaseModel):
    user_id: str = "demo"
    title:   str


@router.post("/watchlist")
async def watchlist_add(req: WatchlistAddRequest):
    """Add a product to the user's price watchlist."""
    from agents.watchlist import add_to_watchlist
    try:
        product = {
            "title":  req.title,
            "price":  req.current_price,
            "source": req.source,
            "link":   req.link,
        }
        await asyncio.to_thread(
            add_to_watchlist, req.user_id, product, req.target_price, req.query
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"watchlist_add error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/watchlist")
async def watchlist_get(user_id: str = Query(default="demo")):
    """Return the full watchlist for user_id."""
    from agents.watchlist import get_watchlist
    try:
        items = await asyncio.to_thread(get_watchlist, user_id)
        return {"user_id": user_id, "watchlist": items}
    except Exception as e:
        logger.error(f"watchlist_get error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/watchlist")
async def watchlist_remove(req: WatchlistRemoveRequest):
    """Remove an item from the watchlist by title."""
    from agents.watchlist import remove_from_watchlist
    try:
        await asyncio.to_thread(remove_from_watchlist, req.user_id, req.title)
        return {"success": True}
    except Exception as e:
        logger.error(f"watchlist_remove error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Conversational endpoints (Part D) ─────────────────────────────────────────

class ClarifyRequest(BaseModel):
    query:   str
    user_id: str = "demo"


class EnrichRequest(BaseModel):
    original_query: str
    answers:        dict


@router.post("/clarify")
async def clarify_query(req: ClarifyRequest):
    """
    Determine if a query is too vague.
    If so, return 1-3 clarifying questions.
    """
    from agents.conversation_agent import needs_clarification, get_clarifying_questions
    
    # Needs clarification handles API errors internally & defaults to False
    needs = await asyncio.to_thread(needs_clarification, req.query)
    
    if needs:
        questions = await asyncio.to_thread(get_clarifying_questions, req.query)
        if questions:
            return {"needs_clarification": True, "questions": questions}

    return {"needs_clarification": False, "questions": []}


@router.post("/enrich")
async def enrich_query(req: EnrichRequest):
    """
    Combine original vague query + users answers into a refined search query.
    """
    from agents.conversation_agent import build_enriched_query
    
    enriched = await asyncio.to_thread(
        build_enriched_query, req.original_query, req.answers
    )
    return {"enriched_query": enriched}
