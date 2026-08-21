import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from urllib import request, parse
BASE='http://127.0.0.1:8001'

def post(path, data, token=None):
    data_bytes = parse.urlencode(data).encode()
    req = request.Request(BASE+path, data=data_bytes, headers={'Content-Type':'application/x-www-form-urlencoded'})
    if token: req.add_header('Authorization', 'Bearer '+token)
    with request.urlopen(req) as r:
        return r.status, r.read().decode()

# login as admin
status, body = post('/login', {'username':'admin','password':'admin'})
print('LOGIN', status, body)
import json
tok = None
try:
    tok = json.loads(body)['access_token']
except Exception:
    pass
if not tok:
    print('no token, abort')
    raise SystemExit(1)
# create admin user
import json
req = request.Request(BASE+'/admin/register', data=json.dumps({'username':'alice','email':'alice@example.com','password':'alicepw'}).encode(), headers={'Content-Type':'application/json','Authorization':'Bearer '+tok})
try:
    with request.urlopen(req) as r:
        print('CREATE ADMIN', r.status, r.read().decode())
except Exception as e:
    print('CREATE ADMIN ERR', e)
# reset admin password
req = request.Request(BASE+'/admin/reset_password', data=json.dumps({'username':'alice','new_password':'newpw'}).encode(), headers={'Content-Type':'application/json','Authorization':'Bearer '+tok})
try:
    with request.urlopen(req) as r:
        print('RESET', r.status, r.read().decode())
except Exception as e:
    print('RESET ERR', e)
