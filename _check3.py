from agents.mock_data import get_mock_products

queries = [
    'best headphone under 2000',
    'wireless earbuds',
    'samsung smartphone',
    'smart tv 43 inch',
    'bluetooth speaker',
    'smartwatch under 5000',
]
for q in queries:
    results = get_mock_products(q)
    print(f'{q[:40]:<42} -> {results[0]["title"][:35]}')
