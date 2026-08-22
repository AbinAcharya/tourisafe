import asyncio
import json
import requests
import websockets

BASE = 'http://127.0.0.1:8000'
WS_URL = 'ws://127.0.0.1:8000/ws'

async def main():
    async with websockets.connect(WS_URL) as socket:
        response = requests.post(BASE + '/telemetry', json={
            'user_id': 999,
            'lat': 12.9722,
            'lon': 77.5952,
        })
        print('telemetry:', response.status_code, response.text)
        while True:
            message = json.loads(await asyncio.wait_for(socket.recv(), timeout=3))
            if message.get('type') == 'telemetry_update':
                print('received:', message)
                return

asyncio.run(main())
