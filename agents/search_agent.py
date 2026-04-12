"""
agents/search_agent.py — product search with 3-tier fallback.

Tier 1: Serper.dev Google Shopping API (live, structured)
Tier 2: Groq Compound model (web search, LLM-parsed)
Tier 3: Mock data (never fails)
"""

import os
import re
import json
import logging
import requests

from tenacity import retry, stop_after_attempt, wait_exponential, RetryError
from groq import Groq

from .state import AgentState
from .mock_data import get_mock_products

logger = logging.getLogger(__name__)

SERPER_ENDPOINT = "https://google.serper.dev/shopping"
_groq_client = None  # lazily created on first use


def _get_groq_client() -> Groq:
    """Return a cached Groq client, creating it on first call."""
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq()  # reads GROQ_API_KEY from env
    return _groq_client


# ── Budget extraction ─────────────────────────────────────────────────────────

def _extract_budget(query: str) -> float | None:
    """Extract upper price limit from query. Returns None if not found."""
    # Match patterns like: under 30000, below ₹30,000, less than 30k,
    # within 30000, upto 30k, under 30K, <30000
    pattern = r'(?:under|below|less\s+than|within|upto|up\s+to|<)\s*₹?\s*([\d,]+)\s*k?'
    match = re.search(pattern, query, re.IGNORECASE)
    if not match:
        return None
    value = float(match.group(1).replace(',', ''))
    # Handle "30k" → 30000
    if re.search(r'\d\s*k\b', match.group(0), re.IGNORECASE):
        value *= 1000
    return value


# ── Query enrichment ──────────────────────────────────────────────────────────

def _enrich_query(query: str) -> str:
    """Append 'buy online India' when no platform is mentioned to improve Shopping results."""
    q = query.lower()
    if "amazon" not in q and "flipkart" not in q:
        return f"{query} buy online India"
    return query


# ── Tier 1: Serper.dev ────────────────────────────────────────────────────────

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
def _call_serper(query: str, max_price: float | None = None) -> list[dict]:
    """Call Serper.dev Google Shopping API. Retries up to 3 times."""
    search_query = _enrich_query(query)
    if max_price:
        # Serper respects price:..NNN Google Shopping syntax
        search_query = f"{search_query} price:..{int(max_price)}"
    r = requests.post(
        SERPER_ENDPOINT,
        headers={"X-API-KEY": os.getenv("SERPER_API_KEY", "")},
        json={"q": search_query, "gl": "in", "num": 20},
        timeout=10,
    )
    r.raise_for_status()
    return _parse_serper_response(r.json(), max_price=max_price)


def _parse_serper_response(data: dict, max_price: float | None = None) -> list[dict]:
    """Parse Serper shopping response into normalised product dicts."""
    products = []
    for item in data.get("shopping", []):
        price = _parse_price(item.get("price"))
        if price is None or price <= 0:
            continue
        # Hard filter — drop anything above budget
        if max_price and price > max_price:
            continue
        products.append({
            "title":        item.get("title", "Unknown Product"),
            "price":        price,
            "rating":       float(item.get("rating") or 3.5),
            "review_count": _parse_int(item.get("ratingCount") or item.get("reviews") or 0),
            "source":       item.get("source", "Unknown"),
            "link":         item.get("link", "#"),
        })
    return products


def _parse_price(raw) -> float | None:
    """Convert price strings like '₹54,990' or '54990.0' to float."""
    if raw is None:
        return None
    cleaned = str(raw).replace("₹", "").replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_int(raw) -> int:
    """Convert review count strings like '2,847' to int."""
    try:
        return int(str(raw).replace(",", "").strip())
    except (ValueError, AttributeError):
        return 0


# ── Tier 2: Groq Compound (web search fallback) ───────────────────────────────

def _call_groq_search(query: str, max_price: float | None = None) -> list[dict]:
    """
    Use Groq's Compound model (has built-in web search) to find products.
    Returns a list of product dicts — may be less structured than Serper.
    """
    response = _get_groq_client().chat.completions.create(
        model="groq/compound",
        messages=[{
            "role": "user",
            "content": (
                f"Search for: {query} available for purchase in India.\n"
                "Return ONLY a valid JSON array of up to 5 products. "
                "Each object must have exactly these keys: "
                "title (string), price_inr (number), rating (number 0-5), "
                "review_count (number), source (string like Amazon or Flipkart).\n"
                "No explanation, no markdown, just the JSON array."
            )
        }],
        max_tokens=600,
    )
    text = response.choices[0].message.content
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if not match:
        raise ValueError("Groq did not return a JSON array")

    raw_products = json.loads(match.group())
    normalised = []
    for p in raw_products:
        price = float(p.get("price_inr") or p.get("price") or 0)
        if price <= 0:
            continue
        # Hard filter — drop anything above budget
        if max_price and price > max_price:
            continue
        normalised.append({
            "title":        str(p.get("title", "Unknown")),
            "price":        price,
            "rating":       float(p.get("rating") or 3.5),
            "review_count": int(p.get("review_count") or 0),
            "source":       str(p.get("source", "Web")),
            "link":         "#",
        })
    return normalised


# ── Agent entry point ─────────────────────────────────────────────────────────

def search_agent(state: AgentState) -> dict:
    """
    Search for products matching the query.
    Falls through Serper → Groq → Mock on failure.
    Always returns {"search_results": [...]} with optional "error" key.
    """
    query = state["query"]
    budget = _extract_budget(query)

    if budget:
        logger.info(f"Budget detected: ₹{budget:,.0f}")

    # Honour MOCK_ONLY flag (useful for tests and offline dev)
    if os.getenv("MOCK_ONLY", "false").lower() == "true":
        logger.info("MOCK_ONLY=true — skipping live search")
        mock_results = get_mock_products(query)
        if budget:
            mock_results = [p for p in mock_results if p["price"] <= budget]
        return {
            "search_results": mock_results,
            "error": "Mock mode — MOCK_ONLY=true",
        }

    # Tier 1: Serper.dev
    if os.getenv("SERPER_API_KEY"):
        try:
            results = _call_serper(query, max_price=budget)
            if results:
                logger.info(f"Serper returned {len(results)} products for '{query}'")
                return {"search_results": results}
            logger.warning("Serper returned 0 products — trying Groq fallback")
        except (RetryError, Exception) as e:
            logger.warning(f"Serper failed after retries: {e} — trying Groq fallback")
    else:
        logger.warning("SERPER_API_KEY not set — skipping Serper tier")

    # Tier 2: Groq web search
    if os.getenv("GROQ_API_KEY"):
        try:
            results = _call_groq_search(query, max_price=budget)
            if results:
                logger.info(f"Groq fallback returned {len(results)} products")
                return {
                    "search_results": results,
                    "error": "Using Groq web search (Serper unavailable)",
                }
        except Exception as e:
            logger.warning(f"Groq search fallback failed: {e} — using mock data")
    else:
        logger.warning("GROQ_API_KEY not set — skipping Groq fallback tier")

    # Tier 3: Mock data (always works)
    logger.info(f"Using mock data for query: '{query}'")
    mock_results = get_mock_products(query)
    if budget:
        mock_results = [p for p in mock_results if p["price"] <= budget]
    return {
        "search_results": mock_results,
        "error": "Live search unavailable — showing sample data",
    }
