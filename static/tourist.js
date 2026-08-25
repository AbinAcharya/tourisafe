const map = L.map('map', {zoomControl: false, scrollWheelZoom: true, keyboard: true}).setView([20.5937,78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);

let marker = null;
let accuracyCircle = null;
let watchId = null;
let telemetryInterval = null;
let fencesLayer = L.geoJSON().addTo(map);
const defaultView = [20.5937, 78.9629];

function setupMapControls(){
  document.getElementById('touristZoomIn')?.addEventListener('click', () => map.zoomIn());
  document.getElementById('touristZoomOut')?.addEventListener('click', () => map.zoomOut());
  document.getElementById('touristResetView')?.addEventListener('click', () => map.setView(defaultView, 5));
  document.getElementById('touristFullscreen')?.addEventListener('click', () => document.querySelector('.map-wrap')?.requestFullscreen?.());
  document.getElementById('touristLocate')?.addEventListener('click', () => {
    if (marker) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15));
    else setStatus('Start tracking to locate yourself');
  });
}
setupMapControls();

const body = document.body;
const contacts = JSON.parse(localStorage.getItem('tourist_contacts') || '[]');
const settings = JSON.parse(localStorage.getItem('tourist_settings') || '{}');
const tripState = JSON.parse(localStorage.getItem('tourist_trip') || '{"active":false,"startedAt":null}');
let alertTimeout = null;
function setTouristAlert(title, message, tone='alert'){
  const banner = document.getElementById('touristAlertBanner');
  banner.className = `safety-alert-banner ${tone}`;
  document.getElementById('touristAlertTitle').textContent = title;
  document.getElementById('touristAlertBody').textContent = message;
  banner.hidden = false;
  clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => { banner.hidden = true; }, 12000);
}
function updateTripUI(){
  const button = document.getElementById('tripCheckIn');
  if (!button) return;
  button.textContent = tripState.active ? 'End trip' : 'Start trip';
  document.getElementById('tripShare').textContent = tripState.active ? 'Copy trip link' : 'Share trip';
}
updateTripUI();
document.getElementById('dismissTouristAlert')?.addEventListener('click', () => { document.getElementById('touristAlertBanner').hidden = true; });
document.getElementById('tripCheckIn')?.addEventListener('click', () => { tripState.active = !tripState.active; tripState.startedAt = tripState.active ? new Date().toISOString() : null; localStorage.setItem('tourist_trip', JSON.stringify(tripState)); updateTripUI(); setTouristAlert(tripState.active ? 'Trip check-in active' : 'Trip ended', tripState.active ? 'Your safety session is ready.' : 'Your session has been closed.', 'notice'); });
document.getElementById('tripShare')?.addEventListener('click', async () => { const text = `Tourisafe trip status: ${tripState.active ? 'active' : 'not active'}`; if (navigator.share) await navigator.share({title:'Tourisafe trip', text}); else { await navigator.clipboard?.writeText(text); setTouristAlert('Trip status copied', 'Share it with someone you trust.', 'notice'); } });
function applySettings(){
  body.classList.toggle('large-text', Boolean(settings.largeText));
  document.getElementById('largeTextToggle').checked = Boolean(settings.largeText);
  document.getElementById('darkMapToggle').checked = Boolean(settings.darkMap);
  document.getElementById('languageSelect').value = settings.language || 'English';
  document.getElementById('map').classList.toggle('map-dark', Boolean(settings.darkMap));
}
function updateContactSummary(){
  const summary = document.getElementById('contactSummary');
  if (summary) summary.textContent = contacts.length ? `${contacts.length} contact${contacts.length === 1 ? '' : 's'} saved` : 'No contacts saved';
}
function renderContacts(){
  const list = document.getElementById('contactsList');
  if (!list) return;
  list.innerHTML = contacts.length ? contacts.map((contact, index) => `<div class="contact-card"><span><strong>${contact.name}</strong><small>${contact.phone}</small></span><a href="tel:${encodeURIComponent(contact.phone)}" aria-label="Call ${contact.name}">&#9742;</a><button class="contact-remove" data-contact-index="${index}" aria-label="Remove ${contact.name}">&times;</button></div>`).join('') : '<div class="empty-state">Add someone you trust.</div>';
  list.querySelectorAll('.contact-remove').forEach(button => button.addEventListener('click', () => { contacts.splice(Number(button.dataset.contactIndex), 1); localStorage.setItem('tourist_contacts', JSON.stringify(contacts)); renderContacts(); updateContactSummary(); }));
}
applySettings();
updateContactSummary();
document.getElementById('touristSettings')?.addEventListener('click', () => { const drawer = document.getElementById('touristUtilityDrawer'); drawer.hidden = !drawer.hidden; });
document.getElementById('closeUtility')?.addEventListener('click', () => { document.getElementById('touristUtilityDrawer').hidden = true; });
document.getElementById('touristLegend')?.addEventListener('click', () => { document.getElementById('touristLegendPanel').hidden = false; });
document.getElementById('closeLegend')?.addEventListener('click', () => { document.getElementById('touristLegendPanel').hidden = true; });
document.getElementById('largeTextToggle')?.addEventListener('change', event => { settings.largeText = event.target.checked; localStorage.setItem('tourist_settings', JSON.stringify(settings)); applySettings(); });
document.getElementById('darkMapToggle')?.addEventListener('change', event => { settings.darkMap = event.target.checked; localStorage.setItem('tourist_settings', JSON.stringify(settings)); applySettings(); });
document.getElementById('languageSelect')?.addEventListener('change', event => { settings.language = event.target.value; localStorage.setItem('tourist_settings', JSON.stringify(settings)); });
document.getElementById('nearbyHelp')?.addEventListener('click', () => {
  const query = marker ? `${marker.getLatLng().lat},${marker.getLatLng().lng}` : 'hospitals police pharmacies near me';
  window.open(`https://www.google.com/maps/search/${encodeURIComponent(`hospitals police pharmacies near ${query}`)}`, '_blank', 'noopener');
});
document.getElementById('trustedContacts')?.addEventListener('click', () => { renderContacts(); document.getElementById('contactsModal').hidden = false; });
document.getElementById('contactsClose')?.addEventListener('click', () => { document.getElementById('contactsModal').hidden = true; });
document.getElementById('contactAdd')?.addEventListener('click', () => { const name = document.getElementById('contactName').value.trim(); const phone = document.getElementById('contactPhone').value.trim(); if (!name || !phone) return; contacts.push({name, phone}); localStorage.setItem('tourist_contacts', JSON.stringify(contacts)); document.getElementById('contactName').value = ''; document.getElementById('contactPhone').value = ''; renderContacts(); updateContactSummary(); });
window.addEventListener('online', () => { body.classList.remove('offline'); document.getElementById('statusMetrics').textContent = 'Online'; });
window.addEventListener('offline', () => { body.classList.add('offline'); document.getElementById('statusMetrics').textContent = 'Offline'; setStatus('Connection lost'); });
if (!navigator.onLine) body.classList.add('offline');

