const map = L.map('map', {zoomControl: false, scrollWheelZoom: true, keyboard: true}).setView([20.5937,78.9629], 5);
const lightTiles = TouriSafe.basemap('voyager').addTo(map);
const darkTiles = TouriSafe.darkBasemap();
function setBasemap(dark){
  if (dark){ if (map.hasLayer(lightTiles)) map.removeLayer(lightTiles); darkTiles.addTo(map); }
  else { if (map.hasLayer(darkTiles)) map.removeLayer(darkTiles); lightTiles.addTo(map); }
}

let marker = null;
let accuracyCircle = null;
let watchId = null;
let telemetryInterval = null;
let hasCenteredOnUser = false; // recenter the map on the first GPS fix only
let lastTelemetryAt = 0;       // throttle telemetry uploads (see startTelemetry)
let fencesLayer = L.geoJSON().addTo(map);
const defaultView = [20.5937, 78.9629];

function setupMapControls(){
  document.getElementById('touristZoomIn')?.addEventListener('click', () => map.zoomIn());
  document.getElementById('touristZoomOut')?.addEventListener('click', () => map.zoomOut());
  document.getElementById('touristResetView')?.addEventListener('click', () => map.setView(defaultView, 5));
  document.getElementById('touristFullscreen')?.addEventListener('click', () => document.querySelector('.map-wrap')?.requestFullscreen?.());
  document.getElementById('touristLocate')?.addEventListener('click', () => {
    if (marker) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15));
    else setStatus('status.startToLocate');
  });
}
setupMapControls();

const body = document.body;
const contacts = JSON.parse(localStorage.getItem('tourist_contacts') || '[]');
const settings = JSON.parse(localStorage.getItem('tourist_settings') || '{}');
const tripState = JSON.parse(localStorage.getItem('tourist_trip') || '{"active":false,"startedAt":null}');

// ---------------------------------------------------------------- i18n
// Language is stored as a stable code ('en'/'hi'/'es'). Older builds saved the
// display label ("English"), so those are mapped forward for back-compat.
const LEGACY_LANGS = {English: 'en', Hindi: 'hi', Spanish: 'es'};
const i18n = (window.TouriSafe && TouriSafe.i18n) || {t: k => k, apply: () => {}, setLang: () => {}, getLang: () => 'en'};
const t = (key, params) => i18n.t(key, params);
function currentLang(){
  const raw = settings.language || 'en';
  return LEGACY_LANGS[raw] || raw;
}
i18n.setLang(currentLang());

