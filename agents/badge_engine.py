"""
agents/badge_engine.py — trust & recognition badge system.

Called by compare_agent() after scoring.
No other module imports this directly.

Public entry point: assign_badges(product, all_products)
"""

# ── Store tier keyword lists ───────────────────────────────────────────────────

OFFICIAL_STORE_KEYWORDS = [
    "oneplus", "samsung", "apple", "xiaomi", "realme", "oppo",
    "vivo", "sony", "motorola", "nothing", "iqoo", "boat",
    "noise", "hp", "dell", "lenovo", "asus", "acer", "canon",
    "nikon", "dyson", "official", "brand store", "authorized"
]

TRUSTED_RETAILER_KEYWORDS = [
    "amazon", "flipkart", "croma", "reliance digital",
    "vijay sales", "tatacliq", "meesho", "jiomart",
    "snapdeal", "paytm mall"
]

HIGH_TRUST_RETAILERS = ["amazon", "flipkart"]


def _classify_store_tier(source: str) -> str:
    """Return 'tier1' | 'tier2_high' | 'tier2_low' | 'tier3' for the given store name."""
    s = source.lower()
    if any(kw in s for kw in OFFICIAL_STORE_KEYWORDS):
        return "tier1"
    if any(kw in s for kw in HIGH_TRUST_RETAILERS):
        return "tier2_high"
    if any(kw in s for kw in TRUSTED_RETAILER_KEYWORDS):
        return "tier2_low"
    return "tier3"


# ── Primary badge builder ─────────────────────────────────────────────────────

def _primary_badge(product: dict) -> dict:
    """Build the one primary badge for this product."""
    source     = product.get("source", "")
    eliminated = product.get("eliminated", False)
    suspicious = product.get("price_suspicious", False)

    if eliminated:
        return {
            "tier":               "eliminated",
            "label":              "Eliminated",
            "color":              "#3a3a3a",
            "icon":               "block",
            "description":        product.get("elimination_reason", "Removed"),
            "trust_multiplier":   0.0,
            "suspicious_override": False,
        }

    store_tier = _classify_store_tier(source)

    if suspicious:
        return {
            "tier":               "tier4",
            "label":              "Suspicious Listing",
            "color":              "#ef4444",
            "icon":               "alert_circle",
            "description": (
                f"Price is {product.get('anomaly_deviation_pct', 0):.1f}% "
                f"below median ₹{product.get('anomaly_median_price', 0):,.0f}. "
                f"Verify before purchasing."
            ),
            "trust_multiplier":    product.get("trust_multiplier", 0.88),
            "suspicious_override": True,
            "original_tier":       store_tier,
        }

    if store_tier == "tier1":
        return {
            "tier":               "tier1",
            "label":              "Official Store",
            "color":              "#00d4aa",
            "icon":               "shield",
            "description":        "Full official warranty guaranteed.",
            "trust_multiplier":   product.get("trust_multiplier", 1.12),
            "suspicious_override": False,
        }

    if store_tier in ("tier2_high", "tier2_low"):
        return {
            "tier":               "tier2",
            "label":              "Trusted Retailer",
            "color":              "#7c3aed",
            "icon":               "seal",
            "description":        "Established retailer with buyer protection.",
            "trust_multiplier":   product.get("trust_multiplier", 1.06),
            "suspicious_override": False,
        }

    return {
        "tier":               "tier3",
        "label":              "Unverified Seller",
        "color":              "#e8a045",
        "icon":               "warning_triangle",
        "description":        "Check seller ratings before purchasing.",
        "trust_multiplier":   product.get("trust_multiplier", 0.88),
        "suspicious_override": False,
    }


# ── Secondary badges builder ──────────────────────────────────────────────────

def _secondary_badges(product: dict, all_products: list[dict]) -> list[dict]:
    """Build the list of secondary recognition/warning badges for this product."""
    badges: list[dict] = []
    non_eliminated = [p for p in all_products if not p.get("eliminated")]

    def make(label: str, color: str, note: str = None) -> dict:
        b: dict = {"label": label, "color": color}
        if note:
            b["note"] = note
        return b

    # Best Value — highest rating-to-price ratio among non-eliminated
    def value_ratio(p: dict) -> float:
        return p.get("_adj_rating", 0) / p["price"] if p["price"] > 0 else 0

    if non_eliminated and product == max(non_eliminated, key=value_ratio):
        badges.append(make("Best Value", "#00d4aa"))

    # Most Reviewed — highest review_count
    if non_eliminated and product == max(
        non_eliminated, key=lambda p: p.get("review_count", 0)
    ):
        badges.append(make("Most Reviewed", "#7c3aed"))

    # Top Rated — highest confidence-adjusted rating
    if non_eliminated and product == max(
        non_eliminated, key=lambda p: p.get("_adj_rating", 0)
    ):
        badges.append(make("Top Rated", "#00d4aa"))

    # Budget Pick — lowest price among trusted stores only
    trusted = [
        p for p in non_eliminated
        if _classify_store_tier(p.get("source", "")) in
           ("tier1", "tier2_high", "tier2_low")
    ]
    if trusted and product == min(trusted, key=lambda p: p["price"]):
        badges.append(make("Budget Pick", "#e8a045"))

    # Premium Pick — highest price AND in top 2 scores
    sorted_by_score = sorted(non_eliminated,
                             key=lambda p: p.get("score", 0), reverse=True)
    top2 = sorted_by_score[:2]
    if non_eliminated and product == max(
        non_eliminated, key=lambda p: p["price"]
    ) and product in top2:
        badges.append(make("Premium Pick", "#f5f5f5"))

    # Preferred Brand
    if product.get("preference_boosted"):
        badges.append(make("Preferred Brand", "#e8a045"))

    # Low Confidence — fewer than 30 reviews
    rc = product.get("review_count", 0)
    if rc < 30 and not product.get("eliminated"):
        badges.append(make(
            "Low Confidence", "#888888",
            note=f"Only {rc} review{'s' if rc != 1 else ''}"
        ))

    # Penalized Rating — no rating data, defaulted to neutral
    if product.get("rating", 0) == 0.0 and not product.get("eliminated"):
        badges.append(make(
            "Penalized Rating", "#888888",
            note="No rating available — defaulted to 2.5★"
        ))

    return badges


# ── Public entry point ────────────────────────────────────────────────────────

def assign_badges(product: dict, all_products: list[dict]) -> dict:
    """
    Attach primary_badge and secondary_badges to a product dict.
    Returns the modified product (also mutates in place).
    Call this after scoring, before returning from compare_agent().
    """
    product["primary_badge"]    = _primary_badge(product)
    product["secondary_badges"] = _secondary_badges(product, all_products)
    return product
