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


# ── Exact model detection ──────────────────────────────────────────────────────

def _is_exact_model_query(query: str) -> bool:
    """
    Return True if the query looks like a specific model lookup
    (e.g. "oneplus 13", "iphone 15 pro") rather than a broad
    category search (e.g. "best phone under 30000").

    Heuristic: query contains a brand name AND a model number
    and does NOT contain category/budget words.
    """
    import re
    q = query.lower().strip()

    # Must contain a recognisable model number (2–4 digits)
    if not re.search(r'\b\d{2,4}\b', q):
        return False

    # Must contain a known phone/laptop brand
    exact_brands = [
        "oneplus", "iphone", "samsung", "pixel", "redmi",
        "realme", "oppo", "vivo", "nothing", "iqoo",
        "mi ", " mi ", "poco", "moto", "motorola",
        "macbook", "thinkpad", "ideapad", "galaxy",
    ]
    if not any(b in q for b in exact_brands):
        return False

    # Broad / budget / category queries are NOT exact model queries
    broad_signals = [
        "best", "top", "under", "below", "budget", "cheap",
        "gaming", "flagship", "recommend", "which",
    ]
    if any(s in q for s in broad_signals):
        return False

    return True


# ── Known model price ranges ──────────────────────────────────────────────────

KNOWN_MODEL_PRICES: dict[str, tuple[int, int]] = {
    # "brand model_num": (min_INR, max_INR)
    "oneplus 13":   (60000, 95000),
    "oneplus 12":   (55000, 85000),
    "oneplus 11":   (45000, 75000),
    "oneplus 13r":  (35000, 55000),
    "oneplus 12r":  (30000, 50000),
    "iphone 15":    (65000, 180000),
    "iphone 14":    (55000, 140000),
    "iphone 13":    (45000, 110000),
    "samsung s24":  (65000, 160000),
    "samsung s23":  (45000, 130000),
    "pixel 9":      (70000, 140000),
    "pixel 8":      (55000, 120000),
}


def _check_model_price_sanity(product: dict, query: str) -> bool:
    """
    Return False if a product's price is outside the known range
    for that specific model, catching mislabelled variants.
    """
    q = query.lower().strip()
    for model_key, (min_p, max_p) in KNOWN_MODEL_PRICES.items():
        if model_key in q:
            price = product.get("price", 0)
            if price < min_p or price > max_p:
                logger.info(
                    f"Price sanity failed for '{product['title']}': "
                    f"₹{price:,.0f} outside known range "
                    f"₹{min_p:,}–₹{max_p:,} for '{model_key}'"
                )
                return False
    return True