// Safety state is tracked as a STABLE TOKEN, never as displayed text, so
// translating a string can never change how the app classifies risk.
const SAFETY_LABEL_KEYS = {safe: 'safety.safe', caution: 'safety.caution', restricted: 'safety.restricted', 'high-risk': 'safety.highRisk'};
let safetyState = {token: 'safe', detail: null, detailKey: 'safety.noAlerts'};

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
// Drive the circular risk gauge on the dashboard card from the current
// safety state. Colour + arc length reflect how exposed the tourist is.
// `state` is a STABLE TOKEN ('safe' | 'caution' | 'restricted' | 'high-risk'),
// never displayed text — so it classifies identically in every language.
function setSafetyGauge(state){
  const arc = document.getElementById('touristGaugeArc');
  const card = document.getElementById('touristDashboardCard');
  if (!arc || !card) return;
  const C = 2 * Math.PI * 30; // ring radius = 30
  const s = String(state || '').toLowerCase();
  let frac = 1, tone = 'safe';
  if (s.includes('restrict')) { frac = 0.16; tone = 'danger'; }
  else if (s.includes('high') || s.includes('risk') || s.includes('caution')) { frac = 0.5; tone = 'warn'; }
  arc.style.strokeDasharray = C;
  arc.style.strokeDashoffset = C * (1 - frac);
  card.dataset.tone = tone;
}
// Single place that turns the stable safety token into visible text, so a
// language switch can re-render it without re-deriving the state.
function renderSafetyState(){
  const score = document.getElementById('touristSafetyScore');
  const detail = document.getElementById('touristSafetyDetail');
  if (score) score.textContent = t(SAFETY_LABEL_KEYS[safetyState.token] || 'safety.safe');
  if (detail) detail.textContent = safetyState.detail != null ? safetyState.detail : t(safetyState.detailKey || 'safety.noAlerts');
  setSafetyGauge(safetyState.token);
}
function setSafetyState(token, detailText, detailKey){
  safetyState = {token: token || 'safe', detail: detailText != null ? detailText : null, detailKey: detailKey || 'safety.noAlerts'};
  renderSafetyState();
}
function updateTripUI(){
  const button = document.getElementById('tripCheckIn');
  if (!button) return;
  button.textContent = tripState.active ? t('trip.end') : t('trip.start');
  document.getElementById('tripShare').textContent = tripState.active ? t('trip.copyLink') : t('trip.share');
}
updateTripUI();
document.getElementById('dismissTouristAlert')?.addEventListener('click', () => { document.getElementById('touristAlertBanner').hidden = true; });
document.getElementById('tripCheckIn')?.addEventListener('click', () => { tripState.active = !tripState.active; tripState.startedAt = tripState.active ? new Date().toISOString() : null; localStorage.setItem('tourist_trip', JSON.stringify(tripState)); updateTripUI(); setTouristAlert(tripState.active ? t('trip.activeTitle') : t('trip.endedTitle'), tripState.active ? t('trip.activeBody') : t('trip.endedBody'), 'notice'); });
document.getElementById('tripShare')?.addEventListener('click', async () => { const text = t('trip.statusText', {state: tripState.active ? t('trip.stateActive') : t('trip.stateInactive')}); if (navigator.share) await navigator.share({title: t('trip.shareTitle'), text}); else { await navigator.clipboard?.writeText(text); setTouristAlert(t('trip.copiedTitle'), t('trip.copiedBody'), 'notice'); } });
function applySettings(){
  body.classList.toggle('large-text', Boolean(settings.largeText));
  document.getElementById('largeTextToggle').checked = Boolean(settings.largeText);
  document.getElementById('darkMapToggle').checked = Boolean(settings.darkMap);
  document.getElementById('languageSelect').value = currentLang();
  document.getElementById('map').classList.toggle('map-dark', Boolean(settings.darkMap));
  setBasemap(Boolean(settings.darkMap));
}
function updateContactSummary(){
  const summary = document.getElementById('contactSummary');
  if (summary) summary.textContent = contacts.length ? t(contacts.length === 1 ? 'contacts.savedOne' : 'contacts.savedMany', {n: contacts.length}) : t('contacts.none');
}
function renderContacts(){
  const list = document.getElementById('contactsList');
  if (!list) return;
  list.innerHTML = contacts.length ? contacts.map((contact, index) => `<div class="contact-card"><span><strong>${contact.name}</strong><small>${contact.phone}</small></span><a href="tel:${encodeURIComponent(contact.phone)}" aria-label="${t('aria.call', {name: contact.name})}">&#9742;</a><button class="contact-remove" data-contact-index="${index}" aria-label="${t('aria.remove', {name: contact.name})}">&times;</button></div>`).join('') : `<div class="empty-state">${t('contacts.empty')}</div>`;
  list.querySelectorAll('.contact-remove').forEach(button => button.addEventListener('click', () => { contacts.splice(Number(button.dataset.contactIndex), 1); localStorage.setItem('tourist_contacts', JSON.stringify(contacts)); renderContacts(); updateContactSummary(); }));
}
i18n.apply(document);
applySettings();
updateContactSummary();
renderSafetyState();
document.getElementById('touristSettings')?.addEventListener('click', () => { const drawer = document.getElementById('touristUtilityDrawer'); drawer.hidden = !drawer.hidden; });
document.getElementById('closeUtility')?.addEventListener('click', () => { document.getElementById('touristUtilityDrawer').hidden = true; });
document.getElementById('touristLegend')?.addEventListener('click', () => { document.getElementById('touristLegendPanel').hidden = false; });
document.getElementById('closeLegend')?.addEventListener('click', () => { document.getElementById('touristLegendPanel').hidden = true; });
document.getElementById('largeTextToggle')?.addEventListener('change', event => { settings.largeText = event.target.checked; localStorage.setItem('tourist_settings', JSON.stringify(settings)); applySettings(); });
document.getElementById('darkMapToggle')?.addEventListener('change', event => { settings.darkMap = event.target.checked; localStorage.setItem('tourist_settings', JSON.stringify(settings)); applySettings(); });
document.getElementById('languageSelect')?.addEventListener('change', event => {
  settings.language = event.target.value;
  localStorage.setItem('tourist_settings', JSON.stringify(settings));
  applyLanguage();
});
// Re-render everything that is drawn from JS. Static markup is handled by
// i18n.apply(); anything built dynamically has to be rebuilt by hand.
function applyLanguage(){
  i18n.setLang(currentLang());
  i18n.apply(document);
  applySettings();
  updateTripUI();
  updateContactSummary();
  renderContacts();
  renderSafetyState();
  renderTouristNotifications();
  refreshStatusMetrics();
  renderStatus();
  // The auth modal title is mode-dependent, so restore it after apply().
  const authTitle = document.getElementById('authTitle');
  if (authTitle) authTitle.textContent = t(document.getElementById('authModal')?.dataset.mode === 'register' ? 'auth.register' : 'auth.login');
  if (!sosModal?.hidden && sosConfirm) sosConfirm.textContent = sosConfirm.disabled ? t('sos.hold') : t('sos.release');
}
document.getElementById('nearbyHelp')?.addEventListener('click', () => {
  const query = marker ? `${marker.getLatLng().lat},${marker.getLatLng().lng}` : 'hospitals police pharmacies near me';
  window.open(`https://www.google.com/maps/search/${encodeURIComponent(`hospitals police pharmacies near ${query}`)}`, '_blank', 'noopener');
});
document.getElementById('trustedContacts')?.addEventListener('click', () => { renderContacts(); document.getElementById('contactsModal').hidden = false; });
document.getElementById('contactsClose')?.addEventListener('click', () => { document.getElementById('contactsModal').hidden = true; });
document.getElementById('contactAdd')?.addEventListener('click', () => { const name = document.getElementById('contactName').value.trim(); const phone = document.getElementById('contactPhone').value.trim(); if (!name || !phone) return; contacts.push({name, phone}); localStorage.setItem('tourist_contacts', JSON.stringify(contacts)); document.getElementById('contactName').value = ''; document.getElementById('contactPhone').value = ''; renderContacts(); updateContactSummary(); });
// The status-metrics chip shows either connectivity or GPS accuracy. Keep the
// live value as data (accuracy in metres, or null) so it can be re-rendered in
// another language without waiting for the next GPS tick.
let lastAccuracy = null;
function refreshStatusMetrics(){
  const el = document.getElementById('statusMetrics');
  if (!el) return;
  if (lastAccuracy != null) el.textContent = t('metrics.accuracy', {m: Math.round(lastAccuracy)});
  else el.textContent = navigator.onLine ? t('status.online') : t('status.offline');
}
window.addEventListener('online', () => { body.classList.remove('offline'); refreshStatusMetrics(); });
window.addEventListener('offline', () => { body.classList.add('offline'); lastAccuracy = null; refreshStatusMetrics(); setStatus('status.connLost'); });
if (!navigator.onLine) body.classList.add('offline');
refreshStatusMetrics();

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
  list.innerHTML = touristNotificationStore.length ? touristNotificationStore.map(n => `<div class="notification-item ${n.tone}"><strong>${n.title}</strong><small>${n.body} · ${n.time}</small></div>`).join('') : `<div class="empty-state">${t('notif.empty')}</div>`;
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

