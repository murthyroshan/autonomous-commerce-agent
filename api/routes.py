"""api/routes.py — FastAPI route handlers."""

import asyncio
import json
import logging
import os
import re

from fastapi import APIRouter, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    _limiter = Limiter(key_func=get_remote_address)
    _RATE_LIMIT = "15/minute"
    _rate_limiting_available = True
except ImportError:
    _rate_limiting_available = False
    _limiter = None
    _RATE_LIMIT = None
    logger_init = logging.getLogger(__name__)
    logger_init.warning("slowapi not installed — rate limiting disabled. Run: pip install slowapi")

from agents.pipeline import run_pipeline
from agents.state import initial_state
from agents.search_agent import search_agent
from agents.compare_agent import compare_agent
from agents.decision_agent import decision_agent
from agents.memory import load_prefs, save_pref, log_purchase, get_history
from agents.watchlist import _safe_user_id
from .models import SearchRequest, SearchResponse, ConfirmRequest, ConfirmResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Attach limiter to router state so FastAPI can find it
if _rate_limiting_available and _limiter is not None:
    router.state = type("State", (), {"limiter": _limiter})()


def _rate_limit(limit: str):
    """Return a slowapi limit decorator if available, else a no-op."""
    if _rate_limiting_available and _limiter is not None:
        return _limiter.limit(limit)
    # No-op decorator when slowapi is absent
    def _noop(fn):
        return fn
    return _noop


# ── Health check ──────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok"}


# ── POST /search — full pipeline, single response ────────────────────────────

@router.post("/search", response_model=SearchResponse)
@_rate_limit("15/minute")
async def search(request: Request, req: SearchRequest, user_id: str = Query(default="demo")):
    """
    Run the full agent pipeline and return the complete result.
    Use this for non-streaming clients. Rate limited: 15 req/min per IP.
    """
    try:
        user_id = _safe_user_id(user_id)
        result = await asyncio.to_thread(run_pipeline, req.query, user_id)
        return SearchResponse(
            query=result["query"],
            scored_products=result.get("scored_products", []),
            recommendation=result.get("recommendation") or None,
            error=result.get("error"),
            budget_miss=result.get("budget_miss"),
            battle_contenders=result.get("battle_contenders"),
            battle_report=result.get("battle_report"),
        )
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


# ── GET /search/stream — SSE streaming endpoint ───────────────────────────────

@router.get("/search/stream")
@_rate_limit("15/minute")
async def search_stream(request: Request, query: str, user_id: str = Query(default="demo")):
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
    # TODO: replace with real session token when auth is added
    user_id = _safe_user_id("demo")  # Lock user_id server-side — ignore caller-supplied value

    async def event_generator():
        def sse(data: dict) -> str:
            return f"data: {json.dumps(data)}\n\n"

        try:
            from agents.pipeline import _detect_vs_query, _run_single_search, _pin_best_match, _is_relevant
            is_vs, side_a, side_b = _detect_vs_query(query.strip())
            state = initial_state(query.strip())

            if is_vs:
                if await request.is_disconnected(): return
                yield sse({"type": "status", "message": f"Organizing matchup: {side_a} vs {side_b}..."})
                
                def run_dual_search():
                    from agents.search_agent import _detect_category
                    unified_category = _detect_category(query)
                    if unified_category == "default":
                        unified_category = _detect_category(side_a)
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                        fut_a = executor.submit(_run_single_search, side_a, unified_category)
                        fut_b = executor.submit(_run_single_search, side_b, unified_category)
                        return fut_a.result(), fut_b.result()

                if await request.is_disconnected(): return
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

                if await request.is_disconnected(): return
                yield sse({"type": "status", "message": "Referee evaluating matchup..."})
                if await request.is_disconnected(): return
                decision_result = await asyncio.to_thread(decision_agent, state)
                state.update(decision_result)

            else:
                # ── Standard Mode ──
                # Step 1: Search
                if await request.is_disconnected(): return
                yield sse({"type": "status", "message": "Searching products..."})
                if await request.is_disconnected(): return
                try:
                    search_result = await asyncio.wait_for(
                        asyncio.to_thread(search_agent, state),
                        timeout=30.0
                    )
                except asyncio.TimeoutError:
                    yield sse({"type": "error", "message": "Search timed out. Please try again."})
                    return
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
                if await request.is_disconnected(): return
                yield sse({"type": "status", "message": f"Comparing {len(state['search_results'])} products..."})
                if await request.is_disconnected(): return
                compare_result = await asyncio.to_thread(compare_agent, state, user_id)
                state.update(compare_result)

                # Extract battlefield contenders for standard mode
                scored = state.get("scored_products", [])
                if len(scored) >= 2:
                    state["battle_contenders"] = [scored[0], scored[1]]

                # Step 3: Decision
                if await request.is_disconnected(): return
                yield sse({"type": "status", "message": "Generating recommendation..."})
                if await request.is_disconnected(): return
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
            yield sse({"type": "error", "message": "Search failed — please try again"})
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
        },
    )


