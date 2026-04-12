"""Check 3 — Relevance filter"""
from agents.search_agent import _is_relevant

tests = [
    ('Sony WH-1000XM4 Wireless Headphones',          'headphones', True),
    ('Headphone Stand Holder Desktop Mount',           'headphones', False),
    ('Replacement Ear Cushion Pad for Sony',           'headphones', False),
    ('boAt Airdopes 141 TWS Earbuds',                  'earbuds',    True),
    ('Silicone Ear Tips Replacement for AirPods',      'earbuds',    False),
    ('Samsung Galaxy M34 5G 8GB 128GB',                'phone',      True),
    ('Tempered Glass Screen Protector Samsung M34',    'phone',      False),
    ('Flip Cover Case for Redmi Note 13',              'phone',      False),
    ('ASUS VivoBook 15 Ryzen 5 Laptop',                'laptop',     True),
    ('Laptop Cooling Pad with 5 Fans USB',             'laptop',     False),
    ('Laptop Sleeve Bag 15.6 inch',                    'laptop',     False),
    ('Sony Bravia 43 inch 4K Smart TV',                'tv',         True),
    ('TV Wall Mount Bracket 32-55 inch',               'tv',         False),
]
all_pass = True
for title, cat, expected in tests:
    result = _is_relevant(title, cat)
    ok = result == expected
    if not ok:
        all_pass = False
    status = 'PASS' if ok else 'FAIL'
    print(f'{status}  {title[:48]:<50} -> {result}')
print()
print('All pass:', all_pass)