// Personal alerts are broadcast to every connected client, so each client has
// to decide whether an event is about *them*. Without this gate one tourist
// entering a restricted zone lit up every other tourist's phone.
function myUserId(){
  const raw = localStorage.getItem('tourist_user_id');
  return raw ? String(raw) : null;
}
function isMine(msg){
  const mine = myUserId();
  // No identity (anonymous session) → suppress personal banners rather than
  // raise a false alarm about somebody else.
  return Boolean(mine) && msg.user_id != null && String(msg.user_id) === mine;
}
// Fence types are stable tokens from the backend; map them to display keys.
function fenceLabelKey(fenceType){
  return fenceType === 'restricted' ? 'alert.restrictedArea' : 'alert.highRiskArea';
}
function fenceStateToken(fenceType){
  return fenceType === 'restricted' ? 'restricted' : 'high-risk';
}

// WebSocket for realtime alerts (incidents, fence alerts, telemetry anomalies)
try{
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(protocol + '://' + window.location.host + '/ws');
  ws.onmessage = (ev) => {
    try{
      const msg = JSON.parse(ev.data);
      if (msg.type === 'incident_created'){
        TouriSafe.incidentMarker([msg.lat, msg.lon]).bindPopup(msg.description || t('alert.incidentTitle')).addTo(map);
        notify(t('alert.incidentTitle'), msg.description || t('alert.incidentBodyDefault'), 'warning');
        setStatus('status.incidentReported');
      }
      if (msg.type === 'telemetry_anomaly' && isMine(msg)){
        TouriSafe.ping([msg.lat, msg.lon], 'warn').addTo(map);
        notify(t('alert.anomalyTitle'), t('alert.anomalyBody', {user: msg.user_id, speed: msg.speed}), 'warning');
      }
      if (msg.type === 'fence_created'){
        // add to fences layer
        const g = TouriSafe.decorateZone(L.geoJSON(msg.geojson, {style: TouriSafe.zoneStyle(msg.fence_type)}), {name: msg.name, type: msg.fence_type}).addTo(fencesLayer);
        // if current user location exists and inside, notify immediately
        if (marker && (msg.fence_type === 'restricted' || msg.fence_type === 'high-risk')){
          const p = [marker.getLatLng().lat, marker.getLatLng().lng];
          if (pointInPolygon(p, msg.geojson)){
            const zone = t(fenceLabelKey(msg.fence_type));
            notify(zone, t('alert.insideArea', {zone, name: msg.name}), 'alert');
            setStatus('status.enteredArea', {zone, name: msg.name});
          }
        }
      }
      if (msg.type === 'fence_deleted' || msg.type === 'fences_deleted'){
        loadFences();
      }
      if (msg.type === 'fence_alert' && isMine(msg)){
        // server detected THIS user inside a restricted or high-risk fence
        const zone = t(fenceLabelKey(msg.fence_type));
        notify(zone, t('alert.enteredFence', {fence: msg.fence}), 'alert');
        setStatus('status.zoneFence', {zone, fence: msg.fence});
        setSafetyState(fenceStateToken(msg.fence_type), msg.fence);
        setTouristAlert(zone, t('alert.youEnteredFence', {fence: msg.fence}), 'alert');
        TouriSafe.ping([msg.lat, msg.lon], 'alert').addTo(map);
      }
    }catch(e){ console.error(e) }
  }
}catch(e){console.warn('WebSocket failed', e)}

