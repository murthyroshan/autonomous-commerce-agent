"""Check 2 — Price sanity boundaries"""
from agents.search_agent import _is_price_sane

tests = [
    ('headphones', 1000.0,   None,    True),
    ('headphones', 100.0,    None,    False),
    ('headphones', 1000.0,   800.0,   False),
    ('earbuds',    150.0,    None,    False),
    ('laptop',     500.0,    None,    False),
    ('laptop',     55000.0,  None,    True),
    ('laptop',     55000.0,  30000.0, False),
    ('phone',      2000.0,   None,    False),
    ('phone',      15000.0,  None,    True),
    ('speaker',    200.0,    None,    False),
    ('watch',      400.0,    None,    False),
]
all_pass = True
for cat, price, budget, expected in tests:
    result = _is_price_sane(price, cat, budget)
    ok = result == expected
    if not ok:
        all_pass = False
    status = 'PASS' if ok else 'FAIL'
    print(f'{status}  {cat:<12} Rs{price:<10,.0f} budget={str(budget):<10} -> {result}')
print()
print('All pass:', all_pass)
