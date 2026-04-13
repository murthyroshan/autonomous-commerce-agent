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

    def test_exact_model_beats_variant(self):
        products = [
            {"title": "OnePlus 13 5G 12GB 256GB",
             "price": 69999.0, "rating": 4.5,
             "review_count": 2000, "source": "Amazon", "link": "#"},
            {"title": "OnePlus 13R 5G 8GB 128GB",
             "price": 35999.0, "rating": 4.4,
             "review_count": 15000, "source": "Amazon", "link": "#"},
            {"title": "OnePlus 13s 5G 8GB 128GB",
             "price": 29999.0, "rating": 4.3,
             "review_count": 8000, "source": "Amazon", "link": "#"},
        ]
        state: AgentState = {
            "query": "oneplus 13",
            "search_results": products,
            "scored_products": [],
            "recommendation": {},
            "error": None,
        }
        result = compare_agent(state, user_id="test_no_prefs")
        winner = result["scored_products"][0]["title"]
        assert "OnePlus 13 5G" in winner, f"Exact model should win. Got: {winner}"

    def test_relevance_score_function(self):
        from agents.compare_agent import _relevance_score
        assert _relevance_score("OnePlus 13 5G 12GB", "oneplus 13") > 0.7
        assert _relevance_score("OnePlus 13R 5G 8GB", "oneplus 13") < 0.7
        assert _relevance_score("OnePlus 13s 5G", "oneplus 13") < 0.7
        assert _relevance_score("Samsung Galaxy S24", "oneplus 13") < 0.3
        assert _relevance_score("Sony WH-1000XM5 Headphones", "sony headphones") > 0.5


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


# ── Feature 5: New TestCompareAgent additions ─────────────────────────────────

class TestCompareAgentNew:
    """Additional compare_agent tests added in Feature 5."""

    def test_log_normalization_with_outlier(self):
        # 50,000 reviews should not collapse 200 vs 800 to near-zero
        from agents.compare_agent import _log_normalize
        values = [200.0, 800.0, 50000.0]
        result = _log_normalize(values)
        # highest gets 1.0
        assert result[2] == 1.0
        assert result[1] > result[0]
        gap_low_mid  = result[1] - result[0]
        assert gap_low_mid > 0.05, "Low-mid gap too small — log normalization not working"

    def test_confidence_adjusted_rating_low_reviews(self):
        from agents.compare_agent import _confidence_adjusted_rating
        # 4.9 stars from 3 reviews should be pulled toward 2.5
        adj = _confidence_adjusted_rating(4.9, 3)
        assert adj < 4.0, f"Expected < 4.0 but got {adj}"
        assert adj > 2.5, "Should be above neutral"

    def test_confidence_adjusted_rating_full_confidence(self):
        from agents.compare_agent import _confidence_adjusted_rating
        # 100+ reviews → rating unchanged
        adj = _confidence_adjusted_rating(4.3, 150)
        assert abs(adj - 4.3) < 0.01

    def test_anomaly_detection_flags_suspicious_price(self):
        from agents.compare_agent import _detect_price_anomaly
        prices = [55000.0, 58000.0, 62000.0, 12000.0]  # 12k is suspicious
        suspicious, dev_pct, median = _detect_price_anomaly(12000.0, prices)
        assert suspicious is True
        assert dev_pct > 35.0

    def test_anomaly_detection_normal_price(self):
        from agents.compare_agent import _detect_price_anomaly
        prices = [55000.0, 58000.0, 62000.0, 52000.0]
        suspicious, _, _ = _detect_price_anomaly(52000.0, prices)
        assert suspicious is False


# ── Feature 5: TestBadgeEngine ────────────────────────────────────────────────

