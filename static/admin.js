const map = L.map('map', {zoomControl: false, scrollWheelZoom: true, keyboard: true}).setView([20.5937,78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

let fencesLayer = L.geoJSON().addTo(map);
let incidentsLayer = L.layerGroup().addTo(map);
let touristLocationsLayer = L.layerGroup().addTo(map);
const touristMarkers = new Map();
const defaultView = [20.5937, 78.9629];

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
    if (!token) { alert('Please login as admin first'); return; }
    const response = await fetch('/admin/incidents', {method: 'DELETE', headers: {'Authorization': 'Bearer ' + token}});
    if (!response.ok) { alert('Could not clear incidents'); return; }
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
                L.marker([msg.lat, msg.lon]).bindPopup(msg.description || 'Incident').addTo(incidentsLayer);
                addAdminNotification('New SOS incident', msg.description || 'An incident was reported nearby', 'alert');
                loadIncidents();
            }
            if (msg.type === 'telemetry_anomaly'){
                L.circle([msg.lat, msg.lon], {radius:50, color:'orange'}).addTo(map);
                addAdminNotification('Telemetry anomaly', `User ${msg.user_id} reported unusual speed`, 'warning');
            }
            if (msg.type === 'telemetry_update'){
                const key = msg.user_id ?? 'anonymous';
                let touristMarker = touristMarkers.get(key);
                if (!touristMarker){
                    touristMarker = L.marker([msg.lat, msg.lon]).addTo(touristLocationsLayer);
                    touristMarkers.set(key, touristMarker);
                } else {
                    touristMarker.setLatLng([msg.lat, msg.lon]);
                }
                touristMarker.bindPopup(`<strong>Tourist location</strong><br>User: ${msg.user_id ?? 'anonymous'}<br>Updated: ${new Date(msg.timestamp).toLocaleTimeString()}`);
            }
            if (msg.type === 'fence_created'){
                addAdminNotification('New safety fence', `${msg.name} · ${msg.fence_type}`, 'warning');
            }
        }catch(e){console.error(e)}
    }
}catch(e){console.warn('WebSocket failed', e)}
// Add Leaflet.draw for drawing fences
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
const drawControl = new L.Control.Draw({ edit: { featureGroup: drawnItems }, draw: { polygon: true, polyline: false, rectangle: true, circle: false, marker: false, circlemarker: false } });
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

map.on(L.Draw.Event.DELETED, function (event) {
    const layers = event.layers;
    layers.eachLayer(function(layer){
        alert('To delete a fence, use the fence list in the sidebar and delete by DB id.');
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

// Admin register/reset UI removed — these actions are available via API/scripts

async function loadFences(){
    fencesLayer.clearLayers();
    const res = await fetch('/api/fences');
    const data = await res.json();
    data.forEach(f => {
        const color = f.fence_type === 'restricted' ? 'red' : (f.fence_type === 'high-risk' ? 'orange' : 'green');
        const g = L.geoJSON(f.geojson, {style: {color}}).bindPopup(f.name).addTo(fencesLayer);
        g.eachLayer(layer => { if (layer.feature) layer.feature.properties = layer.feature.properties || {}; layer.feature.properties.db_id = f.id; });
    });
}

async function loadIncidents(){
    incidentsLayer.clearLayers();
    const res = await fetch('/api/incidents');
    const data = await res.json();
    data.forEach(i => {
        const m = L.marker([i.lat, i.lon]).addTo(incidentsLayer);
        m.bindPopup((i.desc || 'Incident') + `<br/><a href="#" class="view-incident" data-id="${i.id}">View details</a>`);
    });
    // populate sidebar incident list
    const list = document.getElementById('incidentList');
    document.getElementById('incidentCount').textContent = data.length;
    if (!data.length) { list.innerHTML = '<div class="empty-state">No active incidents</div>'; return }
    list.innerHTML = '';
    data.forEach(i => {
        const el = document.createElement('div'); el.className = 'list-item';
        const triage = localStorage.getItem(`incident_triage_${i.id}`) || 'New';
        el.innerHTML = `<div class="incident-title">Incident #${i.id}<span class="triage-badge ${triage.toLowerCase()}">${triage}</span></div><div class="incident-meta">${i.desc || ''} · ${i.ts}</div>`;
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
        const k = document.createElement('div'); k.style.fontWeight = '600'; k.style.color = '#0b1220'; k.textContent = r[0];
        const v = document.createElement('div'); v.style.color = 'var(--muted)'; v.textContent = r[1];
        table.appendChild(k); table.appendChild(v);
    });
    container.appendChild(table);
    const triage = document.createElement('label');
    triage.className = 'triage-control';
    triage.innerHTML = '<span>Operator triage</span><select><option>New</option><option>Acknowledged</option><option>Resolved</option></select>';
    const select = triage.querySelector('select');
    select.value = localStorage.getItem(`incident_triage_${i.id}`) || 'New';
    select.onchange = () => { localStorage.setItem(`incident_triage_${i.id}`, select.value); loadIncidents(); };
    container.appendChild(triage);
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

loadFences(); loadIncidents();
