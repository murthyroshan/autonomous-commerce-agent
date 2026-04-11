"""tests/test_agents.py — unit tests for all three agents."""

import os
import pytest
from unittest.mock import patch, MagicMock

# Force mock mode so no real API calls are made in tests
os.environ["MOCK_ONLY"] = "true"

from agents.state import AgentState, initial_state
from agents.search_agent import search_agent, _parse_price, _parse_int
from agents.compare_agent import compare_agent, _normalize
from agents.decision_agent import decision_agent


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_state(**kwargs) -> AgentState:
    return {**initial_state("test query"), **kwargs}


def sample_products(n: int = 3) -> list[dict]:
    return [
        {
            "title": f"Product {i}",
            "price": float(40000 + i * 10000),
            "rating": 3.5 + i * 0.3,
            "review_count": 500 + i * 1000,
            "source": "Amazon",
            "link": f"https://example.com/{i}",
        }
        for i in range(n)
    ]


# ── Search Agent tests ────────────────────────────────────────────────────────

class TestSearchAgent:
    def test_returns_mock_data_when_mock_only(self):
        state = make_state(query="gaming laptop under 80000")
        result = search_agent(state)
        assert "search_results" in result
        assert len(result["search_results"]) > 0

    def test_returns_error_when_mock_only(self):
        state = make_state(query="laptop")
        result = search_agent(state)
        assert result.get("error") is not None

    def test_each_product_has_required_fields(self):
        state = make_state(query="laptop")
        result = search_agent(state)
        required = {"title", "price", "rating", "review_count", "source", "link"}
        for product in result["search_results"]:
            assert required.issubset(product.keys()), f"Missing fields in {product}"

    def test_all_prices_are_positive_floats(self):
        state = make_state(query="phone")
        result = search_agent(state)
        for p in result["search_results"]:
            assert isinstance(p["price"], float)
            assert p["price"] > 0

    @patch("agents.search_agent.requests.post")
    def test_falls_back_to_mock_on_serper_failure(self, mock_post):
        os.environ.pop("MOCK_ONLY", None)
        os.environ["SERPER_API_KEY"] = "fake_key"
        mock_post.side_effect = Exception("API down")

        state = make_state(query="laptop")
        with patch("agents.search_agent._call_groq_search", side_effect=Exception("Groq down")):
            result = search_agent(state)

        assert len(result["search_results"]) > 0
        assert result.get("error") is not None
        os.environ["MOCK_ONLY"] = "true"

    def test_price_parse_handles_rupee_symbol(self):
        from agents.search_agent import _parse_price
        assert _parse_price("₹54,990") == 54990.0
        assert _parse_price("54990") == 54990.0
        assert _parse_price("54990.0") == 54990.0
        assert _parse_price(None) is None
        assert _parse_price("free") is None

    def test_parse_int_handles_comma_strings(self):
        assert _parse_int("2,847") == 2847
        assert _parse_int(1500) == 1500
        assert _parse_int(None) == 0
        assert _parse_int("") == 0


# ── Compare Agent tests ───────────────────────────────────────────────────────

