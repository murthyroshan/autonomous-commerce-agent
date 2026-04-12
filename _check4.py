"""Check 4 — Rating and review validation"""
from agents.search_agent import _validate_rating, _validate_review_count

rating_tests = [
    (None,    0.0),
    ('',      0.0),
    ('4.2',   4.2),
    (4.5,     4.5),
    ('6.0',   0.0),   # invalid — above 5
    ('-1',    0.0),   # invalid — negative
    ('abc',   0.0),
    (0.0,     0.0),
]

review_tests = [
    (None,      0),
    ('',        0),
    ('2,847',   2847),
    ('1.2k',    1200),
    (500,       500),
    ('abc',     0),
    (-5,        0),
]

print('Rating validation:')
for raw, expected in rating_tests:
    result = _validate_rating(raw)
    ok = result == expected
    status = 'PASS' if ok else 'FAIL'
    print(f'  {status}  input={str(raw):<8} -> {result} (expected {expected})')

print()
print('Review count validation:')
for raw, expected in review_tests:
    result = _validate_review_count(raw)
    ok = result == expected
    status = 'PASS' if ok else 'FAIL'
    print(f'  {status}  input={str(raw):<10} -> {result} (expected {expected})')
