"""tests/test_api.py — FastAPI endpoint tests using httpx TestClient."""

import os
import pytest

os.environ["MOCK_ONLY"] = "true"

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestSearchEndpoint:
    def test_valid_query_returns_200(self):
        r = client.post("/api/search", json={"query": "gaming laptop under 80000"})
        assert r.status_code == 200

    def test_response_has_required_fields(self):
        r = client.post("/api/search", json={"query": "laptop"})
        body = r.json()
        assert "query" in body
        assert "scored_products" in body
        assert "recommendation" in body

    def test_scored_products_sorted_by_score(self):
        r = client.post("/api/search", json={"query": "laptop"})
        products = r.json()["scored_products"]
        if len(products) > 1:
            scores = [p["score"] for p in products]
            assert scores == sorted(scores, reverse=True)

    def test_empty_query_returns_422(self):
        r = client.post("/api/search", json={"query": ""})
        assert r.status_code == 422

    def test_missing_query_field_returns_422(self):
        r = client.post("/api/search", json={})
        assert r.status_code == 422

    def test_query_too_long_returns_422(self):
        r = client.post("/api/search", json={"query": "a" * 201})
        assert r.status_code == 422

    def test_recommendation_has_justification(self):
        r = client.post("/api/search", json={"query": "phone"})
        rec = r.json().get("recommendation")
        assert rec is not None
        assert len(rec.get("justification", "")) > 0


class TestStreamEndpoint:
    def test_stream_returns_200(self):
        r = client.get("/api/search/stream?query=laptop")
        assert r.status_code == 200

    def test_stream_content_type_is_event_stream(self):
        r = client.get("/api/search/stream?query=laptop")
        assert "text/event-stream" in r.headers.get("content-type", "")

    def test_stream_contains_result_event(self):
        import json
        r = client.get("/api/search/stream?query=laptop")
        events = []
        for line in r.text.splitlines():
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except json.JSONDecodeError:
                    pass
        result_events = [e for e in events if e.get("type") == "result"]
        assert len(result_events) == 1

    def test_stream_empty_query_returns_400(self):
        r = client.get("/api/search/stream?query=")
        assert r.status_code == 400


class TestConfirmEndpoint:
    def test_confirm_returns_success(self):
        r = client.post("/api/confirm", json={
            "title": "Test Laptop",
            "price": 55000.0,
            "source": "Amazon",
            "link": "https://amazon.in/test",
            "score": 0.85,
        })
        assert r.status_code == 200
        assert r.json()["success"] is True
