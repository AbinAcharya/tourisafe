import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from urllib import request, parse
url='http://127.0.0.1:8001/login'
body=parse.urlencode({'username':'admin','password':'admin'}).encode()
req=request.Request(url,data=body,headers={'Content-Type':'application/x-www-form-urlencoded'})
try:
    with request.urlopen(req) as r:
        print(r.status)
        print(r.read().decode())
except Exception as e:
    print('ERROR', e)