# ── POST /confirm — log purchase to Algorand (Phase 4+) ──────────────────────

@router.post("/confirm", response_model=ConfirmResponse)
@_rate_limit("10/minute")
async def confirm_purchase(request: Request, req: ConfirmRequest, background_tasks: BackgroundTasks):
    """
    Log a confirmed purchase to Algorand testnet and record in local history.
    Phase 4: plain PaymentTxn with note field.
    Phase 5: smart contract escrow (deploy + fund).
    """
    tx_id = None
    app_id = None
    explorer_url = None
    contract_url = None
    confirm_error = None

    try:
        # Lazy import — Algorand SDK not required until Phase 4
        from blockchain.algorand import record_purchase_intent
        result = await asyncio.to_thread(
            record_purchase_intent, req.model_dump(), req.user_id
        )
        tx_id        = result.get("tx_id")
        app_id       = result.get("app_id")
        explorer_url = result.get("explorer_url")
        contract_url = result.get("contract_url")  # escrow smart contract link
    except ImportError:
        logger.info("Blockchain module not available (Phase 4+) — logging locally only")
        tx_id = "local-" + req.title[:8].replace(" ", "-").lower()
        confirm_error = "Blockchain logging not enabled yet"
    except ValueError as e:
        logger.info(f"Blockchain not configured ({e}) — logging locally only")
        tx_id = "local-" + req.title[:8].replace(" ", "-").lower()
        confirm_error = "Blockchain credentials not configured — purchase noted locally"
    except Exception as e:
        logger.warning(f"Blockchain logging failed: {e}. Falling back to local history.")
        tx_id = "local-" + req.title[:8].replace(" ", "-").lower()
        confirm_error = f"Blockchain error: {str(e)} — purchase noted locally"

    # Phase 6: log to local purchase history — never block the response
    try:
        product_dict = req.model_dump()
        escrow_status = "locked" if app_id else None
        from agents.memory import log_purchase
        await asyncio.to_thread(log_purchase, req.user_id, product_dict, tx_id, app_id, escrow_status)
    except Exception as e:
        logger.warning(f"log_purchase failed (non-blocking): {e}")

    nft_url = None
    if tx_id and not tx_id.startswith("local-"):
        try:
            from blockchain.algorand import mint_purchase_nft
            from agents.memory import get_next_receipt_number, log_nft_receipt
            receipt_number = get_next_receipt_number()
            nft_result = await asyncio.to_thread(
                mint_purchase_nft,
                req.model_dump(), tx_id, receipt_number
            )
            log_nft_receipt(req.user_id or "demo", nft_result)
            nft_url = nft_result.get("asset_url")
            logger.info(f"NFT receipt #{receipt_number:04d} minted: ASA {nft_result['asset_id']}")
        except Exception as e:
            logger.error(f"NFT mint failed (non-critical): {e}")

    return ConfirmResponse(
        success=True,
        tx_id=tx_id,
        explorer_url=explorer_url,
        app_id=app_id,
        contract_url=contract_url,
        nft_url=nft_url,
        error=confirm_error,
    )