class TestCompareAgent:
    def test_returns_scored_products(self):
        state = make_state(search_results=sample_products(3))
        result = compare_agent(state)
        assert "scored_products" in result
        assert len(result["scored_products"]) == 3

    def test_scores_are_sorted_descending(self):
        state = make_state(search_results=sample_products(4))
        result = compare_agent(state)
        scores = [p["score"] for p in result["scored_products"]]
        assert scores == sorted(scores, reverse=True)

    def test_scores_are_between_0_and_1(self):
        state = make_state(search_results=sample_products(5))
        result = compare_agent(state)
        for p in result["scored_products"]:
            assert 0.0 <= p["score"] <= 1.0, f"Score out of range: {p['score']}"

    def test_lower_price_wins_when_all_else_equal(self):
        products = [
            {"title": "Cheap", "price": 30000.0, "rating": 4.0, "review_count": 1000,
             "source": "Amazon", "link": "#"},
            {"title": "Expensive", "price": 70000.0, "rating": 4.0, "review_count": 1000,
             "source": "Amazon", "link": "#"},
        ]
        state = make_state(search_results=products)
        result = compare_agent(state)
        assert result["scored_products"][0]["title"] == "Cheap"

    def test_handles_all_equal_prices_no_division_by_zero(self):
        products = [
            {"title": f"P{i}", "price": 50000.0, "rating": 4.0 + i * 0.1,
             "review_count": 1000, "source": "Amazon", "link": "#"}
            for i in range(3)
        ]
        state = make_state(search_results=products)
        result = compare_agent(state)
        # Should not raise, all scores valid
        assert all(0.0 <= p["score"] <= 1.0 for p in result["scored_products"])

    def test_empty_search_results_returns_empty_scored(self):
        state = make_state(search_results=[])
        result = compare_agent(state)
        assert result["scored_products"] == []

    def test_single_product_gets_max_score(self):
        # With one product, all normalized scores = 1.0 → score = 1.0
        state = make_state(search_results=[sample_products(1)[0]])
        result = compare_agent(state)
        assert result["scored_products"][0]["score"] == 1.0

    def test_score_breakdown_present(self):
        state = make_state(search_results=sample_products(2))
        result = compare_agent(state)
        for p in result["scored_products"]:
            assert "score_breakdown" in p
            breakdown = p["score_breakdown"]
            assert "price_score" in breakdown
            assert "rating_score" in breakdown
            assert "review_score" in breakdown

    def test_normalize_invert(self):
        normed = _normalize([100.0, 50.0, 75.0], invert=True)
        # 50.0 is cheapest → after invert should be highest (1.0)
        assert normed[1] == 1.0
        # 100.0 is most expensive → after invert should be lowest (0.0)
        assert normed[0] == 0.0


# ── Decision Agent tests ──────────────────────────────────────────────────────

class TestDecisionAgent:
    @patch("agents.decision_agent.groq_client")
    def test_returns_recommendation(self, mock_groq):
        mock_groq.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Great value product."))]
        )
        products = sample_products(3)
        for i, p in enumerate(products):
            p["score"] = 0.9 - i * 0.1
            p["score_breakdown"] = {"price_score": 1.0, "rating_score": 0.8, "review_score": 0.7}

        state = make_state(scored_products=products)
        result = decision_agent(state)

        assert "recommendation" in result
        assert result["recommendation"]["justification"] == "Great value product."
        assert result["recommendation"]["title"] == products[0]["title"]

    @patch("agents.decision_agent.groq_client")
    def test_falls_back_to_static_on_groq_error(self, mock_groq):
        mock_groq.chat.completions.create.side_effect = Exception("Service unavailable")
        products = sample_products(2)
        for i, p in enumerate(products):
            p["score"] = 0.8 - i * 0.2
            p["score_breakdown"] = {}

        state = make_state(scored_products=products)
        result = decision_agent(state)

        # Should still return a recommendation, just with static text
        assert result["recommendation"]["justification"] != ""
        assert result["recommendation"]["title"] == products[0]["title"]

    def test_empty_scored_products_returns_error(self):
        state = make_state(scored_products=[])
        result = decision_agent(state)
        assert result.get("recommendation") == {} or result.get("error") is not None


# ── Normalization utility tests ───────────────────────────────────────────────

class TestNormalize:
    def test_basic(self):
        result = _normalize([0.0, 50.0, 100.0])
        assert result == [0.0, 0.5, 1.0]

    def test_invert(self):
        result = _normalize([0.0, 100.0], invert=True)
        assert result == [1.0, 0.0]

    def test_all_equal(self):
        result = _normalize([5.0, 5.0, 5.0])
        assert result == [1.0, 1.0, 1.0]

    def test_empty(self):
        assert _normalize([]) == []
