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

const authModal = document.getElementById('authModal');
const authSubmit = document.getElementById('authSubmit');
const authCancel = document.getElementById('authCancel');

document.getElementById('registerBtn').addEventListener('click', () => {
  authModal.dataset.mode = 'register';
  document.getElementById('authTitle').innerText = 'Register';
  document.getElementById('auth_user').value = '';
  document.getElementById('auth_email').value = '';
  document.getElementById('auth_pass').value = '';
  authModal.style.display = 'flex';
});

document.getElementById('loginBtn').addEventListener('click', () => {
  authModal.dataset.mode = 'login';
  document.getElementById('authTitle').innerText = 'Login';
  document.getElementById('auth_user').value = '';
  document.getElementById('auth_email').value = '';
  document.getElementById('auth_pass').value = '';
  authModal.style.display = 'flex';
});

authCancel.addEventListener('click', () => { authModal.style.display = 'none'; });

authSubmit.addEventListener('click', async () => {
  const mode = authModal.dataset.mode;
  const username = document.getElementById('auth_user').value;
  const email = document.getElementById('auth_email').value;
  const password = document.getElementById('auth_pass').value;
  if (mode === 'register'){
    const res = await fetch('/register?username='+encodeURIComponent(username)+'&email='+encodeURIComponent(email)+'&password='+encodeURIComponent(password), {method:'POST'});
    if (!res.ok) { setStatus('Register failed'); return }
    const data = await res.json();
    setStatus('Registered id='+data.id);
    localStorage.setItem('tourist_user_id', data.id);
    authModal.style.display = 'none';
  } else if (mode === 'login'){
    try{
      const body = new URLSearchParams(); body.append('username', username); body.append('password', password);
      const res = await fetch('/login', {method:'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString()});
      const txt = await res.text(); let data=null; try{ data = JSON.parse(txt);}catch(e){}
      if (!res.ok){ setStatus('Login failed: '+(data&&data.detail?data.detail:txt)); return }
      setStatus('Logged in');
      localStorage.setItem('tourist_token', data.access_token);
      authModal.style.display = 'none';
    }catch(e){ setStatus('Login error: '+e.message) }
  }
});

async function sendTelemetry(lat, lon){
  const payload = { user_id: localStorage.getItem('tourist_user_id') ? Number(localStorage.getItem('tourist_user_id')) : null, lat, lon };
  const headers = {'Content-Type':'application/json'};
  const token = localStorage.getItem('tourist_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch('/telemetry', {method:'POST', headers, body: JSON.stringify(payload)});
  if (!res.ok){
    try{ const j = await res.json(); setStatus('Telemetry error: '+(j.detail||res.statusText)); } catch(e){ setStatus('Telemetry error: '+res.statusText); }
  }
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
  document.getElementById('startTelemetry').disabled = true;
  document.getElementById('stopTelemetry').disabled = false;
}

document.getElementById('stopTelemetry').onclick = () => {
  if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  setStatus('Stopped telemetry');
  document.getElementById('startTelemetry').disabled = false;
  document.getElementById('stopTelemetry').disabled = true;
}

document.getElementById('sosBtn').onclick = async () => {
  let lat, lon;
  if (marker){ lat = marker.getLatLng().lat; lon = marker.getLatLng().lng; }
  else { alert('please enable telemetry or allow location'); return }
  const payload = { user_id: localStorage.getItem('tourist_user_id') ? Number(localStorage.getItem('tourist_user_id')) : null, lat, lon, description: 'SOS from tourist' };
  const headers = {'Content-Type':'application/json'}; const token = localStorage.getItem('tourist_token'); if (token) headers['Authorization']='Bearer '+token;
  const res = await fetch('/sos', {method:'POST', headers, body: JSON.stringify(payload)});
  if (!res.ok){ try{ const j = await res.json(); setStatus('SOS error: '+(j.detail||res.statusText)); }catch(e){ setStatus('SOS error: '+res.statusText); } return }
  const data = await res.json();
  setStatus('SOS sent: incident '+data.incident_id);
}
