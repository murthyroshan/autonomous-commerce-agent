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
import time
import logging
import requests

from tenacity import retry, stop_after_attempt, wait_exponential, RetryError
from groq import Groq

from .state import AgentState
from .mock_data import get_mock_products, CATEGORY_KEYWORDS

logger = logging.getLogger(__name__)

SERPER_ENDPOINT = "https://google.serper.dev/shopping"
_groq_client = None  # lazily created on first use

# ── In-process search result cache (TTL = 1 hour) ────────────────────────────
_CACHE_TTL_SECONDS = 3600  # 1 hour
_search_cache: dict[str, tuple[float, dict]] = {}

# ── Supplemental search call counter (for monitoring) ────────────────────────
_supplemental_search_count = 0


def _cache_get(key: str) -> dict | None:
    """Return cached result if still within TTL, else None."""
    entry = _search_cache.get(key)
    if entry is None:
        return None
    cached_at, value = entry
    if time.time() - cached_at > _CACHE_TTL_SECONDS:
        del _search_cache[key]
        return None
    return value


def _cache_set(key: str, value: dict) -> None:
    """Store result in cache with current timestamp. Evicts oldest entry when cap reached."""
    if len(_search_cache) >= 500:
        oldest_key = min(_search_cache, key=lambda k: _search_cache[k][0])
        del _search_cache[oldest_key]
    _search_cache[key] = (time.time(), value)


def prewarm_cache(queries: list[str]) -> None:
    """Run search_agent for each query to populate the cache before demo."""
    for q in queries:
        state: AgentState = {"query": q, "search_results": [], "scored_products": [],
                             "recommendation": {}, "error": None, "category": None,
                             "budget_miss": None, "battle_contenders": None,
                             "battle_report": None}
        logger.info(f"Pre-warming cache for query: '{q}'")
        search_agent(state)
        logger.info(f"Cache pre-warm complete for: '{q}'") 


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


def _is_price_sane(price: float, category: str, budget: float | None, query: str = "") -> bool:
    """
    Return False if price is clearly fake or impossible.
    Checks both category floor/ceiling and budget constraint.
    """
    bounds = PRICE_SANITY.get(category, PRICE_SANITY["default"])
    min_cap = bounds["min"]
    
    # Counterfeit protection for highly-spoofed premium brands
    q = query.lower()
    if 'apple' in q or 'airpods' in q or 'macbook' in q or 'iphone' in q:
        min_cap = max(min_cap, 3000)
        # Pro/Max Apple gear is never under 10k even used
        if 'max' in q or 'pro' in q:
            min_cap = max(min_cap, 10000)

    if price < min_cap:
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

# Cross-category blocklist: words that definitively mark a result as the WRONG
# category entirely.  Applied BEFORE the affix exclusion check.
# Keys are the queried category; values are title fragments that kill the result.
CROSS_CATEGORY_BLOCKLIST: dict[str, list[str]] = {
    "phone": [
        # Laptop / PC parts
        "laptop battery", "laptop keyboard", "laptop charger", "laptop screen",
        "notebook battery", "lcd screen", "display replacement", "keyboard compatible",
        # Electrical / industrial
        "power entry connector", "power supply", "isolation converter", "isolator",
        "terminal block", "assembly terminal", "receptacle", "nema", "relay",
        "circuit breaker", "din rail", "transformer",
        # Stage / AV
        "moving head", "beam light", "sharpy beam", "stage light", "lamp bulb",
        # Automotive / tools
        "alternator", "motor winding", "drill bit", "socket wrench",
        # Second-hand / sell listings (not a product purchase)
        "sell oneplus", "sell samsung", "sell iphone", "sell redmi",
        # Spare parts
        "original lcd", "original display", "replacement screen", "back panel replacement",
        "screen display", "touch screen digitizer", "touch glass", "camera lens glass",
        "display module", "display folder", "motherboard", "logic board",
        "charging flex", "flex cable", "charging board",
    ],
    "laptop": [
        # Phone parts
        "mobile battery", "phone battery", "smartphone battery",
        # Electrical / industrial
        "power entry connector", "power supply", "isolation converter", "isolator",
        "terminal block", "assembly terminal", "receptacle", "nema", "relay",
        # Stage / AV
        "moving head", "beam light", "sharpy beam", "stage light", "lamp bulb",
    ],
    "tv": [
        "power entry connector", "power supply", "isolation converter",
        "terminal block", "relay", "circuit breaker",
        "moving head", "beam light", "stage light",
    ],
    "headphones": [
        "power entry connector", "power supply", "isolation converter",
        "terminal block", "relay", "stage light", "moving head",
    ],
    "earbuds": [
        "power entry connector", "power supply", "isolation converter",
        "terminal block", "relay", "stage light", "moving head",
    ],
}