class TestBadgeEngine:

    def _make_product(self, title="Test Product", price=5000.0,
                      rating=4.2, review_count=500,
                      source="Amazon", score=0.75,
                      eliminated=False, elimination_reason=None,
                      price_suspicious=False, anomaly_deviation_pct=0.0,
                      anomaly_median_price=0.0,
                      trust_tier="tier2_high", trust_multiplier=1.06,
                      _adj_rating=4.2) -> dict:
        p = {
            "title": title, "price": price, "rating": rating,
            "review_count": review_count, "source": source,
            "score": score, "_adj_rating": _adj_rating,
            "trust_tier": trust_tier,
            "trust_multiplier": trust_multiplier,
            "price_suspicious": price_suspicious,
            "anomaly_deviation_pct": anomaly_deviation_pct,
            "anomaly_median_price": anomaly_median_price,
        }
        if eliminated:
            p["eliminated"] = True
            p["elimination_reason"] = elimination_reason or "Test elimination"
        return p

    def test_official_store_gets_tier1(self):
        from agents.badge_engine import assign_badges
        p = self._make_product(source="OnePlus Official Store",
                               trust_tier="tier1", trust_multiplier=1.12)
        assign_badges(p, [p])
        assert p["primary_badge"]["tier"] == "tier1"
        assert p["primary_badge"]["icon"] == "shield"

    def test_amazon_gets_tier2(self):
        from agents.badge_engine import assign_badges
        p = self._make_product(source="Amazon")
        assign_badges(p, [p])
        assert p["primary_badge"]["tier"] == "tier2"

    def test_unknown_store_gets_tier3(self):
        from agents.badge_engine import assign_badges
        p = self._make_product(source="SomeRandomShop.in",
                               trust_tier="unknown", trust_multiplier=0.88)
        assign_badges(p, [p])
        assert p["primary_badge"]["tier"] == "tier3"

    def test_suspicious_price_overrides_to_tier4(self):
        from agents.badge_engine import assign_badges
        p = self._make_product(
            source="Amazon", price=8000.0,
            price_suspicious=True, anomaly_deviation_pct=48.5,
            anomaly_median_price=58000.0
        )
        assign_badges(p, [p])
        assert p["primary_badge"]["tier"] == "tier4"
        assert p["primary_badge"]["suspicious_override"] is True
        assert "48.5%" in p["primary_badge"]["description"]

    def test_eliminated_product_gets_eliminated_badge(self):
        from agents.badge_engine import assign_badges
        p = self._make_product(
            eliminated=True, elimination_reason="Avoided brand", score=0.0
        )
        assign_badges(p, [p])
        assert p["primary_badge"]["tier"] == "eliminated"
        assert "Avoided brand" in p["primary_badge"]["description"]

    def test_low_confidence_secondary_badge(self):
        from agents.badge_engine import assign_badges
        p = self._make_product(review_count=12, _adj_rating=3.1)
        assign_badges(p, [p])
        labels = [b["label"] for b in p["secondary_badges"]]
        assert "Low Confidence" in labels
        low_conf = next(b for b in p["secondary_badges"]
                        if b["label"] == "Low Confidence")
        assert "12" in low_conf.get("note", "")

    def test_penalized_rating_secondary_badge(self):
        from agents.badge_engine import assign_badges
        p = self._make_product(rating=0.0, _adj_rating=2.5, review_count=500)
        assign_badges(p, [p])
        labels = [b["label"] for b in p["secondary_badges"]]
        assert "Penalized Rating" in labels

    def test_budget_pick_only_from_trusted_store(self):
        from agents.badge_engine import assign_badges
        cheap_untrusted = self._make_product(
            title="Cheap Unknown", price=500.0,
            source="SomeShop", trust_tier="unknown"
        )
        cheap_trusted = self._make_product(
            title="Cheap Trusted", price=800.0,
            source="Amazon", trust_tier="tier2_high"
        )
        expensive = self._make_product(
            title="Expensive", price=5000.0,
            source="Flipkart", trust_tier="tier2_high"
        )
        all_p = [cheap_untrusted, cheap_trusted, expensive]
        for p in all_p:
            assign_badges(p, all_p)
        trusted_labels   = [b["label"] for b in cheap_trusted["secondary_badges"]]
        untrusted_labels = [b["label"] for b in cheap_untrusted["secondary_badges"]]
        assert "Budget Pick" in trusted_labels
        assert "Budget Pick" not in untrusted_labels

    def test_most_reviewed_badge(self):
        from agents.badge_engine import assign_badges
        products = [
            self._make_product(title="A", review_count=500),
            self._make_product(title="B", review_count=15000),
            self._make_product(title="C", review_count=200),
        ]
        for p in products:
            assign_badges(p, products)
        b_labels = [b["label"] for b in products[1]["secondary_badges"]]
        assert "Most Reviewed" in b_labels
        a_labels = [b["label"] for b in products[0]["secondary_badges"]]
        assert "Most Reviewed" not in a_labels
