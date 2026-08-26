const map = L.map('map', {zoomControl: false, scrollWheelZoom: true, keyboard: true}).setView([20.5937,78.9629], 5);

// Full light/dark console theme. Toggling the `theme-dark` body class re-themes
// every panel via CSS; here we keep the map basemap in sync — brightened-label
// dark tiles for the command-center look, clean Voyager tiles for light — and
// remember the choice in localStorage. Defaults to dark on first visit.
let adminBasemap = null;
function setAdminTheme(dark, persist = true){
    document.body.classList.toggle('theme-dark', dark);
    if (adminBasemap) map.removeLayer(adminBasemap);
    adminBasemap = dark ? TouriSafe.darkBasemap() : TouriSafe.basemap('voyager');
    adminBasemap.addTo(map);
    const button = document.getElementById('adminThemeToggle');
    if (button){
        button.innerHTML = '<i data-lucide="' + (dark ? 'sun' : 'moon') + '"></i>';
        button.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
        TouriSafe.icons();
    }
    if (persist) localStorage.setItem('admin_theme', dark ? 'dark' : 'light');
}
setAdminTheme(localStorage.getItem('admin_theme') !== 'light', false);
document.getElementById('adminThemeToggle')?.addEventListener('click', () => {
    setAdminTheme(!document.body.classList.contains('theme-dark'));
});

let fencesLayer = L.geoJSON().addTo(map);
let incidentsLayer = L.layerGroup().addTo(map);
let touristLocationsLayer = L.layerGroup().addTo(map);
const touristMarkers = new Map();
const defaultView = [20.5937, 78.9629];
let currentIncidents = [];
let incidentFilter = 'all';
let incidentSearch = '';
const touristLastSeen = new Map();