const touristNotificationStore = JSON.parse(localStorage.getItem('tourist_notifications') || '[]');
function addTouristNotification(title, body, tone='warning'){
  touristNotificationStore.unshift({title, body, tone, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})});
  touristNotificationStore.splice(0, Math.max(0, touristNotificationStore.length - 12));
  localStorage.setItem('tourist_notifications', JSON.stringify(touristNotificationStore));
  renderTouristNotifications();
  addTimelineItem(title, body);
}
function renderTouristNotifications(){
  const list = document.getElementById('touristNotificationList');
  const count = document.getElementById('touristNotificationCount');
  if (!list || !count) return;
  count.hidden = !touristNotificationStore.length;
  count.textContent = touristNotificationStore.length;
  list.innerHTML = touristNotificationStore.length ? touristNotificationStore.map(n => `<div class="notification-item ${n.tone}"><strong>${n.title}</strong><small>${n.body} · ${n.time}</small></div>`).join('') : '<div class="empty-state">No new activity</div>';
}
function addTimelineItem(title, body){
  const list = document.getElementById('timelineList');
  if (!list) return;
  const item = document.createElement('div'); item.className = 'timeline-item';
  item.innerHTML = `<span></span><p><strong>${title}</strong><small>${body}</small></p>`;
  list.prepend(item);
  while (list.children.length > 4) list.lastElementChild.remove();
}
renderTouristNotifications();
document.getElementById('touristNotifications')?.addEventListener('click', () => { const drawer = document.getElementById('touristNotificationDrawer'); drawer.hidden = !drawer.hidden; });
document.getElementById('touristClearNotifications')?.addEventListener('click', () => { touristNotificationStore.splice(0); localStorage.setItem('tourist_notifications', '[]'); renderTouristNotifications(); });

