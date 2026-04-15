import requests, os, json
API_KEY = os.getenv('SERPER_API_KEY')
import sys, dotenv; dotenv.load_dotenv()
API_KEY = os.getenv('SERPER_API_KEY')
if not API_KEY: sys.exit('no key')
res = requests.post('https://google.serper.dev/videos', json={'q': 'OnePlus Buds 3 review', 'num': 10}, headers={'X-API-KEY': API_KEY})
print('YT:', json.dumps(res.json(), indent=2))
res2 = requests.post('https://google.serper.dev/search', json={'q': 'OnePlus Buds 3 review site:reddit.com', 'num': 10}, headers={'X-API-KEY': API_KEY})
print('Reddit:', json.dumps(res2.json(), indent=2))