function showToast(message){
    const region = document.getElementById('toastRegion');
    if (!region) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Animate a metric number from its current value up/down to a new target.
// Skips the animation when the value is unchanged so frequent re-renders
// (search/filter keystrokes) don't stutter.
function countUp(el, target){
    if (!el) return;
    target = Number(target) || 0;
    const start = Number(el.dataset.value ?? el.textContent) || 0;
    el.dataset.value = target;
    if (start === target){ el.textContent = target; return; }
    const duration = 600, t0 = performance.now();
    function step(now){
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(start + (target - start) * eased);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target;
    }
    requestAnimationFrame(step);
}

function setupMapControls(){
    document.getElementById('adminZoomIn')?.addEventListener('click', () => map.zoomIn());
    document.getElementById('adminZoomOut')?.addEventListener('click', () => map.zoomOut());
    document.getElementById('adminResetView')?.addEventListener('click', () => map.setView(defaultView, 5));
    document.getElementById('adminFullscreen')?.addEventListener('click', () => document.querySelector('.map-wrap')?.requestFullscreen?.());
}
setupMapControls();

const incidentToggle = document.getElementById('incidentToggle');
const incidentPopup = document.getElementById('incidentPopup');
incidentToggle?.addEventListener('click', () => {
    incidentPopup.hidden = !incidentPopup.hidden;
    incidentToggle.setAttribute('aria-expanded', String(!incidentPopup.hidden));
    if (!incidentPopup.hidden) setAdminSidebarOpen(false);
});
document.addEventListener('click', (event) => {
    if (incidentPopup && !incidentPopup.hidden && !incidentPopup.contains(event.target) && !incidentToggle.contains(event.target)) {
        incidentPopup.hidden = true;
        incidentToggle.setAttribute('aria-expanded', 'false');
    }
});

document.getElementById('clearIncidents')?.addEventListener('click', async () => {
    if (!confirm('Clear all saved incidents? This cannot be undone.')) return;
    const token = localStorage.getItem('admin_token');
    if (!token) { document.getElementById('adminModal').style.display = 'flex'; return; }
    const response = await fetch('/admin/incidents', {method: 'DELETE', headers: {'Authorization': 'Bearer ' + token}});
    if (response.status === 401 || response.status === 403) { localStorage.removeItem('admin_token'); syncAdminLoginButton(); document.getElementById('adminModal').style.display = 'flex'; return; }
    if (!response.ok) { alert(`Could not clear incidents (${response.status})`); return; }
    Object.keys(localStorage).filter(key => key.startsWith('incident_triage_')).forEach(key => localStorage.removeItem(key));
    await loadIncidents();
    addAdminNotification('Incident queue cleared', 'All saved incidents were removed', 'warning');
});

const adminNotificationStore = JSON.parse(localStorage.getItem('admin_notifications') || '[]');
function addAdminNotification(title, body, tone='warning'){
    adminNotificationStore.unshift({title, body, tone, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})});
    adminNotificationStore.splice(12);
    localStorage.setItem('admin_notifications', JSON.stringify(adminNotificationStore));
    renderAdminNotifications();
}
function renderAdminNotifications(){
    const list = document.getElementById('adminNotificationList');
    const count = document.getElementById('adminNotificationCount');
    if (!list || !count) return;
    count.hidden = !adminNotificationStore.length;
    count.textContent = adminNotificationStore.length;
    list.innerHTML = adminNotificationStore.length ? adminNotificationStore.map(n => `<div class="notification-item ${n.tone}"><strong>${n.title}</strong><small>${n.body} · ${n.time}</small></div>`).join('') : '<div class="empty-state">No new activity</div>';
}
renderAdminNotifications();
document.getElementById('adminNotifications')?.addEventListener('click', () => { const drawer = document.getElementById('adminNotificationDrawer'); drawer.hidden = !drawer.hidden; });
document.getElementById('adminClearNotifications')?.addEventListener('click', () => { adminNotificationStore.splice(0); localStorage.setItem('admin_notifications', '[]'); renderAdminNotifications(); });
// WebSocket for realtime updates
try{
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(protocol + '://' + window.location.host + '/ws');
    ws.onmessage = (ev) => {
        try{
            const msg = JSON.parse(ev.data);
            if (msg.type === 'incident_created'){
                TouriSafe.incidentMarker([msg.lat, msg.lon]).bindPopup(msg.description || 'Incident').addTo(incidentsLayer);
                addAdminNotification('New SOS incident', msg.description || 'An incident was reported nearby', 'alert');
                loadIncidents();
            }
            if (msg.type === 'telemetry_anomaly'){
                TouriSafe.ping([msg.lat, msg.lon], 'warn').addTo(map);
                addAdminNotification('Telemetry anomaly', `User ${msg.user_id} reported unusual speed`, 'warning');
            }
            if (msg.type === 'telemetry_update'){
                const key = msg.user_id ?? 'anonymous';
                touristLastSeen.set(key, msg);
                let touristMarker = touristMarkers.get(key);
                if (!touristMarker){
                    touristMarker = TouriSafe.touristMarker([msg.lat, msg.lon]).addTo(touristLocationsLayer);
                    touristMarkers.set(key, touristMarker);
                } else {
                    touristMarker.setLatLng([msg.lat, msg.lon]);
                }
                touristMarker.bindPopup(`<strong>Tourist location</strong><br>User: ${msg.user_id ?? 'anonymous'}<br>Updated: ${new Date(msg.timestamp).toLocaleTimeString()}`);
                renderTouristQueue();
            }
            if (msg.type === 'fence_created'){
                addAdminNotification('New safety fence', `${msg.name} · ${msg.fence_type}`, 'warning');
            }
        }catch(e){console.error(e)}
    }
    ws.onopen = () => setConnectionStatus('Live');
    ws.onclose = () => setConnectionStatus('Offline');
}catch(e){console.warn('WebSocket failed', e); setConnectionStatus('Offline')}
// Add Leaflet.draw for drawing fences
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
const drawControl = new L.Control.Draw({ edit: { featureGroup: drawnItems, remove: false }, draw: { polygon: true, polyline: false, rectangle: true, circle: false, marker: false, circlemarker: false } });
map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;
    drawnItems.addLayer(layer);
    const geojson = layer.toGeoJSON();
    // store pending geojson and open fence modal
    window._pendingFence = geojson.geometry;
    document.getElementById('fence_name').value = '';
    document.getElementById('fence_type').value = 'restricted';
    document.getElementById('fenceModal').style.display = 'flex';
});