def _is_relevant(title: str, category: str) -> bool:
    """Return False if the title looks like an accessory or a completely wrong
    category product (cross-category contamination)."""
    title_lower = title.lower()

    # Step 1: accessory filter (same-category accessories)
    irrelevant = IRRELEVANT_KEYWORDS.get(category, [])
    for kw in irrelevant:
        if kw in title_lower:
            logger.info(f"Filtering accessory: '{title}'")
            return False

    # Step 2: cross-category contamination filter
    blocklist = CROSS_CATEGORY_BLOCKLIST.get(category, [])
    for phrase in blocklist:
        if phrase in title_lower:
            logger.info(f"Cross-category filter [{category}]: '{title}' blocked by '{phrase}'")
            return False

    # Step 3: Specific regex blocks
    if category == "phone":
        # Block "battery" unless preceded by mAh/Ah which implies a spec on a phone
        if re.search(r'\bbattery\b', title_lower) and not re.search(r'(mah|ah)\s*battery|\bbattery\s*(capacity|life)', title_lower):
            logger.info(f"Regex filter [phone battery]: '{title}' blocked")
            return False
        
        # Block generic LCD/display panels that don't match blocklist exactly
        if re.search(r'\b(lcd|amoled|oled)\b.*\b(display|screen|panel|combo|folder)\b', title_lower):
            logger.info(f"Regex filter [phone screen]: '{title}' blocked")
            return False

    return True


