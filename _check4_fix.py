from agents.search_agent import _validate_review_count

tests = [
    (None,    0),
    ('',      0),
    ('2,847', 2847),
    ('1.2k',  1200),
    ('2k',    2000),
    ('1.5k',  1500),
    (500,     500),
    ('abc',   0),
    (-5,      0),
]
all_pass = True
for raw, expected in tests:
    result = _validate_review_count(raw)
    ok = result == expected
    if not ok: all_pass = False
    print(f"{'PASS' if ok else 'FAIL'}  input={str(raw):<10} -> {result} (expected {expected})")
print()
print('All pass:', all_pass)
