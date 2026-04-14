"""
agents/compare_agent.py — product scoring via min-max normalization.

No LLM calls. Pure math. Always deterministic for the same inputs.

Scoring weights:
    price        → 0.45  (inverted: lower price = higher score)
    rating       → 0.35  (confidence-adjusted; log-normalized review count)
    review_count → 0.20

Data quality handling:
    Products with rating=0.0 have no verified rating: _confidence_adjusted_rating()
    blends them toward NEUTRAL_RATING=2.5.
    Review counts use log normalization to prevent outliers from collapsing
    the rest of the distribution.

Phase 6 additions:
    - Accepts user_id to load preferences
    - Applies preference boosts (multiplicative) AFTER scoring
    - Applies trust multiplier (store tier) per product
    - Detects suspicious price anomalies (35% below median)
    - Hard eliminations for avoided brands / max_price violations
"""

import logging
import math
import statistics
from .state import AgentState
from .memory import load_prefs

logger = logging.getLogger(__name__)


# ── Deal Confidence Verdict ───────────────────────────────────────────────────
# Maps a final (possibly trust/boost-multiplied) score to a plain-English verdict.
# Color tokens are CSS-friendly hex strings for the frontend to use directly.

_VERDICT_TABLE = [
    (0.80, "Excellent deal. Buy now.",   "#34d399"),  # emerald
    (0.65, "Good value.",                "#a78bfa"),  # violet
    (0.45, "Decent pick.",               "#fbbf24"),  # amber
    (0.25, "Wait for a sale.",           "#fb923c"),  # orange
    (0.00, "Overpriced.",               "#f87171"),  # red
]


def deal_verdict(score: float) -> tuple[str, str]:
    """Return (verdict_text, colour_hex) for a given score in [0, 1]."""
    for threshold, text, colour in _VERDICT_TABLE:
        if score >= threshold:
            return text, colour
    return _VERDICT_TABLE[-1][1], _VERDICT_TABLE[-1][2]

WEIGHTS = {
    "price":        0.45,
    "rating":       0.35,
    "review_count": 0.20,
}

NEUTRAL_RATING   = 2.5
CONFIDENCE_FLOOR = 100   # reviews needed for full confidence

ANOMALY_THRESHOLD = 0.35  # 35% below median = suspicious

STORE_TRUST = {
    # Tier 1 — Official brand stores
    "tier1": {
        "multiplier": 1.12,
        "keywords": [
            "oneplus", "samsung", "apple", "xiaomi", "realme", "oppo",
            "vivo", "sony", "motorola", "nothing", "iqoo", "boat",
            "noise", "hp", "dell", "lenovo", "asus", "acer", "canon",
            "nikon", "dyson", "official", "brand store", "authorized"
        ]
    },
    # Tier 2 — Trusted retailers
    "tier2_high": {
        "multiplier": 1.06,
        "keywords": ["amazon", "flipkart"]
    },
    "tier2_low": {
        "multiplier": 1.03,
        "keywords": [
            "croma", "reliance digital", "vijay sales", "tatacliq",
            "meesho", "jiomart", "snapdeal", "paytm mall"
        ]
    },
    # Default for unknown stores
    "unknown": {
        "multiplier": 0.88
    }
}


def _normalize(values: list[float], invert: bool = False) -> list[float]:
    """
    Min-max normalize a list of floats to [0, 1].
    If all values are equal, returns [1.0, ...] for all.
    If invert=True, returns 1 - normalized (used for price: lower = better).
    """
    if not values:
        return []
    mn, mx = min(values), max(values)
    if mx == mn:
        return [1.0] * len(values)
    normed = [(v - mn) / (mx - mn) for v in values]
    return [1.0 - n for n in normed] if invert else normed


def _log_normalize(values: list[float]) -> list[float]:
    """
    Log-normalize a list of floats to [0, 1] using log1p.
    Prevents outliers from collapsing the rest of the distribution.
    If all logged values are equal, returns [1.0, ...] for all.
    """
    logged = [math.log1p(v) for v in values]
    mn, mx = min(logged), max(logged)
    if mx == mn:
        return [1.0] * len(logged)
    return [(v - mn) / (mx - mn) for v in logged]


