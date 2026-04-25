"""Quick smoke-test for the search_agent filters."""
from agents.search_agent import _is_relevant, _enrich_query, CROSS_CATEGORY_BLOCKLIST

# Exact title from user's complaint
GARBAGE = "FORIDA Laptop Keyboard Compatible for Dell Inspiron 15 15R 3000 15-5000 15-7000 7557 N5547 N5545 15r-3542 15mr-1528 MB346-001 PK1313G1B32 0KPP2C"
result = _is_relevant(GARBAGE, "phone")

print(f"Filter blocks FORIDA keyboard: {not result}  (should be True)")
print(f"  'keyboard compatible' in title: {'keyboard compatible' in GARBAGE.lower()}")
print(f"  CROSS_CATEGORY_BLOCKLIST exists: {'CROSS_CATEGORY_BLOCKLIST' in dir()}")
print(f"  phone blocklist has 'keyboard compatible': {'keyboard compatible' in CROSS_CATEGORY_BLOCKLIST.get('phone', [])}")
print()
print(f"Enriched query: {_enrich_query('oneplus 15', category='phone')}")