def _affix_exclusion_check(query: str, products: list[dict]) -> list[dict]:
    """
    Ultra-fast deterministic model suffix exclusion.
    If the search query is for a BASE model (e.g. '13'), strictly reject
    search engine results that leaked trailing suffixes (e.g. '13R', '13 Pro').
    """
    valid_products = []
    query_lower = query.lower()
    
    # Strip price/spec integers before extracting model tokens.
    # Rule: any standalone number > 999 is a price or spec, not a model token.
    # Rule: any number with a k suffix (e.g. 20k, 30K) is a price.
    query_no_price = re.sub(
        r'(under|below|less\s+than|max|budget|rs\.?|₹|upto|up\s+to|within|around|for)\s*'
        r'[\d,]+\s*(k|thousand)?\b',
        '', query_lower, flags=re.IGNORECASE
    )
    query_no_price = re.sub(r'\b[\d,]+\s*(k)?\s*(?:mein|me\b|rupay|rupee)\b', '', query_no_price)
    # Remove all standalone large numbers (>999) — these are always prices/specs
    query_no_price = re.sub(r'\b\d{4,}\b', '', query_no_price)
    # Remove k-suffixed numbers (30k, 20K)
    query_no_price = re.sub(r'\b\d+[kK]\b', '', query_no_price)

    # Extract structural model tokens (e.g. '13', 'm3', 's24') from the normalized query
    model_tokens = re.findall(r'\b[a-z]*[0-9]+[a-z]*\b', query_no_price)

    # No model tokens = generic query; affix filtering would only lose results
    if not model_tokens:
        return products
    
    # For Apple products, chip/model variants are always relevant —
    # M3 Pro and M3 Max ARE valid results for "MacBook M3".
    # Skip affix exclusion entirely for Apple queries.
    apple_keywords = ['macbook', 'iphone', 'ipad', 'airpods', 'apple watch',
                      'mac mini', 'imac']
    if any(kw in query_lower for kw in apple_keywords):
        return products

    for p in products:
        title_lower = p.get('title', '').lower()
        is_valid = True
        
        for token in model_tokens:
            # Skip pure specifications (e.g., '144hz', '5g')
            if re.match(r'^\d+(g|gb|tb|mah|hz|w|inch|cm|k)$', token):
                continue
            
            # Skip generalized specs that blend letters and numbers (e.g., 'wifi6', 'ddr5', 'gen4')
            if re.match(r'^(wifi|gen|ddr|usb|bt|hdmi)[0-9]+$', token):
                continue
                
            # POSITIVE MATCH: Must physically contain the core model token
            if not re.search(rf'(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])', title_lower):
                logger.info(f"Filtered out missing core token '{token}' in '{title_lower}'")
                is_valid = False
                break
                
            # Reject if token is structurally embedded in something else (e.g., '13R')
            attached_suffix_pattern = rf'\b{re.escape(token)}[A-Za-z]+\b'
            for match in re.findall(attached_suffix_pattern, title_lower):
                if match not in query_lower:
                    logger.info(f"Filtered out suffix variant: '{match}' in '{title_lower}'")
                    is_valid = False
                    break
            
            # Reject if token has separated generic suffix (e.g. '13 Pro')
            variant_words = [
                'pro', 'max', 'ultra', 'plus', 'fe', 'lite', 'se', 'r',
                'mini', 'air', 'studio', 'active', 'neo', 'edge', 'turbo',
            ]
            # Normalize the query to catch symbol equivalents (+ → plus, & → and)
            query_normalized = (
                query_lower
                .replace('+', ' plus')
                .replace('&', ' and')
            )
            for var in variant_words:
                sep_pattern = rf'\b{re.escape(token)}\s+{var}\b'
                if re.search(sep_pattern, title_lower):
                    # Only filter if this variant is genuinely absent from the query
                    var_in_query = (
                        re.search(sep_pattern, query_normalized) is not None
                        or var in query_normalized.split()
                    )
                    if not var_in_query:
                        logger.info(f"Filtered out variant word: '{var}' in '{title_lower}'")
                        is_valid = False
                        break
            if not is_valid:
                break
                
        # Guard against Desktop matching Laptop (Mac vs iMac/Mac mini)
        if 'mac' in query_lower and 'macbook' not in query_lower:
            if 'imac' in title_lower and 'imac' not in query_lower:
                is_valid = False
            elif 'mac mini' in title_lower and 'mini' not in query_lower:
                is_valid = False

        if is_valid:
            valid_products.append(p)

    # Safety net: if the filter removed ALL results, return unfiltered rather
    # than letting the pipeline see an empty list and fall through to mock data.
    if not valid_products and products:
        logger.warning(
            f"_affix_exclusion_check filtered ALL {len(products)} products "
            f"for query '{query}' — returning unfiltered to avoid empty results"
        )
        return products
    return valid_products


# ── Deduplication ─────────────────────────────────────────────────────────────

def _deduplicate(products: list[dict]) -> list[dict]:
    """
    Remove duplicate products. Two products are duplicates if their
    titles are very similar (first 40 chars match after lowercasing).
    Keep the one with the lower price.
    """
    seen: dict[str, dict] = {}
    for p in products:
        key = f"{p['title'].lower()[:25].strip()}_{round(p['price'] / 100) * 100}"
        if key not in seen:
            seen[key] = p
        else:
            # Keep cheaper one
            if p["price"] < seen[key]["price"]:
                seen[key] = p
    return list(seen.values())


# ── Query enrichment ──────────────────────────────────────────────────────────

# Category-specific noun injected into the Serper query to prevent cross-category
# contamination. E.g. 'oneplus 15 smartphone' won't return 'NEMA 5-15R connectors'.
_CATEGORY_QUERY_NOUN: dict[str, str] = {
    "phone":      "smartphone",
    "laptop":     "laptop",
    "tv":         "television",
    "headphones": "headphones",
    "earbuds":    "earbuds",
    "tablet":     "tablet",
    "speaker":    "bluetooth speaker",
    "camera":     "camera",
    "watch":      "smartwatch",
    "keyboard":   "keyboard",
    "mouse":      "mouse",
}


