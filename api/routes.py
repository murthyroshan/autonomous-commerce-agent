"""api/routes.py — FastAPI route handlers."""

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from agents.pipeline import run_pipeline
from agents.state import initial_state
from agents.search_agent import search_agent
from agents.compare_agent import compare_agent
from agents.decision_agent import decision_agent
from .models import SearchRequest, SearchResponse, ConfirmRequest, ConfirmResponse

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Health check ──────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok"}


# ── POST /search — full pipeline, single response ────────────────────────────

@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """
    Run the full agent pipeline and return the complete result.
    Use this for non-streaming clients.
    """
    try:
        result = await asyncio.to_thread(run_pipeline, request.query)
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
async def search_stream(query: str):
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
            state = initial_state(query.strip())

            # Step 1: Search
            yield sse({"type": "status", "message": "Searching products..."})
            search_result = await asyncio.to_thread(search_agent, state)
            state.update(search_result)

            if not state["search_results"]:
                yield sse({"type": "error", "message": state.get("error", "No products found")})
                return

            # Step 2: Compare
            yield sse({"type": "status", "message": f"Comparing {len(state['search_results'])} products..."})
            compare_result = await asyncio.to_thread(compare_agent, state)
            state.update(compare_result)

            # Step 3: Decision
            yield sse({"type": "status", "message": "Generating recommendation..."})
            decision_result = await asyncio.to_thread(decision_agent, state)
            state.update(decision_result)

            # Final result
            yield sse({
                "type":            "result",
                "query":           state["query"],
                "scored_products": state.get("scored_products", []),
                "recommendation":  state.get("recommendation"),
                "error":           state.get("error"),
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
    Log a confirmed purchase to Algorand testnet.
    Phase 4: plain PaymentTxn with note field.
    Phase 5: smart contract escrow.
    """
    try:
        # Lazy import — Algorand SDK not required until Phase 4
        from blockchain.algorand import record_purchase_intent
        result = await asyncio.to_thread(
            record_purchase_intent, request.model_dump(), request.user_id
        )
        return ConfirmResponse(success=True, **result)
    except ImportError:
        # Phase 1–3: blockchain module not yet implemented
        logger.info("Blockchain module not available (Phase 4+) — logging locally only")
        return ConfirmResponse(
            success=True,
            tx_id="local-" + request.title[:8].replace(" ", "-").lower(),
            explorer_url=None,
            error="Blockchain logging not enabled yet",
        )
    except ValueError as e:
        # Phase 1–3: blockchain module exists but ALGORAND_MNEMONIC not configured yet
        logger.info(f"Blockchain not configured ({e}) — logging locally only")
        return ConfirmResponse(
            success=True,
            tx_id="local-" + request.title[:8].replace(" ", "-").lower(),
            explorer_url=None,
            error="Blockchain credentials not configured — purchase noted locally",
        )
    except Exception as e:
        logger.error(f"Confirm purchase error: {e}", exc_info=True)
        return ConfirmResponse(success=False, error=str(e))
