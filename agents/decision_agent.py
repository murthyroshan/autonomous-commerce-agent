"""
agents/decision_agent.py — pick the top product and generate AI justification.

Uses Groq API (free tier) with llama-3.3-70b-versatile.
Falls back to llama3-8b-8192 if rate-limited.
Falls back to a static template if both models fail.
"""

import logging
from groq import Groq, RateLimitError, APIError

from .state import AgentState

logger = logging.getLogger(__name__)

groq_client = None  # lazily created; patched by tests via agents.decision_agent.groq_client


def _get_groq_client():
    """Return cached Groq client, honouring any test-injected mock."""
    global groq_client
    if groq_client is None:
        from groq import Groq
        groq_client = Groq()  # reads GROQ_API_KEY from env
    return groq_client

PRIMARY_MODEL  = "llama-3.3-70b-versatile"
FALLBACK_MODEL = "llama3-8b-8192"


def _build_prompt(product: dict, all_products: list[dict]) -> str:
    """Build the decision prompt with context about competing products."""
    competitors = [p for p in all_products if p["title"] != product["title"]][:3]
    competitor_text = "\n".join(
        f"- {p['title']}: ₹{p['price']:,.0f}, {p['rating']}★"
        for p in competitors
    )
    return (
        f"You are helping a user choose the best product.\n\n"
        f"RECOMMENDED PRODUCT:\n"
        f"- Name: {product['title']}\n"
        f"- Price: ₹{product['price']:,.0f}\n"
        f"- Rating: {product['rating']}★ ({product['review_count']:,} reviews)\n"
        f"- Score: {product['score']} / 1.00\n\n"
        f"OTHER OPTIONS CONSIDERED:\n{competitor_text}\n\n"
        f"In exactly 2 sentences, explain why this product is the best choice. "
        f"Be specific about the price-to-performance tradeoff. "
        f"Do not start with 'I' or mention the scoring system."
    )


def _static_justification(product: dict) -> str:
    """Fallback justification when Groq is unavailable."""
    return (
        f"The {product['title']} offers the best overall value at ₹{product['price']:,.0f}, "
        f"combining a strong {product['rating']}★ rating from {product['review_count']:,} "
        f"verified buyers with competitive pricing. "
        f"Its combination of price efficiency and user satisfaction makes it the top pick."
    )


def _call_groq(prompt: str, model: str) -> str:
    """Call Groq API with the given model. Raises on failure."""
    response = _get_groq_client().chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()


def decision_agent(state: AgentState) -> dict:
    """
    Select the top-scored product and generate a justification.

    Returns:
        {"recommendation": {**top_product, "justification": str}}
    """
    scored = state.get("scored_products", [])
    if not scored:
        logger.warning("decision_agent called with empty scored_products")
        return {"recommendation": {}, "error": "No products to recommend"}

    top = scored[0]
    prompt = _build_prompt(top, scored)

    # Try primary model
    try:
        justification = _call_groq(prompt, PRIMARY_MODEL)
        logger.info(f"Decision agent used {PRIMARY_MODEL}")
    except RateLimitError:
        logger.warning(f"{PRIMARY_MODEL} rate-limited — trying {FALLBACK_MODEL}")
        try:
            justification = _call_groq(prompt, FALLBACK_MODEL)
        except (RateLimitError, APIError) as e:
            logger.warning(f"Both Groq models failed: {e} — using static justification")
            justification = _static_justification(top)
    except (APIError, Exception) as e:
        logger.warning(f"Groq API error: {e} — using static justification")
        justification = _static_justification(top)

    return {
        "recommendation": {
            **top,
            "justification": justification,
            "rank":          1,
            "total_compared": len(scored),
        }
    }
