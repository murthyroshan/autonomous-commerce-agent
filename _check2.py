import os
from dotenv import load_dotenv

# Load from .env so SERPER_API_KEY is available
load_dotenv('.env')

from agents.search_agent import _extract_budget, _call_serper, _parse_serper_response

budget = _extract_budget('gaming laptop under 30000')
print('Budget detected:', budget)
results = _call_serper('gaming laptop under 30000', max_price=budget)
prices = [p['price'] for p in results]
print('Prices returned:', prices)
over_budget = [p for p in results if p['price'] > 30000]
print('Over budget items (should be 0):', len(over_budget))
