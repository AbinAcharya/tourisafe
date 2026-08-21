const map = L.map('map').setView([20.5937,78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);

let marker = null;
let watchId = null;
let telemetryInterval = null;
let fencesLayer = L.geoJSON().addTo(map);

async function loadFences(){
  fencesLayer.clearLayers();
  const res = await fetch('/api/fences');
  const data = await res.json();
  data.forEach(f => {
    L.geoJSON(f.geojson, {style: {color: f.fence_type === 'restricted' ? 'red' : 'green'}}).addTo(fencesLayer);
  });
}
loadFences();

function setStatus(s){ document.getElementById('status').innerText = s }

document.getElementById('registerBtn').onclick = async () => {
  document.getElementById('authTitle').innerText = 'Register';
  document.getElementById('auth_user').value = '';
  document.getElementById('auth_email').value = '';
  document.getElementById('auth_pass').value = '';
  document.getElementById('authModal').style.display = 'flex';
  // set handler
  document.getElementById('authSubmit').onclick = async () => {
    const username = document.getElementById('auth_user').value;
    const email = document.getElementById('auth_email').value;
    const password = document.getElementById('auth_pass').value;
    const res = await fetch('/register?username='+encodeURIComponent(username)+'&email='+encodeURIComponent(email)+'&password='+encodeURIComponent(password), {method:'POST'});
    if (!res.ok) { setStatus('Register failed'); return }
    const data = await res.json();
    setStatus('Registered id='+data.id);
    localStorage.setItem('tourist_user_id', data.id);
    document.getElementById('authModal').style.display = 'none';
  };
}

document.getElementById('loginBtn').onclick = async () => {
  document.getElementById('authTitle').innerText = 'Login';
  document.getElementById('auth_user').value = '';
  document.getElementById('auth_email').value = '';
  document.getElementById('auth_pass').value = '';
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('authSubmit').onclick = async () => {
    const username = document.getElementById('auth_user').value;
    const password = document.getElementById('auth_pass').value;
    const form = new FormData(); form.append('username', username); form.append('password', password);
    const res = await fetch('/login', {method:'POST', body: form});
    if (!res.ok) { setStatus('Login failed'); return }
    const data = await res.json();
    setStatus('Logged in');
    localStorage.setItem('tourist_token', data.access_token);
    document.getElementById('authModal').style.display = 'none';
  };
}

document.getElementById('authCancel').onclick = () => { document.getElementById('authModal').style.display = 'none'; };

async function sendTelemetry(lat, lon){
  const payload = { user_id: localStorage.getItem('tourist_user_id') ? Number(localStorage.getItem('tourist_user_id')) : null, lat, lon };
  await fetch('/telemetry', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
}

document.getElementById('startTelemetry').onclick = async () => {
  if (navigator.geolocation){
    watchId = navigator.geolocation.watchPosition(async (pos)=>{
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      if (marker) marker.setLatLng([lat,lon]); else marker = L.marker([lat,lon]).addTo(map);
      map.setView([lat,lon], 15);
      await sendTelemetry(lat, lon);
      setStatus('Telemetry sent: '+lat.toFixed(5)+','+lon.toFixed(5));
    }, err => setStatus('geo error:'+err.message), {enableHighAccuracy:true});
  } else {
    setStatus('Geolocation not available');
  }
}

document.getElementById('stopTelemetry').onclick = () => {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  setStatus('Stopped telemetry');
}

document.getElementById('sosBtn').onclick = async () => {
  let lat, lon;
  if (marker){ lat = marker.getLatLng().lat; lon = marker.getLatLng().lng; }
  else { alert('please enable telemetry or allow location'); return }
  const payload = { user_id: localStorage.getItem('tourist_user_id') ? Number(localStorage.getItem('tourist_user_id')) : null, lat, lon, description: 'SOS from tourist' };
  const res = await fetch('/sos', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
  const data = await res.json();
  setStatus('SOS sent: incident '+data.incident_id);
}