def _is_apple_product_query(query: str) -> bool:
    q = query.lower()
    return any(brand in q for brand in [
        'macbook', 'iphone', 'ipad', 'airpods', 'apple watch',
        'mac mini', 'imac', 'mac pro', 'mac studio'
    ])


def _is_specific_model_query(query: str) -> bool:
    """
    Return True if the query refers to a specific product model or variant.

    Detects presence of:
      - digits (model numbers: 'Galaxy S24', 'OnePlus 12')
      - known variant suffixes ('Pro', 'Ultra', 'Active', 'Neo', 'Lite', etc.)
    A specific model query should NOT have a category noun appended — the
    model name itself pins the search more precisely.
    """
    variant_suffixes = [
        'active', 'pro', 'ultra', 'neo', 'lite', 'se', 'fe', 'classic',
        'plus', 'air', 'mini', 'max', 'studio', 'turbo', 'prime', 'sport',
    ]
    q = query.lower()
    # Digits anywhere → specific model
    if re.search(r'\d', q):
        return True
    # Known variant suffix as a whole word
    for suffix in variant_suffixes:
        if re.search(rf'\b{re.escape(suffix)}\b', q):
            return True
    return False


def _enrich_query(query: str, category: str = "default") -> str:
    """Append context for better Google Shopping results in the Indian market.

    For specific model queries (e.g. 'Redmi Watch 5 Active'), skips the
    category noun — the model name is already precise enough and adding
    'smartwatch' can dilute the signal.
    For generic queries (e.g. 'gaming laptop'), injects the category noun
    to prevent cross-category contamination.  The noun is only appended if
    NONE of its component words already appear in the query — this prevents
    duplicates like "smartwatch under 5000 smartwatch buy online India".
    """
    q = query.lower().strip()

    # Already platform-targeted — leave alone
    if any(w in q for w in ['amazon', 'flipkart', 'site:']):
        return query

    # Apple products need "Apple" prefix for Indian retailer indexing
    if _is_apple_product_query(query):
        q_lower = query.lower()
        # Extract the chip generation if present (m1/m2/m3/m4 + variant)
        chip_match = re.search(r'\b(m[1-4])\s*(pro|max|ultra)?\b', q_lower)
        chip_str = chip_match.group(0).upper() if chip_match else ""
        
        # Build Apple-specific query: "Apple MacBook Air M3" style
        if 'macbook' in q_lower:
            variant = 'MacBook Pro' if 'pro' in q_lower else 'MacBook Air'
            if chip_str:
                base = f"Apple {variant} {chip_str}"
            else:
                base = f"Apple {variant}"
        elif 'iphone' in q_lower:
            base = f"Apple {query.replace('apple', '').replace('Apple', '').strip()}"
        else:
            # Generic Apple: just prepend "Apple" if not already there
            base = f"Apple {query}" if 'apple' not in q_lower else query
        
        suffix = "price in India buy online"
        return f"{base} {suffix}"

    # For specific-model queries, skip category noun entirely —
    # the model name is more precise than any generic noun
    if _is_specific_model_query(query):
        base = query
    else:
        cat_noun = _CATEGORY_QUERY_NOUN.get(category, "")
        # Only append cat_noun if none of its words already appear in query
        noun_words = cat_noun.split()
        already_present = all(w in q for w in noun_words) if noun_words else True
        if cat_noun and not already_present:
            base = f"{query} {cat_noun}"
        else:
            base = query

    # Add India buy-intent suffix — but only once
    if any(w in q for w in ['india', 'indian', 'inr', '₹']):
        return f"{base} buy online"
    return f"{base} buy online India"


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


