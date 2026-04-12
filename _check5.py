"""Check 5 — Live search quality: headphones under 10000"""
import os
from dotenv import load_dotenv
load_dotenv()

from agents.search_agent import _call_serper, _extract_budget, _detect_category

query    = 'headphones under 10000'
budget   = _extract_budget(query)
category = _detect_category(query)
results  = _call_serper(query, max_price=budget, category=category)

print(f'Budget: Rs{budget:,.0f}  |  Category: {category}  |  Results: {len(results)}')
print()

issues = []
for p in results:
    rating_str  = f'{p["rating"]}*' if p['rating'] > 0 else 'NO RATING'
    reviews_str = f'{p["review_count"]:,}' if p['review_count'] > 0 else 'NO REVIEWS'
    flag = ''
    if p['price'] > 10000:
        flag = '  <- OVER BUDGET'
        issues.append(f'Over budget: {p["title"]} Rs{p["price"]:,.0f}')
    if p['price'] < 200:
        flag = '  <- FAKE PRICE'
        issues.append(f'Fake price: {p["title"]} Rs{p["price"]:,.0f}')
    print(f'  Rs{p["price"]:>8,.0f}  {rating_str:<10}  {reviews_str:<8}  {p["title"][:45]}{flag}')

print()
if issues:
    print('ISSUES FOUND:')
    for i in issues:
        print(f'  - {i}')
else:
    print('No issues found -- all prices valid and within budget')
