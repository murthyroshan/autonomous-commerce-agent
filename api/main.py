"""api/main.py — FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

import asyncio
import concurrent.futures
import hmac

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .routes import router, _limiter, _rate_limiting_available

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background services on startup, clean up on shutdown."""
    # Security: warn early if critical env vars are absent
    required = ["SERPER_API_KEY", "GROQ_API_KEY"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        logger.warning(
            f"Missing env vars: {missing}. "
            f"Running in degraded mode."
        )

    # Configure thread pool explicitly to prevent exhaustion under load
    loop = asyncio.get_event_loop()
    executor = concurrent.futures.ThreadPoolExecutor(
        max_workers=int(os.getenv("THREAD_POOL_SIZE", "20")),
        thread_name_prefix="kartiq-worker",
    )
    loop.set_default_executor(executor)

    from api.watchlist_jobs import start_watchlist_scheduler
    start_watchlist_scheduler()

    # Pre-warm search cache for common queries (gated behind PREWARM_QUERIES env var)
    prewarm_queries = os.getenv("PREWARM_QUERIES", "").split(",")
    prewarm_queries = [q.strip() for q in prewarm_queries if q.strip()]
    if prewarm_queries:
        import asyncio as _asyncio
        from agents.search_agent import prewarm_cache
        logger.info(f"Pre-warming cache for {len(prewarm_queries)} queries...")
        await _asyncio.to_thread(prewarm_cache, prewarm_queries)
        logger.info("Cache pre-warm complete")

    yield  # app is running
    # shutdown: APScheduler daemon threads exit automatically


app = FastAPI(
    title="Autonomous Commerce AI Agent",
    description="AI-powered shopping assistant with Algorand blockchain logging",
    version="1.0.0",
    lifespan=lifespan,
)

is_prod = os.getenv("NODE_ENV", "development") == "production"
ALLOWED_ORIGINS: list[str] = []
if not is_prod:
    ALLOWED_ORIGINS += [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
frontend_origin = os.getenv("FRONTEND_ORIGIN")
if frontend_origin:
    ALLOWED_ORIGINS.append(frontend_origin)
prod_url = os.getenv("PRODUCTION_URL")
if prod_url:
    ALLOWED_ORIGINS.append(prod_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Explicitly expose x402 v2 and legacy headers so browser fetch() can read them.
    # Without this, CORSMiddleware overwrites Access-Control-Expose-Headers with an
    # empty string, hiding PAYMENT-REQUIRED from JavaScript even though the server
    # sends it in the 402 response.
    expose_headers=[
        "PAYMENT-REQUIRED",       # x402 v2 — 402 payment requirements (base64 JSON)
        "PAYMENT-SIGNATURE",      # x402 v2 — request payment header
        "PAYMENT-RESPONSE",       # x402 v2 — settlement response
        "X-402-Payment-Request",  # legacy v1
        "X-Payment-Response",     # legacy v1
        "X-Payment",              # legacy v1
    ],
)

@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    secret = os.getenv("API_SECRET_KEY")
    if secret and request.url.path.startswith("/api/") and request.url.path != "/api/health":
        # Header-only: no query-param fallback to prevent key leakage in server logs
        key = request.headers.get("X-API-Key")
        if not hmac.compare_digest(key or "", secret):
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=401, content={"detail": "Unauthorised"})
    return await call_next(request)

app.include_router(router, prefix="/api")

# Register slowapi rate-limit handler (returns HTTP 429 with JSON body)
if _rate_limiting_available and _limiter is not None:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    app.state.limiter = _limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── x402 Payment middleware (Phase 7) ──────────────────────────────────────────
# Gates GET /api/v1/x402/initiate with a 0.1 ALGO Algorand payment requirement.
# All other routes are unaffected.
try:
    from x402.http.middleware.fastapi import payment_middleware as _x402_payment_middleware
    from x402 import x402ResourceServer as _X402ResourceServer
    from x402.http.facilitator_client import HTTPFacilitatorClient as _X402FacilitatorClient
    from x402.mechanisms.avm.exact.register import register_exact_avm_server
    from x402.mechanisms.avm.constants import ALGORAND_TESTNET_CAIP2, ALGORAND_MAINNET_CAIP2

    _merchant_wallet = os.getenv("KARTIQ_MERCHANT_WALLET", "")
    _facilitator_url = os.getenv("FACILITATOR_URL", "https://facilitator.goplausible.xyz")
    _network_env     = os.getenv("ALGORAND_NETWORK", "testnet")

    # Map env var → correct CAIP-2 identifier (genesis hash required)
    _network_caip2 = (
        ALGORAND_MAINNET_CAIP2
        if _network_env == "mainnet"
        else ALGORAND_TESTNET_CAIP2   # default: testnet
    )

    if _merchant_wallet:
        _facilitator_client = _X402FacilitatorClient(config={"url": _facilitator_url})
        _x402_server        = _X402ResourceServer(facilitator_clients=_facilitator_client)

        # Register the AVM exact-payment scheme on the server.
        # Without this the middleware cannot decode/verify Algorand transactions.
        register_exact_avm_server(_x402_server)

        _x402_routes = {
            "GET /api/v1/x402/initiate": {
                "accepts": [
                    {
                        "scheme":  "exact",
                        "network": _network_caip2,
                        "payTo":   _merchant_wallet,
                        # AssetAmount: USDC ASA on Algorand testnet.
                        # The x402-avm facilitator requires axfer (ASA transfer),
                        # not a native ALGO pay transaction.
                        # USDC testnet ASA ID: 10458941
                        # 0.10 USDC = 100,000 micro-USDC (6 decimals)
                        "price": {
                            "amount": "100000",
                            "asset":  "10458941",
                            "extra":  {"decimals": 6},
                        },
                    }
                ]
            }
        }

        # Build the middleware handler ONCE at startup (not per-request).
        # payment_middleware() returns a closure with its own init_done flag —
        # calling it per-request would reset the flag and re-initialize on every hit.
        _x402_handler = _x402_payment_middleware(
            routes=_x402_routes,
            server=_x402_server,
            sync_facilitator_on_start=True,   # auto-calls initialize() on first hit
        )

        @app.middleware("http")
        async def x402_payment_gate(request, call_next):
            """x402 ASGI middleware — gates /api/v1/x402/initiate only.

            Manually stamps CORS headers onto 402 responses so the browser's
            fetch() can read the response body and headers instead of throwing
            an opaque 'Failed to fetch' TypeError.
            """
            response = await _x402_handler(request, call_next)

            # ── Stamp CORS on 402 responses ──────────────────────────────────
            # The x402 middleware short-circuits before the outer CORSMiddleware
            # can add headers.  Without this, fetch() throws "Failed to fetch".
            if response.status_code in (402, 200):
                origin = request.headers.get("origin", "")
                allow_origin = origin if origin in ALLOWED_ORIGINS else (ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*")
                response.headers["Access-Control-Allow-Origin"]      = allow_origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Expose-Headers"]    = (
                    # x402 v2 headers (current SDK)
                    "PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE, "
                    # x402 v1 legacy headers
                    "X-402-Payment-Request, X-Payment-Response, X-Payment, "
                    "Content-Type"
                )

            return response

        logger.info(
            f"x402 payment middleware active: /api/v1/x402/initiate "
            f"→ {_merchant_wallet[:8]}... ({_network_caip2[:30]}...)"
        )
    else:
        logger.warning(
            "KARTIQ_MERCHANT_WALLET not set — x402 middleware not registered. "
            "Set this env var to enable the Price Lock feature."
        )
except ImportError as _e:
    logger.info(f"x402 package not installed — payment middleware skipped. ({_e})")


@app.get("/")
async def root():
    return {
        "name":    "Autonomous Commerce AI Agent",
        "version": "1.0.0",
        "docs":    "/docs",
        "health":  "/api/health",
    }

