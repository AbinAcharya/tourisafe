import time
import json
from urllib import request, parse, error

BASE = 'http://127.0.0.1:8001'


def http_get(path, timeout=5):
    url = BASE + path
    try:
        with request.urlopen(url, timeout=timeout) as r:
            return r.getcode(), r.read().decode('utf-8')
    except Exception as e:
        return None, str(e)


def http_post(path, params=None, data=None, json_body=None, timeout=8):
    url = BASE + path
    if params:
        url += '?' + parse.urlencode(params)
    headers = {}
    body = None
    if json_body is not None:
        body = json.dumps(json_body).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    elif data is not None:
        body = parse.urlencode(data).encode('utf-8')
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    # urllib sends GET when data is None; ensure POST by sending empty body when needed
    if body is None:
        body = b''
    req = request.Request(url, data=body, headers=headers)
    try:
        with request.urlopen(req, timeout=timeout) as r:
            return r.getcode(), r.read().decode('utf-8')
    except error.HTTPError as he:
        try:
            body = he.read().decode('utf-8')
        except Exception:
            body = str(he)
        return he.code, body
    except Exception as e:
        return None, str(e)


def wait_up(timeout=10):
    t0 = time.time()
    while time.time() - t0 < timeout:
        code, _ = http_get('/')
        if code in (200, 307):
            return True
        time.sleep(0.5)
    return False


if not wait_up(15):
    print('server not responding on', BASE)
    raise SystemExit(1)

print('Server up — running tests against', BASE)

code, text = http_post('/register', params={'username': 'debuguser', 'email': 'debug@example.com', 'password': 'secret'})
print('REGISTER', code, text)

code, text = http_post('/login', data={'username': 'debuguser', 'password': 'secret'})
print('LOGIN', code, text)

code, text = http_post('/sos', json_body={'user_id': None, 'lat': 17.3850, 'lon': 78.4867, 'description': 'test sos'})
print('SOS', code, text)

code, text = http_post('/telemetry', json_body={'user_id': None, 'lat': 17.3850, 'lon': 78.4867})
print('TELEMETRY', code, text)