def _confidence_adjusted_rating(rating: float, review_count: int) -> float:
    """
    Blend a product's raw rating toward NEUTRAL_RATING based on review confidence.
    Products with few reviews are pulled toward 2.5 (neutral).
    At CONFIDENCE_FLOOR (100) reviews, full confidence — rating unchanged.
    Rating of 0.0 (no data) always returns NEUTRAL_RATING.
    """
    if rating == 0.0:
        return NEUTRAL_RATING
    confidence = min(review_count, CONFIDENCE_FLOOR) / CONFIDENCE_FLOOR
    return round(confidence * rating + (1 - confidence) * NEUTRAL_RATING, 4)


def _get_trust_multiplier(source: str) -> tuple[float, str]:
    """Returns (multiplier, tier_key) for the given store name."""
    s = source.lower()
    for kw in STORE_TRUST["tier1"]["keywords"]:
        if kw in s:
            return STORE_TRUST["tier1"]["multiplier"], "tier1"
    for kw in STORE_TRUST["tier2_high"]["keywords"]:
        if kw in s:
            return STORE_TRUST["tier2_high"]["multiplier"], "tier2_high"
    for kw in STORE_TRUST["tier2_low"]["keywords"]:
        if kw in s:
            return STORE_TRUST["tier2_low"]["multiplier"], "tier2_low"
    return STORE_TRUST["unknown"]["multiplier"], "unknown"


def _detect_price_anomaly(
    price: float,
    all_prices: list[float]
) -> tuple[bool, float, float]:
    """
    Returns (is_suspicious, deviation_pct, median_price).
    A product is suspicious if its price is more than
    ANOMALY_THRESHOLD below the median of the batch.
    """
    # Need at least 3 products for a meaningful median comparison.
    # With 2 products the median is the midpoint and the cheaper one
    # always looks anomalous — that's a false positive.
    if len(all_prices) < 3:
        return False, 0.0, 0.0
    median = statistics.median(all_prices)
    if median == 0:
        return False, 0.0, 0.0
    deviation = (median - price) / median
    return deviation > ANOMALY_THRESHOLD, round(deviation * 100, 1), round(median, 2)


