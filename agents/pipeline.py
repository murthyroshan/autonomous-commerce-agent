"""
agents/pipeline.py — orchestrates the three agents into a pipeline.

Supports two modes:
  1. Standard: run_pipeline("gaming laptop under 80k")
     → Search → Compare → Decide → extract top 2 as battle_contenders
  2. VS Mode: run_pipeline("OnePlus 13 vs Samsung S24")
     → Detect "vs" → Run TWO parallel searches → merge → Compare → Decide
     → contender A = best OnePlus, contender B = best Samsung

The public interface is always:
    run_pipeline(query: str, user_id: str) -> AgentState
"""

import logging
import re
import json
import concurrent.futures

from .state import AgentState, initial_state
from .search_agent import search_agent, _get_groq_client
from .compare_agent import compare_agent
from .decision_agent import decision_agent

logger = logging.getLogger(__name__)

# Regex to detect VS queries like "OnePlus 13 vs Samsung S24" or "A versus B"
_VS_PATTERN = re.compile(r"\s+(?:vs\.?|versus)\s+", re.IGNORECASE)


def _detect_vs_query(query: str) -> tuple[bool, str, str]:
    """
    Returns (is_vs, side_a, side_b).
    If not a VS query, returns (False, query, "").
    """
    parts = _VS_PATTERN.split(query, maxsplit=1)
    if len(parts) == 2 and parts[0].strip() and parts[1].strip():
        return True, parts[0].strip(), parts[1].strip()
    return False, query, ""

def _parse_user_intent(query: str) -> dict:
    """
    Parses the raw query to extract standardized search entities.
    Returns: {"mode": "vs"|"standard", "items": ["Item 1", "Item 2"]}
    """
    prompt = (
        "You are an e-commerce search intent parser. "
        "Convert the user's raw query into precise, standardized product search terms including the correct brand.\n"
        "- If it's a comparison query (e.g., 'Oneplus 13 vs 13R' or 'A versus B'), set 'mode' to 'vs' and specify both items fully (e.g. infer brand for the second item if missing).\n"
        "- If it's a generic base model like 'S24', output the full name 'Samsung Galaxy S24'. Do NOT append suffixes like 'Ultra' or 'FE' unless requested in the query.\n"
        "- If they ask for 'Mac M3', assume laptop and output 'Apple MacBook Air M3' or similar. Do NOT output 'iMac M3'.\n"
        "Return ONLY a valid JSON object matching this exact structure: {\"mode\": \"vs\" | \"standard\", \"items\": [\"Item 1 to search\", \"Item 2 to search\"]}\n"
    )
    try:
        response = _get_groq_client().chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": query}
            ],
            temperature=0.0
        )
        text = response.choices[0].message.content
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
            if "mode" in parsed and "items" in parsed and len(parsed["items"]) > 0:
                if parsed["mode"] == "vs" and len(parsed["items"]) == 1:
                    parsed["mode"] = "standard"
                return parsed
    except Exception as e:
        logger.warning(f"Feature Intent parsing failed: {e}")
    
    # Fallback to standard regex routine
    is_vs, side_a, side_b = _detect_vs_query(query)
    if is_vs:
        return {"mode": "vs", "items": [side_a, side_b]}
    return {"mode": "standard", "items": [query]}


def _run_single_search(sub_query: str) -> list[dict]:
    """Search + compare pipeline for a single sub-query. Returns scored products."""
    sub_state = initial_state(sub_query)
    sub_state.update(search_agent(sub_state))
    if not sub_state["search_results"]:
        return []
    sub_state.update(compare_agent(sub_state))
    return sub_state.get("scored_products", [])


def _pin_best_match(sub_query: str, products: list[dict]) -> dict | None:
    """
    Find the product whose title best matches the sub-query by Jaccard word overlap.
    Falls back to the top-scored product if nothing overlaps well enough.

    This ensures that when searching for "oneplus 12" vs "oneplus 12r",
    each side pins to the correct model rather than both picking the same top scorer.
    """
    if not products:
        return None

    query_tokens = set(sub_query.lower().replace("-", " ").split())

    best_product = None
    best_score = -1.0

    for product in products:
        title_tokens = set(product["title"].lower().replace("-", " ").split())
        # Jaccard similarity
        if not title_tokens:
            continue
        intersection = query_tokens & title_tokens
        union = query_tokens | title_tokens
        jaccard = len(intersection) / len(union) if union else 0.0
        # Boost by the AI score (0-1) to break ties
        combined = jaccard * 0.7 + product.get("score", 0) * 0.3
        
        # Massive boost if the exact string appears (e.g. 'oneplus 12' in 'OnePlus 12 5G...')
        # Use regex word boundaries so "oneplus 12" doesn't falsely match inside "oneplus 12R"
        import re
        if re.search(rf'\b{re.escape(sub_query.lower())}\b', product["title"].lower()):
            combined += 1.0
            
        if combined > best_score:
            best_score = combined
    return best_product or products[0]


def _is_relevant(title: str, side_a: str, side_b: str) -> bool:
    """
    Check if the title strictly contains all tokens of either side A or side B.
    Drops completely unrelated products (e.g. 'OnePlus 15' when querying '12 vs 12R').
    """
    t_lower = title.lower().replace("-", " ")

    def match_side(side: str):
        # Ignore 1-char tokens like "a", focus on main model numbers/brands
        tokens = [t for t in side.lower().replace("-", " ").split() if len(t) > 1]
        if not tokens:
            return False
        return all(tok in t_lower for tok in tokens)

    return match_side(side_a) or match_side(side_b)