async function loadFences(){
  fencesLayer.clearLayers();
  const res = await fetch('/api/fences');
  const data = await res.json();
  data.forEach(f => {
    TouriSafe.decorateZone(L.geoJSON(f.geojson, {style: TouriSafe.zoneStyle(f.fence_type)}), {name: f.name, type: f.fence_type}).addTo(fencesLayer);
  });
}
loadFences().then(() => TouriSafe.fadeInZones(map));

// setStatus takes an i18n KEY (plus interpolation params), not a finished
// sentence, and remembers the last one so a language switch can re-render it.
// The pre-tracking state keeps its own subtitle; every later status stamps the
// time instead, exactly as before.
let lastStatus = {key: 'status.readyTitle', params: null, initial: true};
function renderStatus(){
  const status = document.getElementById('status');
  if (!status) return;
  const text = t(lastStatus.key, lastStatus.params);
  const title = status.querySelector('strong'); const detail = status.querySelector('small');
  if (title && detail){
    title.textContent = text;
    detail.textContent = lastStatus.initial ? t('status.readyDetail') : new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }
  else status.textContent = text;
}
function setStatus(key, params){
  lastStatus = {key, params: params || null, initial: false};
  renderStatus();
}

const authModal = document.getElementById('authModal');
const authSubmit = document.getElementById('authSubmit');
const authCancel = document.getElementById('authCancel');

document.getElementById('registerBtn').addEventListener('click', () => {
  authModal.dataset.mode = 'register';
  document.getElementById('authTitle').textContent = t('auth.register');
  document.getElementById('auth_user').value = '';
  document.getElementById('auth_email').value = '';
  document.getElementById('auth_pass').value = '';
  authModal.style.display = 'flex';
});