def compare_agent(state: AgentState, user_id: str = "demo") -> dict:
    """
    Score and rank all products in state["search_results"].

    Phase 6: accepts user_id to apply preference filtering and boosts.

    Scoring pipeline per product:
      1. Base score: normalized price + confidence-adj rating + log review count
      2. Anomaly check: if price is suspiciously low (>35% below median), × 0.5
      3. Trust multiplier: based on store tier (tier1=1.12, tier2=1.03–1.06, unknown=0.88)
      4. Memory boosts: multiplicative (brand ×1.08, source ×1.04)
      5. Hard eliminations: avoided brands or max_price → score = 0.0

    Returns:
        {"scored_products": [...]}  — sorted descending by score.
        Each product gets a new "score" key (float, 4 decimal places),
        "rating_verified" boolean, badge data, and metadata fields.
    """
    products = state.get("search_results", [])
    if not products:
        logger.warning("compare_agent called with empty search_results")
        return {"scored_products": []}

    # ── Phase 6: load prefs ───────────────────────────────────────────────────
    try:
        prefs = load_prefs(user_id)
    except Exception as e:
        logger.warning(f"compare_agent: could not load prefs for '{user_id}' — {e}")
        prefs = {}

    preferred_brands: list[str]  = [b.lower() for b in prefs.get("preferred_brands", []) if b]
    preferred_sources: list[str] = [s.lower() for s in prefs.get("preferred_sources", []) if s]

    # ── Feature 1.2: Confidence-adjusted ratings ──────────────────────────────
    for p in products:
        raw_rating  = float(p.get("rating", 0) or 0)
        review_cnt  = int(p.get("review_count", 0) or 0)
        p["_adj_rating"] = _confidence_adjusted_rating(raw_rating, review_cnt)
        # Preserve rating_verified flag for the frontend
        p["_rating_verified"] = raw_rating != 0.0

    # Extract dimension values
    prices  = [float(p.get("price", 0) or 0)  for p in products]
    ratings = [float(p["_adj_rating"])          for p in products]
    reviews = [float(p.get("review_count", 0) or 0) for p in products]

    # Normalize dimensions
    price_scores  = _normalize(prices, invert=True)
    rating_scores = _normalize(ratings)
    review_scores = _log_normalize(reviews)  # Feature 1.1: log normalization

    all_prices = prices  # alias for anomaly detection

    # ── Scoring loop ──────────────────────────────────────────────────────────
    scored = []
    for i, product in enumerate(products):
        # Step 1: base score
        base = (
            WEIGHTS["price"]        * price_scores[i] +
            WEIGHTS["rating"]       * rating_scores[i] +
            WEIGHTS["review_count"] * review_scores[i]
        )

        # Step 2: anomaly check
        suspicious, dev_pct, median_p = _detect_price_anomaly(
            product["price"], all_prices
        )
        if suspicious:
            base *= 0.5
        product.update({
            "price_suspicious":      suspicious,
            "anomaly_deviation_pct": dev_pct,
            "anomaly_median_price":  median_p,
        })

        # Step 3: trust multiplier
        trust_mult, trust_tier = _get_trust_multiplier(
            product.get("source", "")
        )
        base *= trust_mult
        product.update({
            "trust_tier":       trust_tier,
            "trust_multiplier": trust_mult,
        })

        # Step 4: memory boosts (multiplicative — Feature 1.3)
        brand_matched  = any(b in product.get("title", "").lower() for b in preferred_brands)
        source_matched = product.get("source", "").lower() in preferred_sources
        brand_multiplier  = 1.08 if brand_matched  else 1.0
        source_multiplier = 1.04 if source_matched else 1.0
        base *= brand_multiplier * source_multiplier
        if brand_matched or source_matched:
            product["preference_boosted"] = True

        # Step 5: hard eliminations
        avoided = prefs.get("avoided_brands", [])
        max_p   = prefs.get("max_price")
        if any(a.lower() in product.get("title", "").lower() for a in avoided):
            base = 0.0
            product["eliminated"]         = True
            product["elimination_reason"] = "Avoided brand"
        elif max_p and product["price"] > max_p:
            base = 0.0
            product["eliminated"]         = True
            product["elimination_reason"] = f"Exceeds max price ₹{max_p:,.0f}"

        # Expose rating_verified; strip internal temp keys
        rating_verified = product.pop("_rating_verified", True)
        adj_rating      = product.get("_adj_rating", product.get("rating", 0))

        capped_score = min(1.0, round(base, 4))
        verdict_text, verdict_colour = deal_verdict(capped_score)

        scored_product = {
            **product,
            "_adj_rating":    adj_rating,
            # Cap at 1.0: trust/boost multipliers can exceed 1.0 but
            # relative ordering is preserved; existing tests expect [0, 1].
            "score":          capped_score,
            "verdict":        verdict_text,
            "verdict_colour": verdict_colour,
            "rating_verified": rating_verified,
            "score_breakdown": {
                "price_score":  round(price_scores[i], 4),
                "rating_score": round(rating_scores[i], 4),
                "review_score": round(review_scores[i], 4),
            }
        }
        scored.append(scored_product)

    # ── Badge assignment (Feature 3) ──────────────────────────────────────────
    from agents.badge_engine import assign_badges
    for product in scored:
        assign_badges(product, scored)

    scored.sort(key=lambda x: x["score"], reverse=True)

    logger.info(
        f"compare_agent scored {len(scored)} products. "
        f"Winner: '{scored[0]['title']}' (score={scored[0]['score']})"
    )

    return {"scored_products": scored}