def run_pipeline(query: str, user_id: str = "demo") -> AgentState:
    """
    Run the full agent pipeline: Search → Compare → Decide.

    Args:
        query:   Natural-language shopping query.
        user_id: Used to load user preferences and preference boosts in compare_agent.

    Returns the final AgentState dict regardless of errors.
    Never raises — all exceptions are caught within individual agents.
    """
    if not query or not query.strip():
        return {**initial_state(""), "error": "Query cannot be empty"}

    query = query.strip()
    state = initial_state(query)
    logger.info(f"Pipeline started for query: '{query}' user_id='{user_id}'")

    intent = _parse_user_intent(query)
    is_vs = intent["mode"] == "vs"
    items = intent["items"]

    if is_vs and len(items) >= 2:
        side_a = items[0]
        side_b = items[1]
        # ── VS Mode: parallel dual-search ────────────────────────────────────
        logger.info(f"VS mode detected: '{side_a}' vs '{side_b}'")
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            fut_a = executor.submit(_run_single_search, side_a)
            fut_b = executor.submit(_run_single_search, side_b)
            results_a = fut_a.result()
            results_b = fut_b.result()

        if not results_a and not results_b:
            return {**state, "error": f"No products found for '{side_a}' or '{side_b}'"}

        # Pin the BEST TITLE-MATCHING product to each side (not just top scorer)
        # This prevents "oneplus 12" from pinning to an "oneplus 12r" result
        contender_a = _pin_best_match(side_a, results_a) if results_a else None
        contender_b = _pin_best_match(side_b, results_b) if results_b else None

        # Guard: if both sides pinned to the same product, fallback to scores
        logger.info(f"DEBUG PINNING:\n Side A pinned: {(contender_a or {}).get('title')}\n Side B pinned: {(contender_b or {}).get('title')}")
        if (
            contender_a and contender_b
            and contender_a["title"] == contender_b["title"]
        ):
            logger.warning(
                f"VS: both sides pinned to same product ('{contender_a['title']}'). "
                "Falling back to top-2 from merged results."
            )
            # Use highest scorer from each pool
            contender_a = results_a[0] if results_a else None
            # Exclude contender_a from side_b picks
            b_pool = [p for p in results_b if p["title"] != (contender_a or {}).get("title")]
            contender_b = b_pool[0] if b_pool else (results_b[0] if results_b else None)

        if contender_a and not contender_b:
            # Only one side found — fall back to standard mode
            logger.warning(f"VS: only side A found products. Falling back to standard.")
            state["search_results"] = [p for p in results_a]
        elif contender_b and not contender_a:
            logger.warning(f"VS: only side B found products. Falling back to standard.")
            state["search_results"] = [p for p in results_b]
        else:
            # Both sides found — merge, deduplicate, sort
            all_products = results_a + results_b
            all_products.sort(key=lambda x: x.get("score", 0), reverse=True)
            # Deduplicate by title (keep highest-scored occurrence) and strict filter
            seen: set[str] = set()
            deduped: list[dict] = []
            for p in all_products:
                if p["title"] not in seen and _is_relevant(p["title"], side_a, side_b):
                    seen.add(p["title"])
                    deduped.append(p)
            state["search_results"] = deduped
            state["scored_products"] = deduped
            state["battle_contenders"] = [contender_a, contender_b]
            # Run decision agent to get justification + battle_report
            state.update(decision_agent(state))
            logger.info(
                f"VS pipeline complete. Contenders: "
                f"'{contender_a.get('title', '?')}' vs '{contender_b.get('title', '?')}'"
            )
            return state

    # ── Standard Mode ─────────────────────────────────────────────────────────
    if not is_vs:
        state["query"] = items[0]  # Overwrite with normalized query
        logger.info(f"Using normalized standard query: '{state['query']}'")

    # Agent 1: Search
    state.update(search_agent(state))
    if not state["search_results"]:
        if state.get("budget_miss"):
            logger.info(f"Pipeline returning budget_miss nudge: {state['budget_miss']['message']}")
            return state
        logger.warning("Pipeline stopping: search returned no results")
        return {**state, "error": state.get("error") or "No products found"}

    # Agent 2: Compare (Phase 6: pass user_id for preference filtering/boosts)
    state.update(compare_agent(state, user_id=user_id))
    if not state["scored_products"]:
        logger.warning("Pipeline stopping: compare returned no scored products")
        return {**state, "error": "Failed to score products"}

    # Extract battle contenders from top 2 results
    scored = state["scored_products"]
    if len(scored) >= 2:
        state["battle_contenders"] = [scored[0], scored[1]]
        logger.info(
            f"Battle contenders set: "
            f"'{scored[0].get('title', '?')}' vs '{scored[1].get('title', '?')}'"
        )

    # Agent 3: Decision (will also generate battle_report if contenders are set)
    state.update(decision_agent(state))
    logger.info(
        f"Pipeline complete. "
        f"Recommendation: '{state['recommendation'].get('title', 'N/A')}'"
    )

    return state