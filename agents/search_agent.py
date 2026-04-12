"""
agents/search_agent.py — product search with 3-tier fallback.

Tier 1: Serper.dev Google Shopping API (live, structured)
Tier 2: Groq Compound model (web search, LLM-parsed)
Tier 3: Mock data (never fails)

Data quality layer (applied to Serper results):
- Price sanity validation per category
- Honest rating/review-count handling (no fake defaults)
- Irrelevant accessory filtering
- Duplicate deduplication (keep cheapest)
"""

import os
import re
import json
import logging
import requests

from tenacity import retry, stop_after_attempt, wait_exponential, RetryError
from groq import Groq

from .state import AgentState
from .mock_data import get_mock_products, CATEGORY_KEYWORDS

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
    """Extract upper price limit from query. Returns None if not found.

    Handles:
      - between X and Y → upper bound Y
      - under/below/within/upto/for/around/₹/rs. + number
      - 25k, 30K (case-insensitive k suffix)
      - Hindi: "30000 mein", "30k rupay"
      - standalone number near budget words
    """
    q = query.lower()

    # Pattern 1: between X and Y → use Y as upper bound
    between = re.search(
        r'between\s*₹?\s*([\d,]+)\s*k?\s*(?:and|to|-)\s*₹?\s*([\d,]+)\s*(k|thousand)?',
        q,
    )
    if between:
        val = float(between.group(2).replace(',', ''))
        if between.group(3) in ('k', 'thousand'):
            val *= 1000
        return val

    # Pattern 2: explicit keyword + number
    explicit = re.search(
        r'(?:under|below|less\s+than|within|upto|up\s+to|around|'
        r'for|budget\s+of|<|₹|rs\.?|inr)\s*₹?\s*([\d,]+)\s*(k|thousand)?',
        q,
    )
    if explicit:
        val = float(explicit.group(1).replace(',', ''))
        if explicit.group(2) in ('k', 'thousand'):
            val *= 1000
        if 'around' in q:
            val *= 1.10
        return val

    # Pattern 3: Hindi "X mein" / "X rupay" pattern
    hindi = re.search(r'([\d,]+)\s*(k)?\s*(?:mein|me\b|rupay|rupee)', q)
    if hindi:
        val = float(hindi.group(1).replace(',', ''))
        if hindi.group(2) == 'k':
            val *= 1000
        return val

    # Pattern 4: standalone number near budget-related words
    if any(w in q for w in ['budget', 'price', 'cost', 'spend', 'afford']):
        num = re.search(r'([\d,]+)\s*(k)?', q)
        if num:
            val = float(num.group(1).replace(',', ''))
            if num.group(2) == 'k':
                val *= 1000
            if val > 1000:
                return val

    return None


# ── Category detection ────────────────────────────────────────────────────────

def _detect_category(query: str) -> str:
    """Return the category key that best matches the query."""
    q = query.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in q for kw in keywords):
            return category
    return "default"


# ── Price sanity validation ───────────────────────────────────────────────────

PRICE_SANITY: dict[str, dict[str, float]] = {
    "laptop":     {"min": 8000,    "max": 500000},
    "phone":      {"min": 3000,    "max": 200000},
    "tv":         {"min": 8000,    "max": 500000},
    "headphones": {"min": 200,     "max": 80000},
    "earbuds":    {"min": 200,     "max": 30000},
    "speaker":    {"min": 300,     "max": 50000},
    "watch":      {"min": 500,     "max": 100000},
    "tablet":     {"min": 5000,    "max": 200000},
    "keyboard":   {"min": 200,     "max": 30000},
    "mouse":      {"min": 150,     "max": 20000},
    "camera":     {"min": 3000,    "max": 500000},
    "default":    {"min": 100,     "max": 1000000},
}


def _is_price_sane(price: float, category: str, budget: float | None) -> bool:
    """
    Return False if price is clearly fake or impossible.
    Checks both category floor/ceiling and budget constraint.
    """
    bounds = PRICE_SANITY.get(category, PRICE_SANITY["default"])
    if price < bounds["min"]:
        return False
    if price > bounds["max"]:
        return False
    if budget and price > budget:
        return False
    return True


# ── Rating / review-count validators ─────────────────────────────────────────

