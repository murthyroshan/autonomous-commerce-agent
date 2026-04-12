"""
agents/pipeline.py — orchestrates the three agents into a pipeline.

Phase 1: Plain Python function calls (simple, no dependencies)
Phase 2+: Upgrade to LangGraph for conditional branching (uncomment section below)

The public interface is always:
    run_pipeline(query: str) -> AgentState
"""

import logging
from .state import AgentState, initial_state
from .search_agent import search_agent
from .compare_agent import compare_agent
from .decision_agent import decision_agent

logger = logging.getLogger(__name__)


# ── Phase 1–2: Plain Python pipeline ────────────────────────────────────────

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

    state = initial_state(query.strip())
    logger.info(f"Pipeline started for query: '{query}' user_id='{user_id}'")

    # Agent 1: Search
    state.update(search_agent(state))
    if not state["search_results"]:
        logger.warning("Pipeline stopping: search returned no results")
        return {**state, "error": state.get("error") or "No products found"}

    # Agent 2: Compare (Phase 6: pass user_id for preference filtering/boosts)
    state.update(compare_agent(state, user_id=user_id))
    if not state["scored_products"]:
        logger.warning("Pipeline stopping: compare returned no scored products")
        return {**state, "error": "Failed to score products"}

    # Agent 3: Decision
    state.update(decision_agent(state))
    logger.info(
        f"Pipeline complete. "
        f"Recommendation: '{state['recommendation'].get('title', 'N/A')}'"
    )

    return state


# ── Phase 3+: LangGraph upgrade (uncomment when you need branching) ──────────
#
# Uncomment this section when you need:
# - Conditional routing (e.g. retry search if < 3 results)
# - Streaming individual node outputs to frontend
# - Visual graph debugging via LangSmith
#
# Installation: pip install langgraph
#
# from langgraph.graph import StateGraph, END
# from .state import AgentState
#
# def _search_node(state: AgentState) -> dict:
#     return search_agent(state)
#
# def _compare_node(state: AgentState) -> dict:
#     return compare_agent(state)
#
# def _decision_node(state: AgentState) -> dict:
#     return decision_agent(state)
#
# def _should_continue_after_search(state: AgentState) -> str:
#     """Conditional edge: if too few results, end early."""
#     if not state.get("search_results"):
#         return "end"
#     return "compare"
#
# def build_langgraph_pipeline():
#     graph = StateGraph(AgentState)
#     graph.add_node("search",   _search_node)
#     graph.add_node("compare",  _compare_node)
#     graph.add_node("decision", _decision_node)
#     graph.set_entry_point("search")
#     graph.add_conditional_edges("search", _should_continue_after_search,
#                                 {"compare": "compare", "end": END})
#     graph.add_edge("compare",  "decision")
#     graph.add_edge("decision", END)
#     return graph.compile()
#
# _graph = build_langgraph_pipeline()
#
# def run_pipeline(query: str) -> AgentState:
#     return _graph.invoke(initial_state(query.strip()))
