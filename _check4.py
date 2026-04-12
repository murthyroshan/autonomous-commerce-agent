import os
os.environ['MOCK_ONLY'] = 'true'
from agents.pipeline import run_pipeline

result = run_pipeline('gaming laptop under 30000')
prices = [p['price'] for p in result['scored_products']]
print('All prices:', prices)
print('Any over 30000?', any(p > 30000 for p in prices))
print('Winner:', result['recommendation']['title'])
print('Winner price: Rs', result['recommendation']['price'])
