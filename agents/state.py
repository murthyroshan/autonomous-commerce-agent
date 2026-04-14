"""
agents/state.py — shared data bus for all agents.

Every agent reads from AgentState and returns a partial dict update.
No agent should call another agent directly.
"""

from typing import TypedDict, Optional


class AgentState(TypedDict):
    query:            str
    search_results:   list[dict]   # raw products from search agent
    scored_products:  list[dict]   # products with 'score' field, sorted desc
    recommendation:   dict         # top product + 'justification' key
    error:            Optional[str]
    budget_miss:      Optional[dict]  # set when no results found within budget


def initial_state(query: str) -> AgentState:
    """Create a fresh AgentState for a new query."""
    return {
        "query":            query,
        "search_results":   [],
        "scored_products":  [],
        "recommendation":   {},
        "error":            None,
        "budget_miss":      None,
    }