def _validate_rating(raw) -> float:
    """
    Return the actual rating if present and valid.
    Returns 0.0 if missing — signals unverified to the scorer.
    """
    if raw is None:
        return 0.0
    try:
        r = float(str(raw).strip())
        if 0.0 <= r <= 5.0:
            return r
        return 0.0
    except (ValueError, TypeError):
        return 0.0


def _validate_review_count(raw) -> int:
    """Return review count. Returns 0 if missing or unparseable."""
    if raw is None:
        return 0
    try:
        s = str(raw).strip().lower().replace(",", "")
        # Handle "1.2k", "2k", "1.5k" style strings
        if s.endswith("k"):
            return int(float(s[:-1]) * 1000)
        return max(0, int(float(s)))
    except (ValueError, TypeError):
        return 0


# ── Relevance filter ──────────────────────────────────────────────────────────

IRRELEVANT_KEYWORDS: dict[str, list[str]] = {
    "headphones": ["case", "cover", "stand", "holder", "pad", "cushion",
                   "cable", "adapter", "charger", "pouch", "bag", "hook",
                   "hanger", "mount", "replacement", "spare"],
    "earbuds":    ["case", "cover", "tip", "foam tip", "ear tip", "cable",
                   "adapter", "charger", "wing tip", "replacement"],
    "phone":      ["case", "cover", "tempered glass", "screen protector",
                   "charger", "cable", "holder", "stand", "pop socket",
                   "back cover", "flip cover", "wallet case"],
    "laptop":     ["bag", "sleeve", "stand", "cooling pad", "skin",
                   "keyboard cover", "charger", "adapter", "cable",
                   "mouse pad", "sticker"],
    "tv":         ["wall mount", "bracket", "remote", "stand", "cover",
                   "screen guard", "hdmi", "cable"],
    "camera":     ["bag", "case", "strap", "tripod", "filter", "lens cap",
                   "memory card", "battery", "charger"],
}


def _is_relevant(title: str, category: str) -> bool:
    """Return False if the title looks like an accessory, not the main product."""
    irrelevant = IRRELEVANT_KEYWORDS.get(category, [])
    title_lower = title.lower()
    for kw in irrelevant:
        if kw in title_lower:
            logger.info(f"Filtering accessory: '{title}'")
            return False
    return True


# ── Deduplication ─────────────────────────────────────────────────────────────

def _deduplicate(products: list[dict]) -> list[dict]:
    """
    Remove duplicate products. Two products are duplicates if their
    titles are very similar (first 40 chars match after lowercasing).
    Keep the one with the lower price.
    """
    seen: dict[str, dict] = {}
    for p in products:
        key = p["title"].lower()[:40].strip()
        if key not in seen:
            seen[key] = p
        else:
            # Keep cheaper one
            if p["price"] < seen[key]["price"]:
                seen[key] = p
    return list(seen.values())


# ── Query enrichment ──────────────────────────────────────────────────────────

def _enrich_query(query: str) -> str:
    """Append context for better Google Shopping results in the Indian market."""
    q = query.lower()
    # Already has platform or site context — leave as-is
    if any(w in q for w in ['amazon', 'flipkart', 'site:']):
        return query
    # Already has India context — just add buy-intent
    if any(w in q for w in ['india', 'indian', 'inr', '₹']):
        return f"{query} buy online"
    # Generic: add India + buy-intent
    return f"{query} buy online India"


def _broaden_query(query: str) -> str:
    """Strip premium qualifiers to widen the result set."""
    qualifiers = [
        'gaming', 'best', 'top', 'premium', 'pro', 'ultra',
        'high end', 'high-end', 'flagship',
    ]
    q = query
    for word in qualifiers:
        q = re.sub(rf'\b{word}\b', '', q, flags=re.IGNORECASE)
    return ' '.join(q.split())  # collapse extra spaces


# ── Price parser (raw string → float) ────────────────────────────────────────

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


# ── Tier 1: Serper.dev ────────────────────────────────────────────────────────

