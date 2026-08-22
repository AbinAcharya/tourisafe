import requests, json
base='http://127.0.0.1:8000'
print('Login as admin...')
r = requests.post(base+'/login', data={'username':'abin','password':'1234'})
print(r.status_code, r.text)
if r.status_code!=200:
    raise SystemExit('login failed')
token = r.json().get('access_token')
headers = {'Authorization': 'Bearer '+token, 'Content-Type':'application/json'}
# polygon near Bangalore
lat=12.9718; lon=77.5946; d=0.001
poly = {"type":"Polygon","coordinates":[[[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d],[lon-d,lat-d]]]} 
payload = {"name":"Demo HighRisk Live","fence_type":"high-risk","geojson":poly}
print('Posting fence...')
r2 = requests.post(base+'/fences', headers=headers, data=json.dumps(payload))
print(r2.status_code, r2.text)
