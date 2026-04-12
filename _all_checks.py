"""All 5 verification checks in one script."""
import os, sys
# Force UTF-8 output so the Rs symbol doesn't crash on Windows cp1252 terminals
sys.stdout.reconfigure(encoding="utf-8")
os.environ["MOCK_ONLY"] = "true"

# ── CHECK 1: run via subprocess so pytest isolation works ─────────────────────
import subprocess
print("=" * 60)
print("CHECK 1 — pytest")
print("=" * 60)
r = subprocess.run(
    [sys.executable, "-m", "pytest", "tests/", "-q"],
    env={**os.environ, "MOCK_ONLY": "true"},
)
print()

# ── CHECK 2: budget parsing ──────────────────────────────────────────────────
print("=" * 60)
print("CHECK 2 — budget parsing")
print("=" * 60)
from agents.search_agent import _extract_budget

cases = [
    ("gaming laptop under 30000", 30000.0),
    ("laptop under 30K",          30000.0),
    ("laptop for 25k",            25000.0),
    ("laptop between 20000 and 40000", 40000.0),
    ("laptop around 30000",       33000.0),
    ("30000 mein laptop",         30000.0),
    ("laptop 30,000 rupees",      30000.0),
    ("laptop ₹30000",             30000.0),
    ("best phone",                None),
]
all_pass_2 = True
for query, expected in cases:
    result = _extract_budget(query)
    ok = (
        (result is None and expected is None)
        or (expected is not None and result is not None and abs(result - expected) < 1000)
    )
    status = "PASS" if ok else "FAIL"
    if not ok:
        all_pass_2 = False
    print(f"{status}  {query:<40} -> {result}  (expected ~{expected})")
print()
print("All pass:", all_pass_2)
print()

# ── CHECK 3: category matching ───────────────────────────────────────────────
print("=" * 60)
print("CHECK 3 — category matching")
print("=" * 60)
from agents.mock_data import get_mock_products

cases3 = [
    ("wireless earbuds",           "earbud"),
    ("best headphone under 2000",  "headphone"),
    ("samsung smartphone",         "phone"),
    ("smart tv 43 inch",           "tv"),
    ("bluetooth speaker",          "speaker"),
    ("smartwatch under 5000",      "watch"),
    ("gaming laptop under 30000",  "laptop"),
    ("mechanical keyboard",        "keyboard"),
]
for query, expected_cat in cases3:
    results = get_mock_products(query)
    title = results[0]["title"].lower()
    match = expected_cat in title
    status = "PASS" if match else "WARN"
    print(f"{status}  {query:<35} -> {results[0]['title'][:45]}")
print()

# ── CHECK 4: tight budget ────────────────────────────────────────────────────
print("=" * 60)
print("CHECK 4 — tight budget (gaming laptop under 30000)")
print("=" * 60)
from agents.pipeline import run_pipeline

result = run_pipeline("gaming laptop under 30000")
n = len(result["scored_products"])
all_under = all(p["price"] <= 30000 for p in result["scored_products"])
print(f"Products compared : {n}")
print(f"All under budget  : {all_under}")
print(f"Error             : {result.get('error')}")
print(f"Winner            : {result['recommendation'].get('title')}")
print(f"Winner price      : Rs{result['recommendation'].get('price'):,.0f}")
print()

# ── CHECK 5: end-to-end categories ──────────────────────────────────────────
print("=" * 60)
print("CHECK 5 — end-to-end categories")
print("=" * 60)
queries5 = [
    "wireless earbuds under 5000",
    "best smartphone under 20000",
    "bluetooth speaker under 3000",
    "smartwatch under 10000",
    "gaming laptop under 80000",
]
for q in queries5:
    r = run_pipeline(q)
    rec = r["recommendation"]
    title = rec.get("title", "N/A")[:38]
    price = rec.get("price", 0)
    print(f"{q[:40]:<42} -> {title:<40} Rs{price:,.0f}")

print()
print("Done.")