// WebSocket for realtime alerts (incidents, fence alerts, telemetry anomalies)
try{
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(protocol + '://' + window.location.host + '/ws');
  ws.onmessage = (ev) => {
    try{
      const msg = JSON.parse(ev.data);
      if (msg.type === 'incident_created'){
        L.marker([msg.lat, msg.lon]).bindPopup(msg.description || 'Incident').addTo(map);
        notify('Incident reported', msg.description || 'An incident was reported nearby');
        setStatus('Incident reported');
      }
      if (msg.type === 'telemetry_anomaly'){
        L.circle([msg.lat, msg.lon], {radius:50, color:'orange'}).addTo(map);
        notify('Telemetry anomaly', `User ${msg.user_id} speed ${msg.speed}`);
      }
      if (msg.type === 'fence_created'){
        // add to fences layer
        const g = L.geoJSON(msg.geojson, {style: {color: msg.fence_type === 'restricted' ? 'red' : (msg.fence_type === 'high-risk' ? 'orange' : 'green')}}).addTo(fencesLayer);
        // if current user location exists and inside, notify immediately
        if (marker && (msg.fence_type === 'restricted' || msg.fence_type === 'high-risk')){
          const p = [marker.getLatLng().lat, marker.getLatLng().lng];
          if (pointInPolygon(p, msg.geojson)){
            const label = msg.fence_type === 'high-risk' ? 'High-risk area' : 'Restricted area';
            notify(label, `You are inside ${msg.fence_type} area: ${msg.name}`);
            setStatus('Entered '+msg.fence_type+' area: '+msg.name);
          }
        }
      }
      if (msg.type === 'fence_deleted' || msg.type === 'fences_deleted'){
        loadFences();
      }
      if (msg.type === 'fence_alert'){
        // server detected a user inside a restricted or high-risk fence
        const label = msg.fence_type === 'restricted' ? 'Restricted area' : 'High-risk area';
        notify(label, `Entered ${msg.fence}`);
        setStatus(label+': '+msg.fence);
        document.getElementById('touristSafetyScore').textContent = msg.fence_type === 'restricted' ? 'Restricted' : 'High risk';
        document.getElementById('touristSafetyDetail').textContent = msg.fence;
        setTouristAlert(label, `You entered ${msg.fence}`, 'alert');
        L.circle([msg.lat, msg.lon], {radius:50, color:'red'}).addTo(map);
      }
    }catch(e){ console.error(e) }
  }
}catch(e){console.warn('WebSocket failed', e)}

async function loadFences(){
  fencesLayer.clearLayers();
  const res = await fetch('/api/fences');
  const data = await res.json();
  data.forEach(f => {
    L.geoJSON(f.geojson, {style: {color: f.fence_type === 'restricted' ? 'red' : (f.fence_type === 'high-risk' ? 'orange' : 'green')}}).addTo(fencesLayer);
  });
}
loadFences();

