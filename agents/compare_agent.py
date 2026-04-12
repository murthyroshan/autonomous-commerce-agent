"""
agents/compare_agent.py — product scoring via min-max normalization.

No LLM calls. Pure math. Always deterministic for the same inputs.

Scoring weights:
    price        → 0.45  (inverted: lower price = higher score)
    rating       → 0.35
    review_count → 0.20

Data quality handling:
    Products with rating=0.0 have no verified rating and are penalised
    by substituting 2.5 (below-average) as their effective rating.
    A "rating_verified" flag is added to every scored product so the
    frontend can render "Rating unverified" on those cards.

Phase 6 additions:
    - Accepts user_id to load preferences
    - Calls apply_user_rules() to filter avoided brands / max price BEFORE scoring
    - Applies preference boosts (+0.08 preferred brand, +0.04 preferred source)
      AFTER scoring, then re-sorts
"""

import logging
from .state import AgentState
from .memory import load_prefs, apply_user_rules

logger = logging.getLogger(__name__)

WEIGHTS = {
    "price":        0.45,
    "rating":       0.35,
    "review_count": 0.20,
}

BOOST_BRAND  = 0.08
BOOST_SOURCE = 0.04


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


def compare_agent(state: AgentState, user_id: str = "demo") -> dict:
    """
    Score and rank all products in state["search_results"].

    Phase 6: accepts user_id to apply preference filtering and boosts.

    Returns:
        {"scored_products": [...]}  — sorted descending by score.
        Each product gets a new "score" key (float, 0–1, 4 decimal places)
        plus a "rating_verified" boolean for the frontend to use.
    """
    products = state.get("search_results", [])
    if not products:
        logger.warning("compare_agent called with empty search_results")
        return {"scored_products": []}

    # ── Phase 6: load prefs and apply hard rules BEFORE scoring ──────────────
    try:
        prefs = load_prefs(user_id)
    except Exception as e:
        logger.warning(f"compare_agent: could not load prefs for '{user_id}' — {e}")
        prefs = {}

    products = apply_user_rules(products, prefs)
    if not products:
        logger.warning("compare_agent: all products removed by user rules")
        return {"scored_products": []}

    preferred_brands: list[str]  = [b.lower() for b in prefs.get("preferred_brands", []) if b]
    preferred_sources: list[str] = [s.lower() for s in prefs.get("preferred_sources", []) if s]

    # ── Resolve effective rating per product ─────────────────────────────────
    # Products with rating=0.0 have no verified rating.
    # Penalise them by using 2.5 (below-average) for scoring.
    for p in products:
        raw_rating = float(p.get("rating", 0) or 0)
        if raw_rating == 0.0:
            p["_effective_rating"] = 2.5
            p["_rating_verified"] = False
        else:
            p["_effective_rating"] = raw_rating
            p["_rating_verified"] = True

    # Extract dimension values (use effective rating, not raw)
    prices        = [float(p.get("price", 0) or 0)                  for p in products]
    ratings       = [float(p.get("_effective_rating", 2.5) or 2.5)  for p in products]
    review_counts = [float(p.get("review_count", 0) or 0)           for p in products]

    # Normalize each dimension
    price_scores  = _normalize(prices, invert=True)
    rating_scores = _normalize(ratings)
    review_scores = _normalize(review_counts)

    # Build scored product list
    scored = []
    for i, product in enumerate(products):
        final_score = (
            WEIGHTS["price"]        * price_scores[i] +
            WEIGHTS["rating"]       * rating_scores[i] +
            WEIGHTS["review_count"] * review_scores[i]
        )
        # Expose rating_verified to the frontend; strip internal temp keys
        rating_verified = product.pop("_rating_verified", True)
        product.pop("_effective_rating", None)

        scored.append({
            **product,
            "score":           round(final_score, 4),
            "rating_verified": rating_verified,
            "score_breakdown": {
                "price_score":  round(price_scores[i], 4),
                "rating_score": round(rating_scores[i], 4),
                "review_score": round(review_scores[i], 4),
            }
        })

    # ── Phase 6: apply preference boosts AFTER base scoring ──────────────────
    for product in scored:
        boosted = False
        title_lower  = product.get("title", "").lower()
        source_lower = product.get("source", "").lower()

        if preferred_brands and any(b in title_lower for b in preferred_brands):
            product["score"] = min(1.0, round(product["score"] + BOOST_BRAND, 4))
            boosted = True

        if preferred_sources and any(s in source_lower for s in preferred_sources):
            product["score"] = min(1.0, round(product["score"] + BOOST_SOURCE, 4))
            boosted = True

        if boosted:
            product["preference_boosted"] = True

    # Re-sort after boosts
    scored.sort(key=lambda x: x["score"], reverse=True)

    logger.info(
        f"compare_agent scored {len(scored)} products. "
        f"Winner: '{scored[0]['title']}' (score={scored[0]['score']})"
    )

    return {"scored_products": scored}