def _safe_search_term(title: str, max_words: int = 4) -> str:
    """
    Extract a concise, URL-safe search term from a verbose product title.
    Limits to the first max_words words (brand + model only) and strips special
    characters that break retail search URLs (parentheses, slashes, commas, etc.).
    Also strips common spec tokens (8GB, 128GB, 5G) that dilute retailer search.

    e.g. 'OnePlus Buds 3 TWS Earbuds with 49dB ANC, Hi-Res Audio, ...' → 'OnePlus Buds 3'
    """
    import re as _re
    # Stop at verbose description markers
    stop_markers = [
        'truly wireless', 'bluetooth', ' with ', 'featuring', 'includes',
        'upto', 'up to', ' (', ' [', ',', '|', ' - ', 'wireless earphone',
        'in-ear', 'over-ear', 'noise cancell', 'smart adaptive',
        'buy', 'price in india', 'specification',
    ]
    name = title.strip()
    for marker in stop_markers:
        idx = name.lower().find(marker.lower())
        if idx > 3:
            name = name[:idx].strip().rstrip(',-|')
            break
    # Keep only alphanumeric, spaces, +, and basic punctuation safe for URLs
    name = _re.sub(r'[^\w\s+]', ' ', name)
    # Strip spec tokens that break retailer search engines
    spec_pattern = _re.compile(
        r'\b(\d+gb|\d+tb|\d+mah|\d+hz|\d+w|buy|online|india|price|review|best|new|official)\b',
        _re.IGNORECASE
    )
    words = [w for w in name.split() if not spec_pattern.fullmatch(w)]
    return ' '.join(words[:max_words]).strip()


def _extract_asin(url: str) -> str | None:
    """
    Extract Amazon ASIN from a URL containing /dp/XXXXXXXXXX.
    Returns the 10-char ASIN if found, else None.
    """
    match = re.search(r'/dp/([A-Za-z0-9]{10})(?:[/?]|$)', url)
    return match.group(1) if match else None


def _build_product_link(raw_link: str, title: str, source: str) -> str:
    """
    Build a clean, direct product URL.

    Only rewrites the link when it is a Google Shopping redirect
    (ibp=oshop / google.com), a generic Cashify category page, or
    a bare '#'. Otherwise returns raw_link unchanged.

    For Amazon: prefers /dp/ASIN direct link over search page.
    For Flipkart: uses direct product path when valid.
    All other retailers: short search term (brand + model, 4 words max).
    """
    import urllib.parse

    source_lower = source.lower()

    # Detect if rewrite is needed
    is_generic_cashify = (
        "cashify" in source_lower
        and ("find-new" in raw_link or raw_link.endswith("buy-refurbished-mobile-phones"))
    )
    needs_rewrite = (
        "ibp=oshop" in raw_link
        or "google.com" in raw_link
        or is_generic_cashify
        or raw_link == "#"
    )
    if not needs_rewrite:
        return raw_link

    # Build short search term (brand + model tokens only)
    search_term = _safe_search_term(title, max_words=4)
    safe_short = urllib.parse.quote_plus(search_term)

    if "amazon" in source_lower:
        asin = _extract_asin(raw_link)
        if asin:
            return f"https://www.amazon.in/dp/{asin}"
        return f"https://www.amazon.in/s?k={safe_short}"

    if "flipkart" in source_lower:
        # Use the raw Flipkart product URL if it's a real product path
        if "flipkart.com" in raw_link and "ibp=oshop" not in raw_link and "/search" not in raw_link:
            return raw_link
        return f"https://www.flipkart.com/search?q={safe_short}"

    if "reliance" in source_lower:
        return f"https://www.reliancedigital.in/search?q={safe_short}:relevance"
    if "croma" in source_lower:
        return f"https://www.croma.com/searchB?q={safe_short}"
    if "vijay sales" in source_lower:
        return f"https://www.vijaysales.com/search/{safe_short}"
    if "jiomart" in source_lower:
        safe_source = urllib.parse.quote_plus(source)
        return f"https://duckduckgo.com/?q=%21ducky+{safe_short}+{safe_source}"
    if "tata cliq" in source_lower:
        return f"https://www.tatacliq.com/search/?searchCategory=all&text={safe_short}"
    if "cashify" in source_lower:
        full_title_enc = urllib.parse.quote_plus(title)
        return f"https://duckduckgo.com/?q=%21ducky+{full_title_enc}+site%3Acashify.in"

    # Generic fallback: DuckDuckGo I'm Feeling Lucky
    safe_source = urllib.parse.quote_plus(source)
    return f"https://duckduckgo.com/?q=%21ducky+{safe_short}+{safe_source}"


# ── Tier 1: Serper.dev ────────────────────────────────────────────────────────

