import traceback
from blockchain.algorand import build_unsigned_transaction
import json

try:
  res = build_unsigned_transaction({'title':'Test', 'price':100, 'source':'Amazon', 'link':'http://a.to/1', 'sender_address':'HQN35QRACXQA5VAUPXXA5TUCE6RARKXQUGUNKNIKVBWLYL3HCTIKPE35AM'})
  print('Success:', res)
except Exception as e:
  traceback.print_exc()