function setStatus(s){
  const status = document.getElementById('status');
  if (!status) return;
  const title = status.querySelector('strong'); const detail = status.querySelector('small');
  if (title && detail){ title.textContent = s; detail.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
  else status.textContent = s;
}

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
    syncTouristSession();
    authModal.style.display = 'none';
  } else if (mode === 'login'){
    try{
      const body = new URLSearchParams(); body.append('username', username); body.append('password', password);
      const res = await fetch('/login', {method:'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString()});
      const txt = await res.text(); let data=null; try{ data = JSON.parse(txt);}catch(e){}
      if (!res.ok){ setStatus('Login failed: '+(data&&data.detail?data.detail:txt)); return }
      setStatus('Logged in');
      localStorage.setItem('tourist_token', data.access_token);
      syncTouristSession();
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

function syncTouristSession(){
  const loggedIn = Boolean(localStorage.getItem('tourist_token') || localStorage.getItem('tourist_user_id'));
  document.getElementById('loginBtn').hidden = loggedIn;
  document.getElementById('registerBtn').hidden = loggedIn;
  document.getElementById('touristSession').hidden = !loggedIn;
}
syncTouristSession();
document.getElementById('touristSessionBtn')?.addEventListener('click', () => {
  const menu = document.getElementById('touristSessionMenu'); menu.hidden = !menu.hidden;
  document.getElementById('touristSessionBtn').setAttribute('aria-expanded', String(!menu.hidden));
});
document.getElementById('touristLogout')?.addEventListener('click', () => { localStorage.removeItem('tourist_token'); localStorage.removeItem('tourist_user_id'); syncTouristSession(); document.getElementById('touristSessionMenu').hidden = true; setStatus('Signed out'); });

document.getElementById('startTelemetry').onclick = async () => {
  if (navigator.geolocation){
    setStatus('Requesting location...');
    watchId = navigator.geolocation.watchPosition(async (pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      if (marker) marker.setLatLng([lat,lon]); else marker = L.marker([lat,lon]).addTo(map);
      if (accuracyCircle) accuracyCircle.setLatLng([lat, lon]).setRadius(pos.coords.accuracy || 0);
      else accuracyCircle = L.circle([lat, lon], {radius: pos.coords.accuracy || 0, color:'#2878c8', fillColor:'#2878c8', fillOpacity:.08, weight:1}).addTo(map);
      map.setView([lat,lon], 15);
      await sendTelemetry(lat, lon);
      body.classList.add('tracking-active');
      document.getElementById('statusMetrics').textContent = `${Math.round(pos.coords.accuracy || 0)}m accuracy`;
      setStatus('Location sharing active');
    }, err => { body.classList.remove('tracking-active'); setStatus(err.code === 1 ? 'Location permission needed' : 'Location unavailable'); }, {enableHighAccuracy:true});
  } else {
    setStatus('Geolocation not available');
  }
  document.getElementById('startTelemetry').disabled = true;
  document.getElementById('stopTelemetry').disabled = false;
}

document.getElementById('stopTelemetry').onclick = () => {
  if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  setStatus('Stopped telemetry');
  body.classList.remove('tracking-active');
  document.getElementById('statusMetrics').textContent = navigator.onLine ? 'Online' : 'Offline';
  document.getElementById('startTelemetry').disabled = false;
  document.getElementById('stopTelemetry').disabled = true;
}

// small helper: browser notification (asks permission on first use)
function notify(title, body){
  addTouristNotification(title, body, title.toLowerCase().includes('sos') || title.toLowerCase().includes('risk') ? 'alert' : 'warning');
  try{
    if (window.Notification && Notification.permission !== 'granted') Notification.requestPermission();
    if (window.Notification && Notification.permission === 'granted') new Notification(title, {body});
    else alert(title + '\n' + body);
  }catch(e){ console.warn(e); }
}

// point-in-polygon for GeoJSON Polygon/MultiPolygon (ray-casting)
function pointInPolygon(point, geojson){
  // point: [lat, lon]
  const lat = point[0], lon = point[1];
  function pip(coords){
    let inside = false;
    for (let i=0,j=coords.length-1;i<coords.length;j=i++){
      const xi = coords[i][0], yi = coords[i][1]; // xi=lng, yi=lat
      const xj = coords[j][0], yj = coords[j][1];
      const intersect = ((yi>lat) !== (yj>lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi + 0.0) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  if (!geojson) return false;
  if (geojson.type === 'Polygon'){
    return pip(geojson.coordinates[0]);
  }
  if (geojson.type === 'MultiPolygon'){
    for (const poly of geojson.coordinates){ if (pip(poly[0])) return true; }
    return false;
  }
  return false;
}

let sosHoldTimer = null;
let sosStartedAt = 0;
const sosModal = document.getElementById('sosModal');
const sosConfirm = document.getElementById('sosConfirm');
const sosProgress = document.getElementById('sosHoldProgress');
function openSosModal(){
  if (!marker){ setStatus('Start tracking before sending an SOS'); return; }
  sosModal.hidden = false;
  sosConfirm.disabled = true;
  sosConfirm.textContent = 'Press and hold for 3 seconds';
  sosProgress.style.width = '0%';
}
function startSosHold(){
  sosStartedAt = Date.now();
  sosConfirm.disabled = true;
  clearInterval(sosHoldTimer);
  sosHoldTimer = setInterval(() => {
    const progress = Math.min(100, ((Date.now() - sosStartedAt) / 3000) * 100);
    sosProgress.style.width = `${progress}%`;
    if (progress >= 100){ clearInterval(sosHoldTimer); sosConfirm.disabled = false; sosConfirm.textContent = 'Release to send SOS'; }
  }, 50);
}
function stopSosHold(){ if (sosConfirm.disabled){ clearInterval(sosHoldTimer); sosProgress.style.width = '0%'; } }
document.getElementById('sosBtn').onclick = openSosModal;
sosConfirm.addEventListener('pointerdown', startSosHold);
sosConfirm.addEventListener('pointerup', stopSosHold);
sosConfirm.addEventListener('pointerleave', stopSosHold);
sosConfirm.addEventListener('pointercancel', stopSosHold);
sosConfirm.addEventListener('keydown', event => {
  if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); startSosHold(); }
});
sosConfirm.addEventListener('keyup', event => {
  if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); stopSosHold(); }
});
document.getElementById('sosCancel').onclick = () => { clearInterval(sosHoldTimer); sosModal.hidden = true; sosConfirm.textContent = 'Press and hold for 3 seconds'; };
sosConfirm.onclick = async () => {
  if (sosConfirm.disabled) return;
  let lat, lon;
  if (marker){ lat = marker.getLatLng().lat; lon = marker.getLatLng().lng; }
  else { sosModal.hidden = true; setStatus('Start tracking before sending an SOS'); return }
  const payload = { user_id: localStorage.getItem('tourist_user_id') ? Number(localStorage.getItem('tourist_user_id')) : null, lat, lon, description: 'SOS from tourist' };
  const headers = {'Content-Type':'application/json'}; const token = localStorage.getItem('tourist_token'); if (token) headers['Authorization']='Bearer '+token;
  const res = await fetch('/sos', {method:'POST', headers, body: JSON.stringify(payload)});
  if (!res.ok){ try{ const j = await res.json(); setStatus('SOS error: '+(j.detail||res.statusText)); }catch(e){ setStatus('SOS error: '+res.statusText); } return }
  const data = await res.json();
  sosModal.hidden = true;
  sosConfirm.textContent = 'Press and hold for 3 seconds';
  sosProgress.style.width = '0%';
  setStatus('SOS sent: incident '+data.incident_id);
  notify('SOS sent', 'Incident '+data.incident_id);
};
