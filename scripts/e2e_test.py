import requests, json, sys
base='http://127.0.0.1:8000'

print('LOGIN...')
r = requests.post(base+'/login', data={'username':'abin','password':'1234'})
print(r.status_code, r.text)
if r.status_code!=200:
    print('Login failed, aborting'); sys.exit(1)

token = r.json().get('access_token')
headers = {'Authorization': 'Bearer '+token, 'Content-Type':'application/json'}

print('\nCREATE FENCE...')
lat=12.9716; lon=77.5946; d=0.002
poly = {"type":"Polygon","coordinates":[[[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d],[lon-d,lat-d]]]} 
payload = {"name":"Test HighRisk","fence_type":"high-risk","geojson":poly}
try:
    r2 = requests.post(base+'/fences', headers=headers, data=json.dumps(payload))
    print(r2.status_code, r2.text)
except Exception as e:
    print('Fence create error', e)

print('\nLIST FENCES...')
r3 = requests.get(base+'/api/fences')
print(r3.status_code, r3.text)

print('\nSEND TELEMETRY (inside)...')
tele = {'user_id': None, 'lat': lat, 'lon': lon}
r4 = requests.post(base+'/telemetry', headers={'Content-Type':'application/json'}, data=json.dumps(tele))
print(r4.status_code, r4.text)

print('\nSEND SOS...')
sos = {'user_id': None, 'lat': lat, 'lon': lon, 'description':'Test SOS end-to-end'}
r5 = requests.post(base+'/sos', headers={'Content-Type':'application/json'}, data=json.dumps(sos))
print(r5.status_code, r5.text)

print('\nDONE')