document.getElementById('loginBtn').addEventListener('click', () => {
  authModal.dataset.mode = 'login';
  document.getElementById('authTitle').textContent = t('auth.login');
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
    // Credentials go in a JSON body — they used to travel in the query string,
    // where they end up in server logs and browser history.
    const res = await fetch('/register', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username, email, password})});
    if (!res.ok) { setStatus('status.regFailed'); return }
    const data = await res.json();
    setStatus('status.registered', {id: data.id});
    localStorage.setItem('tourist_user_id', data.id);
    syncTouristSession();
    authModal.style.display = 'none';
  } else if (mode === 'login'){
    try{
      const body = new URLSearchParams(); body.append('username', username); body.append('password', password);
      const res = await fetch('/login', {method:'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString()});
      const txt = await res.text(); let data=null; try{ data = JSON.parse(txt);}catch(e){}
      if (!res.ok){ setStatus('status.loginFailed', {detail: (data && data.detail) ? data.detail : txt}); return }
      setStatus('status.loggedIn');
      localStorage.setItem('tourist_token', data.access_token);
      // Store the id too: telemetry and SOS were being sent anonymously after a
      // plain login, which also broke per-user alert routing.
      if (data.user_id != null) localStorage.setItem('tourist_user_id', data.user_id);
      syncTouristSession();
      authModal.style.display = 'none';
    }catch(e){ setStatus('status.loginError', {msg: e.message}) }
  }
});

// ------------------------------------------------------- Google Sign-In
// Entirely opt-in: /api/config returns an empty client id unless
// TOURISAFE_GOOGLE_CLIENT_ID is set, and then nothing is injected and the
// username/password form is exactly what it was.
async function onGoogleCredential(response){
  try{
    const res = await fetch('/auth/google', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({credential: response.credential})});
    const data = await res.json().catch(() => null);
    if (!res.ok){ setStatus('status.loginFailed', {detail: (data && data.detail) ? data.detail : res.statusText}); return }
    localStorage.setItem('tourist_token', data.access_token);
    if (data.user_id != null) localStorage.setItem('tourist_user_id', data.user_id);
    setStatus('status.loggedIn');
    syncTouristSession();
    authModal.style.display = 'none';
  }catch(e){ setStatus('status.loginError', {msg: e.message}) }
}

(async function initGoogleSignIn(){
  const wrap = document.getElementById('authGoogleWrap');
  const slot = document.getElementById('googleSignInButton');
  if (!wrap || !slot) return;
  let clientId = '';
  try{
    const res = await fetch('/api/config');
    if (!res.ok) return;
    clientId = (await res.json()).google_client_id || '';
  }catch(e){ return }
  if (!clientId) return; // unconfigured → leave the modal untouched
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true; script.defer = true;
    script.onload = resolve; script.onerror = reject;
    document.head.appendChild(script);
  }).catch(() => null);
  if (!(window.google && google.accounts && google.accounts.id)) return;
  google.accounts.id.initialize({client_id: clientId, callback: onGoogleCredential});
  google.accounts.id.renderButton(slot, {theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 260});
  wrap.hidden = false;
})();

