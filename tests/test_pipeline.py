"""tests/test_pipeline.py — integration tests for the full pipeline."""

import os
import pytest

os.environ["MOCK_ONLY"] = "true"

from agents.pipeline import run_pipeline
from agents.state import AgentState


class TestPipeline:
    def test_returns_recommendation_for_laptop_query(self):
        result = run_pipeline("gaming laptop under 80000")
        assert isinstance(result, dict)
        assert result["recommendation"].get("title")
        assert result["recommendation"].get("score", 0) > 0

    def test_recommendation_has_justification(self):
        result = run_pipeline("best phone under 20000")
        justification = result["recommendation"].get("justification", "")
        assert len(justification) > 10

    def test_scored_products_sorted_descending(self):
        result = run_pipeline("tv under 40000")
        scores = [p["score"] for p in result["scored_products"]]
        assert scores == sorted(scores, reverse=True)

    def test_winner_matches_top_scored_product(self):
        result = run_pipeline("headphones")
        top_title = result["scored_products"][0]["title"]
        rec_title = result["recommendation"]["title"]
        assert top_title == rec_title

    def test_empty_query_returns_error_state(self):
        result = run_pipeline("")
        assert isinstance(result, dict)
        assert result.get("error") is not None
        assert result.get("recommendation") == {}

    def test_whitespace_query_returns_error_state(self):
        result = run_pipeline("   ")
        assert result.get("error") is not None

    def test_all_required_state_keys_present(self):
        result = run_pipeline("laptop")
        required_keys = {"query", "search_results", "scored_products", "recommendation"}
        assert required_keys.issubset(result.keys())

    def test_total_compared_matches_scored_products_count(self):
        result = run_pipeline("laptop")
        total = result["recommendation"].get("total_compared", 0)
        actual = len(result["scored_products"])
        assert total == actual

    def test_pipeline_does_not_raise_on_unusual_queries(self):
        unusual_queries = [
            "!@#$%",
            "a" * 150,
            "123",
            "best product",
        ]
        for q in unusual_queries:
            try:
                result = run_pipeline(q)
                assert isinstance(result, dict)
            except Exception as e:
                pytest.fail(f"Pipeline raised exception for query '{q}': {e}")
