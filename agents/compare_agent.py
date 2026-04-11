"""
agents/compare_agent.py — product scoring via min-max normalization.

No LLM calls. Pure math. Always deterministic for the same inputs.

Scoring weights:
    price        → 0.45  (inverted: lower price = higher score)
    rating       → 0.35
    review_count → 0.20
"""

import logging
from .state import AgentState

logger = logging.getLogger(__name__)

WEIGHTS = {
    "price":        0.45,
    "rating":       0.35,
    "review_count": 0.20,
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


def compare_agent(state: AgentState) -> dict:
    """
    Score and rank all products in state["search_results"].

    Returns:
        {"scored_products": [...]}  — sorted descending by score.
        Each product gets a new "score" key (float, 0–1, 4 decimal places).
    """
    products = state.get("search_results", [])
    if not products:
        logger.warning("compare_agent called with empty search_results")
        return {"scored_products": []}

    # Extract dimension values
    prices        = [float(p.get("price", 0) or 0)        for p in products]
    ratings       = [float(p.get("rating", 3.5) or 3.5)   for p in products]
    review_counts = [float(p.get("review_count", 0) or 0)  for p in products]

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
        scored.append({
            **product,
            "score":           round(final_score, 4),
            "score_breakdown": {
                "price_score":  round(price_scores[i], 4),
                "rating_score": round(rating_scores[i], 4),
                "review_score": round(review_scores[i], 4),
            }
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    logger.info(
        f"compare_agent scored {len(scored)} products. "
        f"Winner: '{scored[0]['title']}' (score={scored[0]['score']})"
    )

    return {"scored_products": scored}