def _filter_exact_model_results(
    results: list[dict],
    query: str,
) -> list[dict]:
    """
    When query is an exact model search, remove results whose titles
    contain variant suffixes not present in the query.

    Example: query="oneplus 13" removes any result whose title
    contains "13r", "13s", "13t", "13 pro" unless the query
    itself contains those words.
    """
    import re

    if not _is_exact_model_query(query):
        return results

    q = query.lower().strip()

    # Extract the primary model number from the query
    model_match = re.search(r'\b(\d{2,4})\b', q)
    if not model_match:
        return results

    model_num = model_match.group(1)

    # Variant pattern: model number immediately followed by letters
    # e.g. 13r, 13s, 13t, 12 pro, 12 lite (with optional space)
    variant_pattern = re.compile(
        rf'\b{re.escape(model_num)}\s*[a-z]+\b',
        re.IGNORECASE,
    )

    # Which variants does the QUERY itself contain?
    # e.g. "oneplus 13r" → query_variants = {"13r"}
    # e.g. "oneplus 13"  → query_variants = {} (base model, no variant suffix)
    query_variants = {
        m.group().lower().replace(" ", "")
        for m in variant_pattern.finditer(q)
    }

    filtered: list[dict] = []
    for product in results:
        title = product.get("title", "").lower()

        title_variants = {
            m.group().lower().replace(" ", "")
            for m in variant_pattern.finditer(title)
        }

        if query_variants:
            # Query IS a variant (e.g. "13r") — only keep titles that
            # contain exactly those variant tokens; drop base and other variants
            if title_variants != query_variants and not (query_variants & title_variants):
                logger.info(
                    f"Filtered non-matching variant: '{product['title']}' "
                    f"(wanted: {query_variants}, title has: {title_variants})"
                )
                continue
        else:
            # Query is the base model (e.g. "13") — drop any title with variant suffixes
            extra_variants = title_variants - query_variants
            if extra_variants:
                logger.info(
                    f"Filtered variant: '{product['title']}' "
                    f"(extra variants: {extra_variants})"
                )
                continue

        # Model-aware price sanity
        if not _check_model_price_sanity(product, query):
            logger.info(
                f"Filtered price-anomalous listing: "
                f"'{product['title']}' ₹{product.get('price', 0):,.0f}"
            )
            continue

        filtered.append(product)

    logger.info(
        f"Exact model filter: {len(results)} → {len(filtered)} "
        f"results for '{query}'"
    )
    return filtered


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
    query: str = "",
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

        # Drop refurbished/renewed items unless explicitly requested
        t_lower = title.lower()
        q_lower = query.lower()
        refurb_flags = ["refurbished", "renewed", "pre-owned", "pre owned"]
        is_refurb = any(f in t_lower for f in refurb_flags)
        wants_refurb = any(f in q_lower for f in refurb_flags)
        
        if is_refurb and not wants_refurb:
            logger.info(f"Filtering refurbished product: '{title}'")
            continue

        # Fix broken 'ibp=oshop' links by generating a standard Google Shopping link
        raw_link = item.get("link", "#")
        if "ibp=oshop" in raw_link:
            import urllib.parse
            safe_title = urllib.parse.quote_plus(title)
            raw_link = f"https://www.google.com/search?tbm=shop&q={safe_title}"

        products.append({
            "title":            title,
            "price":            price,
            "rating":           _validate_rating(item.get("rating")),
            "review_count":     _validate_review_count(
                                    item.get("ratingCount") or item.get("reviews")
                                ),
            "source":           item.get("source", "Unknown"),
            "link":             raw_link,
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
    return _parse_serper_response(raw, max_price=max_price, category=category, query=query)


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

    Smart Budget Negotiation (Feature 2):
        If no products are found within the extracted budget, the agent
        performs a second uncapped search, picks the closest product
        above budget, and returns a ``budget_miss`` dict so the pipeline
        can surface a helpful nudge instead of an empty state.
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

    def _do_search(max_price: float | None) -> tuple[list[dict], bool]:
        """Run the full Serper → Groq → Mock waterfall with the given cap.

        Returns:
            (products, used_mock_fallback) — used_mock_fallback=True means
            both live tiers failed and we fell through to sample data.
        """
        if os.getenv("SERPER_API_KEY"):
            try:
                results = _call_serper(query, max_price=max_price, category=category)
                results = _filter_exact_model_results(results, query)  # Fix 1
                logger.info(f"Serper returned {len(results)} products (cap=₹{max_price})")

                # Broaden if too few results
                if len(results) < 3 and budget:
                    logger.info("Too few results — retrying with broader query")
                    broader = _broaden_query(query)
                    if broader != query:
                        extra = _call_serper(broader, max_price=max_price, category=category)
                        existing_titles = {p["title"] for p in results}
                        for p in extra:
                            if p["title"] not in existing_titles:
                                results.append(p)
                                existing_titles.add(p["title"])

                if results:
                    return results, False
                logger.warning("Serper returned 0 products")
            except (RetryError, Exception) as e:
                logger.warning(f"Serper failed: {e}")
        else:
            logger.warning("SERPER_API_KEY not set — skipping Serper tier")

        if os.getenv("GROQ_API_KEY"):
            try:
                results = _call_groq_search(query, max_price=max_price, category=category)
                results = _filter_exact_model_results(results, query)  # Fix 1
                if results:
                    logger.info(f"Groq fallback returned {len(results)} products")
                    return results, False
            except Exception as e:
                logger.warning(f"Groq search fallback failed: {e}")
        else:
            logger.warning("GROQ_API_KEY not set — skipping Groq fallback tier")

        mock_results = get_mock_products(query)
        if max_price:
            mock_results = [p for p in mock_results if p["price"] <= max_price]
        return mock_results, True   # <— signals mock fallback to caller

    # ── Primary search (budget-capped) ────────────────────────────────────────────
    results, used_mock = _do_search(max_price=budget)

    if results:
        out: dict = {"search_results": results}
        if used_mock:
            out["error"] = "Live search unavailable — showing sample data"
        elif len(results) < 3:
            out["error"] = f"Limited results for this budget — showing {len(results)} product(s)"
        return out

    # ── Smart Budget Negotiation (Feature 2) ────────────────────────────────
    # If budget was given but no products found, try without the cap and surface
    # the nearest above-budget product as a "Worth the stretch?" nudge.
    if budget:
        logger.info(
            f"No products found under ₹{budget:,.0f} — running uncapped search"
        )
        uncapped, _ = _do_search(max_price=None)
        above_budget = [
            p for p in uncapped
            if p["price"] > budget
        ]
        if above_budget:
            # Pick the one closest to the budget
            closest = min(above_budget, key=lambda p: p["price"] - budget)
            overage = closest["price"] - budget
            overage_pct = round(overage / budget * 100, 1)
            budget_miss = {
                "product":      closest,
                "budget":       budget,
                "overage":      round(overage, 0),
                "overage_pct":  overage_pct,
                "message": (
                    f"Nothing under ₹{budget:,.0f}. "
                    f"Best option is ₹{closest['price']:,.0f} — "
                    f"₹{overage:,.0f} above your budget. Worth the stretch?"
                ),
            }
            logger.info(
                f"Budget miss: closest is '\'{ closest['title']}\'' at ₹{closest['price']:,.0f}"
            )
            return {
                "search_results": [],
                "budget_miss": budget_miss,
                "error": budget_miss["message"],
            }

    # ── Absolute fallback: return whatever mock data we have ────────────────
    logger.info(f"Using mock data for query: '{query}'")
    mock_results = get_mock_products(query)
    if budget:
        mock_results = [p for p in mock_results if p["price"] <= budget]
    return {
        "search_results": mock_results,
        "error": "Live search unavailable — showing sample data",
    }