@router.post("/confirm/prepare")
@_rate_limit("10/minute")
async def prepare_transaction(request: Request, req: ConfirmRequest):
    """
    Build an unsigned transaction for Pera wallet signing.
    Frontend calls this, gets txn_b64, passes to Pera,
    then calls /confirm/submit with the signed result.
    """
    try:
        from blockchain.algorand import build_unsigned_transaction

        result = await asyncio.to_thread(build_unsigned_transaction, req.model_dump())
        return {
            "success": True,
            "txn_b64": result.get("txn_b64"),
            "sender": result.get("sender"),
            "amount": result.get("amount"),
        }
    except Exception as e:
        logger.error(f"prepare_transaction error: {e}")
        return {
            "success": False,
            "fallback": True,
            "error": "Wallet signing unavailable — use direct confirm",
        }


@router.post("/confirm/submit")
@_rate_limit("10/minute")
async def submit_transaction(request: Request, req: ConfirmRequest):
    """
    Accept a Pera-signed transaction and submit it to Algorand.
    After the Pera tx is confirmed, deploys the escrow smart contract in a
    background task and returns its contract_url so the frontend can link to it.
    """
    try:
        from blockchain.algorand import submit_signed_transaction

        if req.signed_txn_bytes and len(req.signed_txn_bytes) > 4096:
            raise HTTPException(status_code=400, detail="Transaction payload too large")

        if req.signed_txn_bytes:
            # Bypass base64 — accept raw integer array directly from JSON
            payload = bytes(req.signed_txn_bytes)
        elif req.signed_txn_b64:
            payload = req.signed_txn_b64
        else:
            raise ValueError("Missing signed_txn_b64 or signed_txn_bytes in request body")



        result = await asyncio.to_thread(submit_signed_transaction, payload)
        tx_id = result["tx_id"]

        # Deploy escrow smart contract in background (non-blocking)
        # Returns contract_url immediately if mnemonic is available.
        contract_url: str | None = None
        app_id: int | None = None
        import os
        if os.getenv("ALGORAND_MNEMONIC"):
            try:
                from blockchain.algorand import deploy_and_fund_escrow
                escrow_result = await asyncio.to_thread(
                    deploy_and_fund_escrow, req.model_dump(), req.user_id or "demo"
                )
                contract_url = escrow_result.get("contract_url")
                app_id = escrow_result.get("app_id")
                logger.info(f"Escrow deployed: app_id={app_id}  contract={contract_url}")
            except Exception as escrow_err:
                logger.warning(f"Escrow deploy skipped (non-fatal): {escrow_err}")

        await asyncio.to_thread(
            log_purchase,
            req.user_id or "demo",
            req.model_dump(),
            tx_id,
            app_id,
            "locked" if app_id else None,
        )
        nft_url = None
        if tx_id and not tx_id.startswith("local-"):
            try:
                from blockchain.algorand import mint_purchase_nft
                from agents.memory import get_next_receipt_number, log_nft_receipt
                receipt_number = get_next_receipt_number()
                nft_result = await asyncio.to_thread(
                    mint_purchase_nft,
                    req.model_dump(), tx_id, receipt_number
                )
                log_nft_receipt(req.user_id or "demo", nft_result)
                nft_url = nft_result.get("asset_url")
            except Exception as e:
                logger.error(f"NFT mint failed: {e}")

        response: dict = {"success": True, **result}
        if contract_url:
            response["contract_url"] = contract_url
        if app_id:
            response["app_id"] = app_id
        if nft_url:
            response["nft_url"] = nft_url
        return response
    except Exception as e:
        logger.error(f"submit_transaction error: {e}")
        # Log locally as fallback so it actually shows up in history after a Pera failure
        local_tx_id = "local-" + req.title[:8].replace(" ", "-").lower()
        try:
            await asyncio.to_thread(
                log_purchase,
                req.user_id or "demo",
                req.model_dump(),
                local_tx_id,
            )
        except Exception as log_e:
            logger.error(f"Fallback local log failed: {log_e}")

        return {"success": False, "error": str(e), "tx_id": local_tx_id}


