import requests

print('Registering...')
r = requests.post('http://localhost:8000/register', params={'username':'testuser','email':'test@example.com','password':'secret'})
print(r.status_code)
print(r.text)

print('\nLogging in...')
r2 = requests.post('http://localhost:8000/login', data={'username':'testuser','password':'secret'})
print(r2.status_code)
print(r2.text)

print('\nSending SOS...')
r3 = requests.post('http://localhost:8000/sos', json={'user_id':None,'lat':17.3850,'lon':78.4867,'description':'test sos'})
print(r3.status_code)
print(r3.text)

print('\nSending telemetry...')
r4 = requests.post('http://localhost:8000/telemetry', json={'user_id':None,'lat':17.3850,'lon':78.4867})
print(r4.status_code)
print(r4.text)
