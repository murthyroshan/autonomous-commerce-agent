"""Check 6 — Live search quality: earbuds under 3000"""
import os
from dotenv import load_dotenv
load_dotenv()

from agents.search_agent import _call_serper, _extract_budget, _detect_category

query    = 'earbuds under 3000'
budget   = _extract_budget(query)
category = _detect_category(query)
results  = _call_serper(query, max_price=budget, category=category)

print(f'Budget: Rs{budget:,.0f}  |  Category: {category}  |  Results: {len(results)}')
print()

issues = []
for p in results:
    rating_str = f'{p["rating"]}*' if p['rating'] > 0 else 'NO RATING'
    flag = ''
    if p['price'] > 3000:
        flag = '  <- OVER BUDGET'
        issues.append(p['title'])
    if p['price'] < 200:
        flag = '  <- FAKE PRICE'
        issues.append(p['title'])
    print(f'  Rs{p["price"]:>8,.0f}  {rating_str:<10}  {p["title"][:45]}{flag}')

print()
if issues:
    print(f'ISSUES: {len(issues)} bad products found')
    for i in issues:
        print(f'  - {i}')
else:
    print('Clean -- no bad products')
