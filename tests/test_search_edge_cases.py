"""tests/test_search_edge_cases.py — regression tests for category detection
and budget extraction.

These lock in two fixes that are easy to silently break:
  1. Category misdetection — the phone keyword list matches bare brand names
     (samsung, oneplus, ...), so form-factor categories (tv/tablet/watch/earbuds)
     MUST be checked before "phone". Reordering the CATEGORY_KEYWORDS dict the
     wrong way reintroduces the bug.
  2. Budget false-positives — the word "for" plus a spec/count (e.g. "for 5g",
     "for 2 players") must NOT be read as a budget, while explicit budgets like
     "under 500" or "for 20k" must still parse.
"""

import os
import pytest

# Force mock mode so importing the search agent never triggers live calls.
os.environ["MOCK_ONLY"] = "true"

from agents.search_agent import _detect_category, _extract_budget


# ── Category detection ────────────────────────────────────────────────────────

class TestDetectCategory:
    @pytest.mark.parametrize("query, expected", [
        # Non-phone products of phone brands — these were the misclassified cases.
        ("Samsung Galaxy Watch 6",        "watch"),
        ("Samsung Galaxy Watch 6 Classic", "watch"),
        ("Samsung Galaxy Tab A9",         "tablet"),
        ("Samsung 43 inch 4K TV",         "tv"),
        ("Samsung Crystal UHD Television", "tv"),
        ("OnePlus Buds 3",                "earbuds"),
        ("OnePlus Nord Buds",             "earbuds"),
        # Genuine phones must STAY phones (guards against over-correcting).
        ("OnePlus 12",                    "phone"),
        ("Samsung Galaxy S24",            "phone"),
        ("iPhone 15",                     "phone"),
        ("best smartphone under 30000",   "phone"),
        ("redmi note 13",                 "phone"),
        # Other categories unaffected.
        ("gaming laptop under 80000",     "laptop"),
        ("wireless earbuds",              "earbuds"),
        ("noise cancelling headphones",   "headphones"),
        ("Sony dslr camera",              "camera"),
        ("mechanical keyboard",           "keyboard"),
        ("gaming mouse",                  "mouse"),
        # Unknown → default.
        ("random gizmo thing",            "default"),
    ])
    def test_category(self, query, expected):
        assert _detect_category(query) == expected


# ── Budget extraction ─────────────────────────────────────────────────────────

class TestExtractBudget:
    @pytest.mark.parametrize("query, expected", [
        # Explicit budgets that must be honoured.
        ("gaming laptop under 80000",     80000.0),
        ("mouse under 500",               500.0),   # legit low budget, above the ₹100 floor
        ("phone for 20k",                 20000.0),
        ("earbuds under 2k",              2000.0),
        ("headphones below 3000",         3000.0),
        ("laptop within 60000",           60000.0),
        ("phone upto 25000",              25000.0),
        ("tv budget of 45000",            45000.0),
        ("between 20000 and 30000 phone", 30000.0),
        # Spec / count words after "for" must NOT parse as budgets.
        ("phone for 5g connectivity",     None),
        ("mouse for 2 players",           None),
        ("5g phone",                      None),
        # No budget signal at all.
        ("best gaming laptop",            None),
        ("oneplus 12 vs samsung s24",     None),
    ])
    def test_budget(self, query, expected):
        assert _extract_budget(query) == expected

    def test_around_applies_stretch(self):
        # "around X" widens the budget by 10%.
        assert _extract_budget("laptop around 50000") == pytest.approx(55000.0)

    def test_k_suffix_survives_floor(self):
        # "5k" -> 5000, which is above the ₹100 spec/count floor.
        assert _extract_budget("phone for 5k") == 5000.0