async function sendTelemetry(lat, lon){
  const payload = { user_id: localStorage.getItem('tourist_user_id') ? Number(localStorage.getItem('tourist_user_id')) : null, lat, lon };
  const headers = {'Content-Type':'application/json'};
  const token = localStorage.getItem('tourist_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch('/telemetry', {method:'POST', headers, body: JSON.stringify(payload)});
  if (!res.ok){
    try{ const j = await res.json(); setStatus('status.telemetryError', {detail: j.detail || res.statusText}); } catch(e){ setStatus('status.telemetryError', {detail: res.statusText}); }
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
document.getElementById('touristLogout')?.addEventListener('click', () => { localStorage.removeItem('tourist_token'); localStorage.removeItem('tourist_user_id'); syncTouristSession(); document.getElementById('touristSessionMenu').hidden = true; setStatus('status.signedOut'); });

document.getElementById('startTelemetry').onclick = async () => {
  if (navigator.geolocation){
    setStatus('status.requesting');
    watchId = navigator.geolocation.watchPosition(async (pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      if (marker) marker.setLatLng([lat,lon]); else marker = TouriSafe.selfMarker([lat,lon]).addTo(map);
      if (accuracyCircle) accuracyCircle.setLatLng([lat, lon]).setRadius(pos.coords.accuracy || 0);
      else accuracyCircle = TouriSafe.accuracyCircle([lat, lon], pos.coords.accuracy || 0).addTo(map);
      // Recenter on the FIRST fix only. Re-centering on every GPS tick fought
      // the user's own panning and forced a full tile reload each time (jank).
      if (!hasCenteredOnUser){ map.setView([lat,lon], 15); hasCenteredOnUser = true; }
      body.classList.add('tracking-active');
      lastAccuracy = pos.coords.accuracy || 0;
      refreshStatusMetrics();
      setStatus('status.sharing');
      // Throttle uploads: watchPosition can fire several times a second under
      // enableHighAccuracy — one POST per ~3s is ample for live tracking and
      // keeps the network/backend from being hammered (a real latency source).
      const now = Date.now();
      if (now - lastTelemetryAt >= 3000){ lastTelemetryAt = now; sendTelemetry(lat, lon); }
    }, err => { body.classList.remove('tracking-active'); setStatus(err.code === 1 ? 'status.permNeeded' : 'status.unavailable'); }, {enableHighAccuracy:true, maximumAge:2000});
  } else {
    setStatus('status.geoUnavailable');
  }
  document.getElementById('startTelemetry').disabled = true;
  document.getElementById('stopTelemetry').disabled = false;
}

document.getElementById('stopTelemetry').onclick = () => {
  if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  hasCenteredOnUser = false; // recenter again next time tracking starts
  setStatus('status.stopped');
  body.classList.remove('tracking-active');
  lastAccuracy = null;
  refreshStatusMetrics();
  document.getElementById('startTelemetry').disabled = false;
  document.getElementById('stopTelemetry').disabled = true;
}

// small helper: browser notification (asks permission on first use).
// `tone` is passed explicitly — it used to be sniffed out of the English title,
// which silently mis-classified every translated alert.
function notify(title, body, tone='warning'){
  addTouristNotification(title, body, tone);
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
  if (!marker){ setStatus('status.startBeforeSos'); return; }
  sosModal.hidden = false;
  sosConfirm.disabled = true;
  sosConfirm.textContent = t('sos.hold');
  sosProgress.style.width = '0%';
}
function startSosHold(){
  sosStartedAt = Date.now();
  sosConfirm.disabled = true;
  clearInterval(sosHoldTimer);
  sosHoldTimer = setInterval(() => {
    const progress = Math.min(100, ((Date.now() - sosStartedAt) / 3000) * 100);
    sosProgress.style.width = `${progress}%`;
    if (progress >= 100){ clearInterval(sosHoldTimer); sosConfirm.disabled = false; sosConfirm.textContent = t('sos.release'); }
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
document.getElementById('sosCancel').onclick = () => { clearInterval(sosHoldTimer); sosModal.hidden = true; sosConfirm.textContent = t('sos.hold'); };
sosConfirm.onclick = async () => {
  if (sosConfirm.disabled) return;
  let lat, lon;
  if (marker){ lat = marker.getLatLng().lat; lon = marker.getLatLng().lng; }
  else { sosModal.hidden = true; setStatus('status.startBeforeSos'); return }
  const payload = { user_id: localStorage.getItem('tourist_user_id') ? Number(localStorage.getItem('tourist_user_id')) : null, lat, lon, description: 'SOS from tourist' };
  const headers = {'Content-Type':'application/json'}; const token = localStorage.getItem('tourist_token'); if (token) headers['Authorization']='Bearer '+token;
  const res = await fetch('/sos', {method:'POST', headers, body: JSON.stringify(payload)});
  if (!res.ok){ try{ const j = await res.json(); setStatus('status.sosError', {detail: j.detail || res.statusText}); }catch(e){ setStatus('status.sosError', {detail: res.statusText}); } return }
  const data = await res.json();
  sosModal.hidden = true;
  sosConfirm.textContent = t('sos.hold');
  sosProgress.style.width = '0%';
  setStatus('status.sosSent', {id: data.incident_id});
  notify(t('sos.sentTitle'), t('sos.sentBody', {id: data.incident_id}), 'alert');
};

// First-visit onboarding: a one-time welcome that explains zone alerts + SOS.
(function initOnboarding(){
  const overlay = document.getElementById('touristOnboarding');
  if (!overlay) return;
  if (!localStorage.getItem('ts_onboarded')) overlay.hidden = false;
  document.getElementById('onboardingDone')?.addEventListener('click', () => {
    overlay.hidden = true;
    localStorage.setItem('ts_onboarded', '1');
  });
})();

// Render the JS-owned status panel once everything is declared, so a page
// loaded in Hindi/Spanish doesn't start out in English.
renderStatus();