def _parse_serper_response(
    data: dict,
    query: str,
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
        if not _is_price_sane(price, category, max_price, query=query):
            logger.info(
                f"Dropping '{item.get('title', '?')}' — "
                f"price ₹{price:,.0f} fails sanity check for {category}"
            )
            continue

        # Filter accessories / irrelevant results
        title = item.get("title", "Unknown Product")
        if not _is_relevant(title, category):
            continue

        # Build a clean product link (fixes ibp=oshop and generic category pages)
        raw_link = _build_product_link(
            raw_link=item.get("link", "#"),
            title=title,
            source=item.get("source", ""),
        )

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


@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=3))
def _call_serper(
    query: str,
    max_price: float | None = None,
    category: str = "default",
) -> list[dict]:
    """Call Serper.dev Google Shopping API. Retries up to 3 times."""
    import re
    query = re.sub(r"[\x00-\x1f\x7f]", "", query)[:300]
    # Pass category so the query gets the right noun injected (e.g. 'smartphone')
    search_query = _enrich_query(query, category=category)
    logger.info(f"Serper query: '{search_query}'")
    r = requests.post(
        SERPER_ENDPOINT,
        headers={"X-API-KEY": os.getenv("SERPER_API_KEY", "")},
        json={"q": search_query, "gl": "in", "num": 30},
        timeout=10,
    )
    r.raise_for_status()
    raw = r.json()
    results = _parse_serper_response(raw, query=query, max_price=max_price, category=category)

    # Soft quality gate: only drop zero-signal products when there are enough
    # rated results AND rated results constitute at least 60% of the total.
    # This prevents niche categories from losing their only valid listings.
    rated = [p for p in results if p["rating"] > 0 or p["review_count"] > 0]
    unrated = [p for p in results if p not in rated]

    if len(rated) >= 5 and len(rated) >= len(results) * 0.6:
        if unrated:
            logger.info(
                f"Quality gate: dropped {len(unrated)} zero-signal products "
                f"({len(rated)} rated remain)"
            )
        return rated

    # Soft gate: keep unrated results if we'd be left with too few
    return results


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
    import urllib.parse as _urlparse
    normalised = []
    for p in raw_products:
        price = float(p.get("price_inr") or p.get("price") or 0)
        if price <= 0:
            continue
        if not _is_price_sane(price, category, max_price, query=query):
            continue
        title = str(p.get("title", "Unknown"))
        if not _is_relevant(title, category):
            continue
        source = str(p.get("source", "Web"))
        source_lower = source.lower()
        short = _safe_search_term(title, max_words=4)
        safe_short = _urlparse.quote_plus(short)
        if "amazon" in source_lower:
            link = f"https://www.amazon.in/s?k={safe_short}"
        elif "flipkart" in source_lower:
            link = f"https://www.flipkart.com/search?q={safe_short}"
        else:
            safe_source = _urlparse.quote_plus(source)
            link = f"https://duckduckgo.com/?q=%21ducky+{safe_short}+{safe_source}"
        normalised.append({
            "title":           title,
            "price":           price,
            "rating":          _validate_rating(p.get("rating")),
            "review_count":    _validate_review_count(p.get("review_count")),
            "source":          source,
            "link":            link,
            "has_real_rating": p.get("rating") is not None,
        })
    return _deduplicate(normalised)


# ── Agent entry point ─────────────────────────────────────────────────────────

