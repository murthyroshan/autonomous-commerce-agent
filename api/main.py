"""api/main.py — FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

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
    from api.watchlist_jobs import start_watchlist_scheduler
    start_watchlist_scheduler()
    yield  # app is running
    # shutdown: APScheduler daemon threads exit automatically


app = FastAPI(
    title="Autonomous Commerce AI Agent",
    description="AI-powered shopping assistant with Algorand blockchain logging",
    version="1.0.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [
    os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
# Only add production URL if explicitly configured
_prod_url = os.getenv("PRODUCTION_URL")
if _prod_url:
    ALLOWED_ORIGINS.append(_prod_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
        
    secret = os.getenv("API_SECRET_KEY")
    if secret and request.url.path.startswith("/api/") and request.url.path != "/api/health":
        key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
        if key != secret:
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


@app.get("/")
async def root():
    return {
        "name":    "Autonomous Commerce AI Agent",
        "version": "1.0.0",
        "docs":    "/docs",
        "health":  "/api/health",
    }

