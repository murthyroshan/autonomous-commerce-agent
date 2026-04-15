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
    """Build the decision prompt with badge-aware caveats for store tier and rating confidence."""
    badge      = product.get("primary_badge", {})
    tier       = badge.get("tier", "tier3")
    sec_labels = [b["label"] for b in product.get("secondary_badges", [])]

    # Build badge context string
    badge_context = ""
    if tier == "tier1":
        badge_context = (
            "This product is sold by an official brand store — "
            "mention the official warranty in your recommendation."
        )
    elif tier == "tier3":
        badge_context = (
            "This product is from an unverified seller — "
            "include a soft caveat to check seller ratings."
        )
    elif tier == "tier4":
        dev = badge.get("description", "")
        badge_context = (
            f"WARNING — this product has a suspicious price. {dev} "
            f"Explicitly warn the user about this in your recommendation."
        )

    rating_caveat = ""
    if "Low Confidence" in sec_labels:
        rating_caveat = (
            "Note: this product has very few reviews — "
            "mention rating reliability is uncertain."
        )
    elif "Penalized Rating" in sec_labels:
        rating_caveat = (
            "Note: this product had no rating data — "
            "mention that rating could not be verified."
        )

    competitors = [p for p in all_products if p["title"] != product["title"]][:3]

    if not competitors:
        return (
            f"You are helping a user choose a product.\n\n"
            f"PRODUCT:\n"
            f"- Name: {product['title']}\n"
            f"- Price: ₹{product['price']:,.0f}\n"
            f"- Adjusted rating: {product.get('_adj_rating', 0):.1f}★ "
            f"({product.get('review_count', 0):,} reviews)\n"
            f"- Store: {product.get('source', 'Unknown')}\n\n"
            f"{badge_context}\n{rating_caveat}\n\n"
            f"In exactly 2 sentences, explain whether this is good value. "
            f"Be honest — if it looks weak, say so."
        )

    competitor_text = "\n".join(
        f"- {p['title']}: ₹{p['price']:,.0f}, "
        f"{p.get('_adj_rating', 0):.1f}★ adj, "
        f"score={p.get('score', 0)}"
        for p in competitors
    )

    return (
        f"You are helping a user choose the best product.\n\n"
        f"RECOMMENDED:\n"
        f"- Name: {product['title']}\n"
        f"- Price: ₹{product['price']:,.0f}\n"
        f"- Adjusted rating: {product.get('_adj_rating', 0):.1f}★ "
        f"({product.get('review_count', 0):,} reviews)\n"
        f"- Store: {product.get('source', 'Unknown')}\n"
        f"- Score: {product.get('score', 0)}\n\n"
        f"OTHER OPTIONS:\n{competitor_text}\n\n"
        f"{badge_context}\n{rating_caveat}\n\n"
        f"In exactly 2 sentences, explain why this is the best choice. "
        f"Be specific about price-to-performance. "
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


def _call_groq(prompt: str, model: str, max_tokens: int = 150) -> str:
    """Call Groq API with the given model. Raises on failure."""
    response = _get_groq_client().chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()


def _build_battle_prompt(a: dict, b: dict) -> str:
    """Build the head-to-head referee prompt for Battle Mode."""
    def fmt(p: dict) -> str:
        drop = p.get("price_drop_pct")
        hist = p.get("historical_30d_avg")
        price_note = ""
        if drop and hist:
            price_note = f" (↓{drop}% from 30-day avg ₹{hist:,.0f})"
        return (
            f"- Name: {p['title']}\n"
            f"- Price: ₹{p['price']:,.0f}{price_note}\n"
            f"- Rating: {p.get('_adj_rating', p.get('rating', 0)):.1f}★ "
            f"({p.get('review_count', 0):,} reviews)\n"
            f"- Store: {p.get('source', 'Unknown')}\n"
            f"- AI Score: {p.get('score', 0):.4f}"
        )

    return (
        f"You are an expert shopping referee doing a head-to-head product battle.\n\n"
        f"CONTENDER A:\n{fmt(a)}\n\n"
        f"CONTENDER B:\n{fmt(b)}\n\n"
        f"Write a punchy 2-3 sentence 'Tale of the Tape'. "
        f"Compare them directly on price, value, and where each one wins. "
        f"End with one declarative sentence declaring the winner by name. "
        f"Be specific, bold, and direct. Do not use bullet points."
    )


def _get_community_sentiment(product_title: str) -> str | None:
    """Search trusted community sites via Serper and summarize with Groq."""
    import os, requests, json
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return None
    
    # Scoped search to trusted community hubs
    query = f"{product_title} review site:reddit.com OR site:youtube.com OR site:techradar.com OR site:twitter.com OR site:instagram.com"
    try:
        r = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": query, "num": 10},
            timeout=8
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.warning(f"Serper sentiment search failed: {e}")
        return None

    snippets = []
    for item in data.get("organic", [])[:8]:
        snip = item.get("snippet")
        if snip:
            snippets.append(snip)
    
    if not snippets:
        return None

    context = "\n".join(f"- {s}" for s in snippets)
    prompt = (
        f"You are a shopping assistant analyzing community feedback for '{product_title}'.\n\n"
        f"Recent community posts/reviews:\n{context}\n\n"
        f"Synthesize this into exactly one punchy, impactful sentence summarizing the community consensus. "
        f"Start with something like 'Highly rated by the community — ' or 'Mixed impressions online — '. "
        f"Do not mention the source snippets directly, just the sentiment."
    )

    try:
        sentiment = _call_groq(prompt, PRIMARY_MODEL, max_tokens=60)
        return sentiment
    except Exception as e:
        logger.warning(f"Groq sentiment summary failed: {e}")
        return None


def decision_agent(state: AgentState) -> dict:
    """
    Select the top-scored product and generate a justification.
    If battle_contenders are set, also generates a head-to-head battle_report.

    Returns:
        {"recommendation": {**top_product, "justification": str},
         "battle_report": str | None}
    """
    scored = state.get("scored_products", [])
    if not scored:
        logger.warning("decision_agent called with empty scored_products")
        return {"recommendation": {}, "error": "No products to recommend"}

    top = scored[0]
    prompt = _build_prompt(top, scored)

    # Social Proof: Community Sentiment
    community_sentiment = _get_community_sentiment(top["title"])
    
    # Try primary model for standard justification
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

    # Battle report — only if contenders are available
    battle_report: str | None = None
    contenders = state.get("battle_contenders")
    if contenders and len(contenders) == 2:
        battle_prompt = _build_battle_prompt(contenders[0], contenders[1])
        try:
            battle_report = _call_groq(battle_prompt, PRIMARY_MODEL, max_tokens=220)
            logger.info("Battle report generated successfully")
        except Exception as e:
            logger.warning(f"Battle report generation failed: {e}")
            # Build a static fallback battle report
            a, b = contenders[0], contenders[1]
            winner = a if a.get("score", 0) >= b.get("score", 0) else b
            loser = b if winner is a else a
            battle_report = (
                f"Both products are strong contenders in their own right. "
                f"The {a['title']} leads on price at ₹{a['price']:,.0f} while "
                f"the {b['title']} counters with a higher score. "
                f"The winner is {winner['title']}."
            )

    return {
        "recommendation": {
            **top,
            "justification": justification,
            "community_sentiment": community_sentiment,
            "rank":          1,
            "total_compared": len(scored),
        },
        "battle_report": battle_report,
    }