class EscrowActionRequest(BaseModel):
    user_id: str = "demo"
    app_id: int

@router.post("/escrow/confirm_delivery")
async def confirm_delivery_route(req: EscrowActionRequest):
    """Call confirm_delivery on the Escrow Smart Contract."""
    try:
        from blockchain.algorand import call_confirm_delivery
        from agents.memory import update_purchase_status
        result = await asyncio.to_thread(call_confirm_delivery, req.app_id)
        await asyncio.to_thread(update_purchase_status, req.user_id, req.app_id, "delivered")
        return {"success": True, "tx_id": result.get("tx_id")}
    except Exception as e:
        logger.error(f"confirm_delivery error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/escrow/refund")
async def refund_escrow_route(req: EscrowActionRequest):
    """Call auto_refund_after_expiry on the Escrow Smart Contract."""
    try:
        from blockchain.algorand import call_auto_refund_after_expiry
        from agents.memory import update_purchase_status
        result = await asyncio.to_thread(call_auto_refund_after_expiry, req.app_id)
        await asyncio.to_thread(update_purchase_status, req.user_id, req.app_id, "refunded")
        return {"success": True, "tx_id": result.get("tx_id")}
    except Exception as e:
        logger.error(f"refund_escrow error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ── GET /api/history — purchase history ──────────────────────────────────────

@router.get("/history")
@_rate_limit("30/minute")
async def get_purchase_history(
    request: Request,
    user_id: str = Query(default="demo"),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Return the last `limit` confirmed purchases for user_id, newest first."""
    try:
        user_id = _safe_user_id(user_id)
        history = await asyncio.to_thread(get_history, user_id, limit)
        return {"user_id": user_id, "history": history}
    except Exception as e:
        logger.error(f"get_history error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/nfts")
@_rate_limit("30/minute")
async def get_nft_receipts(request: Request, user_id: str = Query(default="demo")):
    import os, json
    path = f"history/{_safe_user_id(user_id)}_nfts.jsonl"
    if not os.path.exists(path):
        return {"nfts": []}
    with open(path) as f:
        nfts = [json.loads(line)
                for line in f if line.strip()]
    return {"nfts": list(reversed(nfts))}


# ── POST /api/prefs — update a preference key ────────────────────────────────

class PrefsRequest(BaseModel):
    user_id: str = "demo"
    key: str
    value: str  # always a string from JSON; comma-separated → list


@router.post("/prefs")
@_rate_limit("20/minute")
async def update_prefs(request: Request, req: PrefsRequest):
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
        raise HTTPException(status_code=500, detail="Internal server error")


# ── POST /api/prefs/rule — natural-language rule parsing ─────────────────────

class RuleRequest(BaseModel):
    user_id: str = "demo"
    rule: str = Field(..., min_length=1, max_length=200)


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
@_rate_limit("20/minute")
async def add_preference_rule(request: Request, req: RuleRequest):
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
        raise HTTPException(status_code=500, detail="Internal server error")


# ── Watchlist endpoints (Part B) ──────────────────────────────────────────────

class WatchlistAddRequest(BaseModel):
    user_id:       str   = "demo"
    title:         str
    current_price: float
    target_price:  float
    source:        str   = ""
    link:          str   = ""
    query:         str   = ""

    from pydantic import field_validator as _fv

    @_fv("link")
    @classmethod
    def no_javascript_uri(cls, v: str) -> str:
        """Reject javascript: and data: URIs to prevent XSS via stored links."""
        lower = v.lower()
        if lower.startswith("javascript:") or lower.startswith("data:"):
            raise ValueError("Invalid link protocol")
        return v


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
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/watchlist")
@_rate_limit("30/minute")
async def watchlist_get(request: Request, user_id: str = Query(default="demo")):
    """Return the full watchlist for user_id."""
    from agents.watchlist import get_watchlist
    try:
        user_id = _safe_user_id(user_id)
        items = await asyncio.to_thread(get_watchlist, user_id)
        return {"user_id": user_id, "watchlist": items}
    except Exception as e:
        logger.error(f"watchlist_get error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


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


# ── GET /social-proof — community review signals ──────────────────────────────

@router.get("/social-proof")
@_rate_limit("30/minute")
async def social_proof_endpoint(
    request: Request,
    title: str = Query(..., max_length=500),
    query: str = Query(default="", max_length=200),
):
    """
    Fetch Reddit/YouTube social signals for a product title.
    Returns sentiment, highlights, and source links.
    """
    from agents.social_proof import get_social_proof
    try:
        result = await asyncio.to_thread(get_social_proof, title, query)
        return result
    except Exception as e:
        logger.error(f"social_proof error: {e}")
        return {
            "sentiment":       "neutral",
            "sentiment_emoji": "⚪",
            "highlights":      [],
            "source_count":    0,
            "reddit_url":      None,
            "youtube_url":     None,
        }


# ── Conversational endpoints (Part D) ─────────────────────────────────────────

class ClarifyRequest(BaseModel):
    query:   str
    user_id: str = "demo"


class EnrichRequest(BaseModel):
    original_query: str
    answers:        dict


@router.post("/clarify")
@_rate_limit("20/minute")
async def clarify_query(request: Request, req: ClarifyRequest):
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
@_rate_limit("20/minute")
async def enrich_query(request: Request, req: EnrichRequest):
    """
    Combine original vague query + users answers into a refined search query.
    """
    from agents.conversation_agent import build_enriched_query
    
    enriched = await asyncio.to_thread(
        build_enriched_query, req.original_query, req.answers
    )
    return {"enriched_query": enriched}


# ── x402 Price Lock endpoints (Phase 7) ───────────────────────────────────────
# The x402 ASGI middleware is registered in api/main.py and gates
# GET /api/v1/x402/initiate.  This route only executes when the middleware
# has already verified payment via the GoPlausible facilitator.

try:
    from x402.http.middleware.fastapi import payment_middleware as _x402_payment_middleware  # noqa: F401
    from x402 import x402ResourceServer as _X402ResourceServer
    from x402.http.facilitator_client import HTTPFacilitatorClient as _X402FacilitatorClient
    _X402_AVAILABLE = True
except ImportError:
    _X402_AVAILABLE = False
    logger.warning(
        "x402 not installed — /api/v1/x402/initiate will return 503. "
        "Run: pip install 'x402-avm[avm,fastapi]'"
    )


def _lookup_verified_price(product_id: str) -> float:
    """Return the cached scraped price for product_id, or 0.0 if not in cache."""
    try:
        from agents.search_agent import _PRICE_CACHE  # type: ignore[attr-defined]
        return float(_PRICE_CACHE.get(product_id, 0.0))
    except (ImportError, AttributeError):
        return 0.0


@router.get("/v1/x402/initiate")
async def x402_initiate(
    request: Request,
    product_id: str = Query(...),
    product_price: float = Query(default=0.0),  # real price from frontend (INR)
):
    """
    x402 Price Lock gate.

    Middleware flow (from x402/http/middleware/fastapi.py):
      1. Unauthenticated GET  → middleware returns 402 + PAYMENT-REQUIRED header.
      2. Authenticated GET    → middleware verifies via GoPlausible facilitator,
                               sets request.state.payment_payload, calls handler.
      3. After handler returns → middleware settles on-chain, adds PAYMENT-RESPONSE
                               header to the 200 response.

    The tx ID is NOT available inside this handler (settlement runs after we
    return).  Read request.state.payment_payload for verified payment details.

    If x402 is not installed the endpoint returns 503 gracefully.
    """
    if not _X402_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "x402 package not installed. "
                "Run: pip install 'x402-avm[avm,fastapi]'"
            ),
        )

    from datetime import datetime, timedelta, timezone

    # ── Read payment state injected by middleware ────────────────────────────
    # The x402 middleware stores the verified PaymentPayload in request.state
    # BEFORE calling this handler.  The PAYMENT-RESPONSE header (with the
    # on-chain tx ID) is added to the response AFTER we return — it is never
    # in the request headers.
    payment_payload = getattr(request.state, "payment_payload", None)
    if payment_payload is None:
        logger.error(
            "/v1/x402/initiate reached without request.state.payment_payload. "
            "Ensure x402 middleware is registered in api/main.py."
        )
        raise HTTPException(
            status_code=500,
            detail=(
                "Payment verification state missing. "
                "x402 middleware may not be configured correctly."
            ),
        )

    # ── Extract payer details from the verified payload ───────────────────────
    try:
        accepted    = payment_payload.accepted
        # Pydantic model uses snake_case internally; camelCase in JSON.
        payer      = getattr(accepted, "pay_to", None) or "unknown"
        asset_id   = getattr(accepted, "asset", "10458941")
        amount_str = getattr(accepted, "amount", "100000")
        amount_display = int(amount_str) / 1_000_000
    except Exception:
        payer = "unknown"
        asset_id = "10458941"
        amount_display = 0.10

    # Use product_price from the query param as primary source;
    # fall back to the agent price cache (populated only after a /search run).
    verified_price = _lookup_verified_price(product_id) or product_price
    now            = datetime.now(timezone.utc)
    lock_expires_at = now + timedelta(minutes=10)

    # The real on-chain tx ID is added to the response headers as PAYMENT-RESPONSE
    # by the middleware after settlement.  We return a placeholder here.
    receipt_placeholder = f"pending:{payer[:20]}"

    logger.info(
        f"Price lock issued: product_id={product_id!r} "
        f"price={verified_price} payer={payer!r} "
        f"amount={amount_display:.6f} (ASA {asset_id})"
    )

    return {
        "product_id":          product_id,
        "verified_price":      verified_price,
        "verified_at":         now.isoformat(),
        "lock_expires_at":     lock_expires_at.isoformat(),
        "facilitator_receipt": receipt_placeholder,
        "explorer_link": (
            f"https://testnet.explorer.algonode.cloud/address/{payer}"
        ),
    }


@router.options("/v1/x402/initiate")
async def x402_initiate_options(request: Request):
    """
    CORS preflight handler for the x402 initiate endpoint.

    The browser sends an OPTIONS preflight before the authenticated GET
    (which carries X-PAYMENT), because X-PAYMENT is a non-standard header.
    Without this handler the preflight gets a 405 and the signed transaction
    can never be sent.
    """
    from fastapi.responses import Response as FResponse
    origin = request.headers.get("origin", "*")
    return FResponse(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin":  origin,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "X-Payment, X-API-Key, Content-Type",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
        },
    )


@router.get("/v1/x402/health")
async def x402_health():
    """
    Return x402 subsystem readiness.

    Used by the frontend to decide whether to show the 'Verify & lock deal'
    button or a 'service unavailable' fallback.
    """
    merchant_wallet = os.environ.get("KARTIQ_MERCHANT_WALLET", "")
    facilitator_url = os.environ.get(
        "FACILITATOR_URL", "https://facilitator.goplausible.xyz"
    )
    network = os.environ.get("ALGORAND_NETWORK", "testnet")

    # Lightweight facilitator reachability check (HEAD, 3-second timeout)
    facilitator_reachable = False
    agent_balance: str = "unknown"
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.head(facilitator_url)
            facilitator_reachable = resp.status_code < 500
    except Exception:
        facilitator_reachable = False

    # Optionally fetch merchant wallet balance from Algorand testnet
    if merchant_wallet:
        try:
            from algosdk.v2client import algod
            algod_client = algod.AlgodClient("", "https://testnet-api.algonode.cloud")
            info = await asyncio.to_thread(algod_client.account_info, merchant_wallet)
            balance_micro = info.get("amount", 0)
            agent_balance = f"{balance_micro / 1_000_000:.4f} ALGO"
        except Exception:
            agent_balance = "unavailable"

    return {
        "agent_balance":         agent_balance,
        "facilitator_reachable": facilitator_reachable,
        "network":               network,
        "x402_middleware_ok":    _X402_AVAILABLE,
        "merchant_wallet": (
            merchant_wallet[:8] + "..." if merchant_wallet else "not set"
        ),
    }

