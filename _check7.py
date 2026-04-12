"""Check 7 — Scoring treats unverified ratings correctly"""
import os
os.environ['MOCK_ONLY'] = 'true'

from agents.compare_agent import compare_agent

# Product A: great price, NO rating (0.0)
# Product B: higher price, verified 4.5 rating
# Product C: mid price, verified 4.1 rating
# Product B or C should win — Product A (unverified) must NOT win

products = [
    {'title': 'Product A (no rating)', 'price': 1000.0, 'rating': 0.0,
     'review_count': 0,    'source': 'Amazon',   'link': '#'},
    {'title': 'Product B (rated 4.5)', 'price': 2000.0, 'rating': 4.5,
     'review_count': 5000, 'source': 'Amazon',   'link': '#'},
    {'title': 'Product C (rated 4.1)', 'price': 1500.0, 'rating': 4.1,
     'review_count': 1200, 'source': 'Flipkart', 'link': '#'},
]

state = {
    'query': 'test',
    'search_results': products,
    'scored_products': [],
    'recommendation': {},
    'error': None,
}
result = compare_agent(state)

print('Ranked results:')
for p in result['scored_products']:
    verified = 'verified' if p.get('rating_verified') else 'UNVERIFIED'
    print(f'  {p["title"]:<30}  score={p["score"]:.4f}  rating={p["rating"]}  ({verified})')

winner = result['scored_products'][0]['title']
print()
print(f'Winner: {winner}')
print(f'Correct (should NOT be "Product A (no rating)"): {winner != "Product A (no rating)"}')