def _parse_serper_response(
    data: dict,
    max_price: float | None = None,
    category: str = "default",
) -> list[dict]:
    """Parse Serper shopping response into sanitised, normalised product dicts."""
    products = []
    for item in data.get("shopping", []):
        price = _parse_price(item.get("price"))
        if price is None or price <= 0:
            continue

        # Hard sanity check — drop impossible prices
        if not _is_price_sane(price, category, max_price):
            logger.info(
                f"Dropping '{item.get('title', '?')}' — "
                f"price ₹{price:,.0f} fails sanity check for {category}"
            )
            continue

        # Filter accessories / irrelevant results
        title = item.get("title", "Unknown Product")
        if not _is_relevant(title, category):
            continue

        products.append({
            "title":            title,
            "price":            price,
            "rating":           _validate_rating(item.get("rating")),
            "review_count":     _validate_review_count(
                                    item.get("ratingCount") or item.get("reviews")
                                ),
            "source":           item.get("source", "Unknown"),
            "link":             item.get("link", "#"),
            "has_real_rating":  item.get("rating") is not None,
        })

    return _deduplicate(products)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
def _call_serper(
    query: str,
    max_price: float | None = None,
    category: str = "default",
) -> list[dict]:
    """Call Serper.dev Google Shopping API. Retries up to 3 times."""
    search_query = _enrich_query(query)
    r = requests.post(
        SERPER_ENDPOINT,
        headers={"X-API-KEY": os.getenv("SERPER_API_KEY", "")},
        json={"q": search_query, "gl": "in", "num": 20},
        timeout=10,
    )
    r.raise_for_status()
    raw = r.json()
    return _parse_serper_response(raw, max_price=max_price, category=category)


# ── Tier 2: Groq Compound (web search fallback) ───────────────────────────────

def _call_groq_search(
    query: str,
    max_price: float | None = None,
    category: str = "default",
) -> list[dict]:
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
        if not _is_price_sane(price, category, max_price):
            continue
        title = str(p.get("title", "Unknown"))
        if not _is_relevant(title, category):
            continue
        normalised.append({
            "title":           title,
            "price":           price,
            "rating":          _validate_rating(p.get("rating")),
            "review_count":    _validate_review_count(p.get("review_count")),
            "source":          str(p.get("source", "Web")),
            "link":            "#",
            "has_real_rating": p.get("rating") is not None,
        })
    return _deduplicate(normalised)


# ── Agent entry point ─────────────────────────────────────────────────────────

def search_agent(state: AgentState) -> dict:
    """
    Search for products matching the query.
    Falls through Serper → Groq → Mock on failure.
    Always returns {"search_results": [...]} with optional "error" key.
    """
    query    = state["query"]
    budget   = _extract_budget(query)
    category = _detect_category(query)

    if budget:
        logger.info(f"Budget detected: ₹{budget:,.0f}")
    logger.info(f"Category detected: {category}")

    # Honour MOCK_ONLY flag (useful for tests and offline dev)
    if os.getenv("MOCK_ONLY", "false").lower() == "true":
        logger.info("MOCK_ONLY=true — skipping live search")
        mock_results = get_mock_products(query)
        if budget:
            mock_results = [p for p in mock_results if p["price"] <= budget]
        error = "Mock mode — MOCK_ONLY=true"
        if len(mock_results) < 3:
            error = f"Limited results for this budget — showing {len(mock_results)} product(s)"
        return {"search_results": mock_results, "error": error}

    # Tier 1: Serper.dev
    if os.getenv("SERPER_API_KEY"):
        try:
            results = _call_serper(query, max_price=budget, category=category)
            logger.info(f"Serper returned {len(results)} products for '{query}'")

            # Broaden if too few results
            if len(results) < 3 and budget:
                logger.info("Too few results — retrying with broader query")
                broader = _broaden_query(query)
                if broader != query:
                    extra = _call_serper(broader, max_price=budget, category=category)
                    existing_titles = {p["title"] for p in results}
                    for p in extra:
                        if p["title"] not in existing_titles:
                            results.append(p)
                            existing_titles.add(p["title"])


            if results:
                out: dict = {"search_results": results}
                if len(results) < 3:
                    out["error"] = f"Limited results for this budget — showing {len(results)} product(s)"
                return out
            logger.warning("Serper returned 0 products — trying Groq fallback")
        except (RetryError, Exception) as e:
            logger.warning(f"Serper failed after retries: {e} — trying Groq fallback")
    else:
        logger.warning("SERPER_API_KEY not set — skipping Serper tier")

    # Tier 2: Groq web search
    if os.getenv("GROQ_API_KEY"):
        try:
            results = _call_groq_search(query, max_price=budget, category=category)
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