// fence modal handlers
document.getElementById('fenceCancel').onclick = () => { document.getElementById('fenceModal').style.display = 'none'; window._pendingFence = null; };
document.getElementById('fenceCreate').onclick = async () => {
    const name = document.getElementById('fence_name').value;
    const type = document.getElementById('fence_type').value;
    const token = localStorage.getItem('admin_token');
    if (!token) { alert('Please login as admin first'); return }
    const geojson = window._pendingFence;
    document.getElementById('fenceModal').style.display = 'none';
    const res = await fetch('/fences', {method:'POST', headers: {'Content-Type':'application/json', 'Authorization': 'Bearer '+token}, body: JSON.stringify({name, fence_type: type, geojson: geojson})});
    if (res.ok) { const d = await res.json(); alert('Fence created id='+d.id); loadFences(); }
    window._pendingFence = null;
};

map.on(L.Draw.Event.EDITED, function (event) {
    const layers = event.layers;
    layers.eachLayer(function(layer){
        const geojson = layer.toGeoJSON();
        window._pendingFence = geojson.geometry;
        document.getElementById('fence_name').value = '';
        document.getElementById('fence_type').value = 'restricted';
        document.getElementById('fenceModal').style.display = 'flex';
    });
});

// Admin login via header button + modal
const elAdminLogin = document.getElementById('adminLoginBtn');
function syncAdminLoginButton(){
    if (elAdminLogin) elAdminLogin.style.display = localStorage.getItem('admin_token') ? 'none' : '';
    const session = document.getElementById('adminSession');
    if (session) session.hidden = !localStorage.getItem('admin_token');
}
syncAdminLoginButton();
if (elAdminLogin) elAdminLogin.onclick = () => { document.getElementById('adminModal').style.display = 'flex'; };
const elAdminCancel = document.getElementById('adminCancel');
if (elAdminCancel) elAdminCancel.onclick = () => { document.getElementById('adminModal').style.display = 'none'; };
const elAdminSubmit = document.getElementById('adminSubmit');
if (elAdminSubmit) elAdminSubmit.onclick = async () => {
    const username = document.getElementById('admin_user').value;
    const password = document.getElementById('admin_pass').value;
    try{
        const body = new URLSearchParams(); body.append('username', username); body.append('password', password);
        const res = await fetch('/login', {method:'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: body.toString()});
        const text = await res.text();
        let data = null;
        try{ data = JSON.parse(text); } catch(e) { }
        if (!res.ok){ const msg = data && data.detail ? data.detail : text || res.statusText; alert('Login failed: '+msg); return }
        localStorage.setItem('admin_token', data.access_token);
        syncAdminLoginButton();
        document.getElementById('adminModal').style.display = 'none';
        alert('Admin login successful');
    }catch(e){ console.error(e); alert('Login error: '+e.message) }
};
document.getElementById('adminSessionBtn')?.addEventListener('click', () => {
    const menu = document.getElementById('adminSessionMenu');
    menu.hidden = !menu.hidden;
    document.getElementById('adminSessionBtn').setAttribute('aria-expanded', String(!menu.hidden));
});
document.getElementById('adminLogout')?.addEventListener('click', () => { localStorage.removeItem('admin_token'); syncAdminLoginButton(); document.getElementById('adminSessionMenu').hidden = true; });

function setConnectionStatus(value){
    const metric = document.getElementById('metricConnection');
    if (metric) metric.textContent = value;
}
function renderTouristQueue(){
    const list = document.getElementById('touristQueue');
    if (!list) return;
    countUp(document.getElementById('metricTourists'), touristLastSeen.size);
    document.getElementById('touristLastSeen').textContent = touristLastSeen.size ? 'Receiving updates' : 'Waiting for signal';
    list.innerHTML = touristLastSeen.size ? [...touristLastSeen.entries()].map(([key, item]) => `<div class="admin-queue-item" data-tourist-key="${key}"><strong>Tourist ${key}</strong><small>Last seen ${new Date(item.timestamp).toLocaleTimeString()} · ${item.speed ? `${Math.round(item.speed * 3.6)} km/h` : 'Stationary'}</small></div>`).join('') : '<div class="empty-state">No live locations yet</div>';
    list.querySelectorAll('[data-tourist-key]').forEach(item => item.onclick = () => { const tourist = touristLastSeen.get(item.dataset.touristKey); if (tourist) map.setView([tourist.lat, tourist.lon], 16); });
}
function renderIncidentQueue(){
    const list = document.getElementById('adminIncidentQueue');
    if (!list) return;
    const filtered = currentIncidents.filter(item => (incidentFilter === 'all' || item.status === incidentFilter) && (`${item.id} ${item.desc || ''}`).toLowerCase().includes(incidentSearch));
    list.innerHTML = filtered.length ? filtered.map(item => { const age = Math.max(0, Math.floor((Date.now() - new Date(item.ts).getTime()) / 60000)); return `<div class="admin-queue-item ${item.status === 'resolved' ? 'queue-resolved' : 'queue-alert'}" data-incident-id="${item.id}"><strong>Incident #${item.id}<span class="triage-badge ${item.status}">${item.status}</span></strong><small>${item.desc || 'SOS reported'} · ${new Date(item.ts).toLocaleTimeString()} <span class="response-time">${age}m old</span></small></div>`; }).join('') : '<div class="empty-state">No matching incidents</div>';
    list.querySelectorAll('[data-incident-id]').forEach(item => item.onclick = () => { const incident = currentIncidents.find(value => value.id === Number(item.dataset.incidentId)); if (incident) { showIncident(incident); map.setView([incident.lat, incident.lon], 16); } });
    countUp(document.getElementById('metricIncidents'), currentIncidents.filter(item => item.status !== 'resolved').length);
}
document.querySelectorAll('.filter-chip').forEach(button => button.addEventListener('click', () => { incidentFilter = button.dataset.filter; document.querySelectorAll('.filter-chip').forEach(item => item.classList.toggle('active', item === button)); renderIncidentQueue(); }));
document.getElementById('incidentSearch')?.addEventListener('input', event => { incidentSearch = event.target.value.trim().toLowerCase(); renderIncidentQueue(); });
const adminSidebar = document.querySelector('.admin-sidebar');
const adminOpenSidebar = document.getElementById('adminOpenSidebar');
function setAdminSidebarOpen(isOpen){
    adminSidebar?.classList.toggle('is-collapsed', !isOpen);
    adminOpenSidebar?.classList.toggle('is-visible', !isOpen);
    adminOpenSidebar?.setAttribute('aria-expanded', String(isOpen));
}
document.getElementById('adminSidebarToggle')?.addEventListener('click', () => setAdminSidebarOpen(false));
adminOpenSidebar?.addEventListener('click', () => { setAdminSidebarOpen(true); incidentPopup.hidden = true; incidentToggle.setAttribute('aria-expanded', 'false'); });
document.getElementById('adminFocusIncidents')?.addEventListener('click', () => { const incident = currentIncidents.find(item => item.status !== 'resolved'); if (incident) map.setView([incident.lat, incident.lon], 14); });
document.getElementById('adminRefresh')?.addEventListener('click', () => { loadFences(); loadIncidents(); });
document.getElementById('showIncidentLayer')?.addEventListener('change', event => event.target.checked ? map.addLayer(incidentsLayer) : map.removeLayer(incidentsLayer));
document.getElementById('showTouristLayer')?.addEventListener('change', event => event.target.checked ? map.addLayer(touristLocationsLayer) : map.removeLayer(touristLocationsLayer));
document.getElementById('showFenceLayer')?.addEventListener('change', event => event.target.checked ? map.addLayer(drawnItems) : map.removeLayer(drawnItems));
document.getElementById('adminShowAudit')?.addEventListener('click', async () => {
    const drawer = document.getElementById('auditDrawer');
    drawer.hidden = false;
    const token = localStorage.getItem('admin_token');
    if (!token) { document.getElementById('adminModal').style.display = 'flex'; return; }
    const response = await fetch('/admin/audit', {headers:{'Authorization':'Bearer ' + token}});
    const list = document.getElementById('auditList');
    if (!response.ok) { list.innerHTML = '<div class="empty-state">Sign in again to view the audit log.</div>'; return; }
    const data = await response.json();
    list.innerHTML = data.length ? data.map(item => `<div class="audit-item"><strong>${item.action} · ${item.entity_type} ${item.entity_id || ''}</strong><small>${new Date(item.created_at).toLocaleString()}</small></div>`).join('') : '<div class="empty-state">No recorded actions</div>';
});
document.getElementById('closeAudit')?.addEventListener('click', () => { document.getElementById('auditDrawer').hidden = true; });

// Admin register/reset UI removed — these actions are available via API/scripts

async function loadFences(){
    fencesLayer.clearLayers();
    drawnItems.clearLayers();
    const res = await fetch('/api/fences');
    const data = await res.json();
    countUp(document.getElementById('metricFences'), data.length);
    const clearFences = document.getElementById('clearFences');
    if (clearFences) clearFences.disabled = !data.length;
    const queue = document.getElementById('fenceQueue');
    if (queue) {
        queue.innerHTML = data.length ? data.map(f => `<div class="admin-queue-item"><strong>${f.name}<span class="triage-badge">${f.fence_type}</span></strong><small><button class="danger-text fence-delete" data-fence-id="${f.id}">Delete zone</button></small></div>`).join('') : '<div class="empty-state">No safety zones</div>';
        queue.querySelectorAll('.fence-delete').forEach(button => button.addEventListener('click', async event => {
            event.stopPropagation();
            if (!confirm('Delete this safety zone? This cannot be undone.')) return;
            await deleteFence(button.dataset.fenceId);
        }));
    }
    data.forEach(f => {
        const g = TouriSafe.decorateZone(L.geoJSON(f.geojson, {style: TouriSafe.zoneStyle(f.fence_type)}), {name: f.name, type: f.fence_type}).addTo(drawnItems);
        g.eachLayer(layer => { if (layer.feature) layer.feature.properties = layer.feature.properties || {}; layer.feature.properties.db_id = f.id; });
    });
}

async function deleteFence(fenceId){
    const token = localStorage.getItem('admin_token');
    if (!token) { document.getElementById('adminModal').style.display = 'flex'; return; }
    const response = await fetch(`/admin/fences/${fenceId}`, {method: 'DELETE', headers: {'Authorization': 'Bearer ' + token}});
    if (response.status === 401 || response.status === 403) { handleAdminAuthFailure(); return; }
    if (!response.ok) { alert(`Could not delete safety zone (${response.status})`); return; }
    addAdminNotification('Safety zone deleted', 'The zone was removed from the map', 'warning');
    await loadFences();
}

function handleAdminAuthFailure(){
    localStorage.removeItem('admin_token');
    syncAdminLoginButton();
    document.getElementById('adminModal').style.display = 'flex';
    alert('Your admin session has expired. Please log in again.');
}

document.getElementById('clearFences')?.addEventListener('click', async () => {
    if (!confirm('Clear all safety zones? This cannot be undone.')) return;
    const token = localStorage.getItem('admin_token');
    if (!token) { document.getElementById('adminModal').style.display = 'flex'; return; }
    const response = await fetch('/admin/fences', {method: 'DELETE', headers: {'Authorization': 'Bearer ' + token}});
    if (response.status === 401 || response.status === 403) { handleAdminAuthFailure(); return; }
    if (!response.ok) { alert(`Could not clear safety zones (${response.status})`); return; }
    const result = await response.json();
    await loadFences();
    addAdminNotification('Safety zones cleared', `${result.deleted} zone${result.deleted === 1 ? '' : 's'} removed from the map`, 'warning');
});

async function loadIncidents(){
    incidentsLayer.clearLayers();
    const res = await fetch('/api/incidents');
    const data = await res.json();
    currentIncidents = data;
    data.forEach(i => {
        const m = TouriSafe.incidentMarker([i.lat, i.lon]).addTo(incidentsLayer);
        m.bindPopup((i.desc || 'Incident') + `<br/><a href="#" class="view-incident" data-id="${i.id}">View details</a>`);
    });
    // populate sidebar incident list
    const list = document.getElementById('incidentList');
    document.getElementById('incidentCount').textContent = data.length;
    renderIncidentQueue();
    if (!data.length) { list.innerHTML = '<div class="empty-state">No active incidents</div>'; return }
    list.innerHTML = '';
    data.forEach(i => {
        const el = document.createElement('div'); el.className = 'list-item';
        const triage = i.status || 'open';
        el.innerHTML = `<div class="incident-title">Incident #${i.id}<span class="triage-badge ${triage}">${triage}</span></div><div class="incident-meta">${i.desc || ''} · ${i.ts}</div>`;
        el.style.cursor = 'pointer';
        el.onclick = () => { showIncident(i); };
        list.appendChild(el);
    });
}

function showIncident(i){
    const container = document.getElementById('incidentDetails');
    container.innerHTML = '';
    const rows = [['ID', i.id], ['Description', i.desc || ''], ['Status', i.status || ''], ['Timestamp', i.ts || ''], ['Latitude', i.lat], ['Longitude', i.lon]];
    const table = document.createElement('div');
    table.style.display = 'grid';
    table.style.gridTemplateColumns = '120px 1fr';
    table.style.rowGap = '8px';
    rows.forEach(r => {
        const k = document.createElement('div'); k.style.fontWeight = '600'; k.style.color = 'var(--ink)'; k.textContent = r[0];
        const v = document.createElement('div'); v.style.color = 'var(--muted)'; v.textContent = r[1];
        table.appendChild(k); table.appendChild(v);
    });
    container.appendChild(table);
    const triage = document.createElement('label');
    triage.className = 'triage-control';
    triage.innerHTML = '<span>Operator triage</span><select><option>New</option><option>Acknowledged</option><option>Resolved</option></select>';
    const select = triage.querySelector('select');
    select.value = i.status === 'open' ? 'New' : i.status.charAt(0).toUpperCase() + i.status.slice(1);
    select.onchange = async () => {
        const token = localStorage.getItem('admin_token');
        if (!token) { alert('Please login as admin first'); return; }
        const status = select.value.toLowerCase();
        const response = await fetch(`/admin/incidents/${i.id}`, {method:'PATCH', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + token}, body:JSON.stringify({status})});
        if (!response.ok) { alert('Could not update incident'); return; }
        await loadIncidents();
    };
    container.appendChild(triage);
    const responseActions = document.createElement('div');
    responseActions.className = 'response-actions';
    responseActions.innerHTML = '<button class="ghost" data-response="acknowledged">Acknowledge</button><button class="primary" data-response="resolved">Resolve</button><a class="ghost response-link" target="_blank" rel="noopener">Open route</a>';
    responseActions.querySelector('.response-link').href = `https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lon}`;
    responseActions.querySelectorAll('[data-response]').forEach(button => button.onclick = async () => {
        const token = localStorage.getItem('admin_token');
        if (!token) { document.getElementById('adminModal').style.display = 'flex'; return; }
        const response = await fetch(`/admin/incidents/${i.id}`, {method:'PATCH', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + token}, body:JSON.stringify({status:button.dataset.response})});
        if (!response.ok) { showToast('Could not update incident'); return; }
        showToast(`Incident #${i.id} marked ${button.dataset.response}`);
        document.getElementById('incidentModal').style.display = 'none';
        await loadIncidents();
    });
    container.appendChild(responseActions);
    document.getElementById('incidentModal').style.display = 'flex';
}

document.getElementById('incidentClose')?.addEventListener('click', ()=>{ document.getElementById('incidentModal').style.display = 'none'; });

// delegate click events from popups (they are in map panes)
document.addEventListener('click', function(ev){
    const a = ev.target.closest && ev.target.closest('.view-incident');
    if (a){ ev.preventDefault(); const id = Number(a.dataset.id); fetch('/api/incidents').then(r=>r.json()).then(data=>{ const inc = data.find(x=>x.id===id); if (inc) showIncident(inc); }); }
});

const elRefresh = document.getElementById('refresh');
if (elRefresh) elRefresh.addEventListener('click', () => { loadFences(); loadIncidents(); });
const elSosDemo = document.getElementById('sos');
if (elSosDemo) elSosDemo.addEventListener('click', async () => {
        const c = map.getCenter();
        try{
            const res = await fetch('/sos', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({user_id: null, lat: c.lat, lon: c.lng, description: 'Demo SOS from admin'})});
            if (!res.ok) { alert('SOS failed'); return }
            await loadIncidents();
        }catch(e){ console.error(e); alert('SOS error') }
});

loadFences().then(() => TouriSafe.fadeInZones(map)); loadIncidents();