def search_agent(state: AgentState) -> dict:
    """
    Search for products matching the query.
    Falls through Serper → Groq → Mock on failure.
    Always returns {"search_results": [...]} with optional "error" key.

    Caching: Results are cached in-process for 1 hour (TTL=3600s).
    Cache HITs are logged as "Cache HIT for query: X".

    Smart Budget Negotiation (Feature 2):
        If no products are found within the extracted budget, the agent
        performs a second uncapped search, picks the closest product
        above budget, and returns a ``budget_miss`` dict so the pipeline
        can surface a helpful nudge instead of an empty state.
    """
    query    = state["query"]
    budget   = _extract_budget(query)
    category = state.get("category") or _detect_category(query)

    # ── Cache check ──────────────────────────────────────────────────────────
    mock_only = os.getenv("MOCK_ONLY", "false").lower() == "true"
    cache_key = f"{query}::{mock_only}"
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info(f"Cache HIT for query: {query}")
        return cached

    if budget:
        logger.info(f"Budget detected: ₹{budget:,.0f}")
    logger.info(f"Category detected: {category}")

    # Honour MOCK_ONLY flag (useful for tests and offline dev)
    if mock_only:
        logger.info("MOCK_ONLY=true — skipping live search")
        mock_results = get_mock_products(query)
        if budget:
            mock_results = [p for p in mock_results if p["price"] <= budget]
        error = "Mock mode — MOCK_ONLY=true"
        if len(mock_results) < 3:
            error = f"Limited results for this budget — showing {len(mock_results)} product(s)"
        result = {"search_results": mock_results, "error": error}
        _cache_set(cache_key, result)
        return result

    def _do_search(max_price: float | None) -> tuple[list[dict], bool]:
        """Run the full Serper → Groq → Mock waterfall with the given cap.

        Returns:
            (products, used_mock_fallback) — used_mock_fallback=True means
            both live tiers failed and we fell through to sample data.
        """
        if os.getenv("SERPER_API_KEY"):
            try:
                results = _call_serper(query, max_price=max_price, category=category)
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
                    results = _affix_exclusion_check(query, results)

                # ── Supplemental Amazon/Flipkart pass ─────────────────────────
                # If fewer than 2 results are from Amazon or Flipkart, the main
                # search was dominated by small marketplaces.  Run one extra call
                # with a platform-targeted query to surface the big retailers.
                if results and os.getenv("SERPER_API_KEY"):
                    top_stores = sum(
                        1 for p in results
                        if any(s in p.get("source", "").lower() for s in ("amazon", "flipkart"))
                    )
                    is_apple = _is_apple_product_query(query)
                    if top_stores < 2 and not is_apple:
                        global _supplemental_search_count
                        _supplemental_search_count += 1
                        logger.info(
                            f"Supplemental search #{_supplemental_search_count} triggered for query: '{query}'"
                        )
                        try:
                            # Use per-platform site: queries — avoids appending domain
                            # names that break _enrich_query's enrichment logic.
                            amazon_q = f"{query} site:amazon.in"
                            flipkart_q = f"{query} site:flipkart.com"

                            import concurrent.futures as _cf
                            with _cf.ThreadPoolExecutor(max_workers=2) as _pool:
                                fut_amz = _pool.submit(
                                    _call_serper, amazon_q, max_price, category
                                )
                                fut_fk = _pool.submit(
                                    _call_serper, flipkart_q, max_price, category
                                )
                                extra_amz = fut_amz.result(timeout=8)
                                extra_fk = fut_fk.result(timeout=8)

                            extra = extra_amz + extra_fk
                            extra = _affix_exclusion_check(query, extra)
                            existing_titles = {p["title"] for p in results}
                            added = 0
                            for p in extra:
                                if p["title"] not in existing_titles:
                                    results.append(p)
                                    existing_titles.add(p["title"])
                                    added += 1
                            if added:
                                logger.info(
                                    f"Supplemental search #{_supplemental_search_count} "
                                    f"added {added} Amazon/Flipkart products"
                                )
                        except Exception as e:
                            logger.warning(f"Supplemental Amazon/Flipkart search failed: {e}")

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
                if results:
                    results = _affix_exclusion_check(query, results)
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
        _cache_set(cache_key, out)
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
                f"Budget miss: closest is '\'{ closest['title']}\'' at \u20b9{closest['price']:,.0f}"
            )
            result = {
                "search_results": [],
                "budget_miss": budget_miss,
                "error": budget_miss["message"],
            }
            _cache_set(cache_key, result)
            return result

    # ── Absolute fallback: return whatever mock data we have ────────────────
    logger.info(f"Using mock data for query: '{query}'")
    mock_results = get_mock_products(query)
    if budget:
        mock_results = [p for p in mock_results if p["price"] <= budget]
    result = {
        "search_results": mock_results,
        "error": "Live search unavailable — showing sample data",
    }
    _cache_set(cache_key, result)
    return result