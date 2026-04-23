"""api/main.py — FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .routes import router

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background services on startup, clean up on shutdown."""
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
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


@app.get("/")
async def root():
    return {
        "name":    "Autonomous Commerce AI Agent",
        "version": "1.0.0",
        "docs":    "/docs",
        "health":  "/api/health",
    }

