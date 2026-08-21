const map = L.map('map').setView([20.5937,78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
}).addTo(map);

let fencesLayer = L.geoJSON().addTo(map);
let incidentsLayer = L.layerGroup().addTo(map);
// WebSocket for realtime updates
try{
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(protocol + '://' + window.location.host + '/ws');
    ws.onmessage = (ev) => {
        try{
            const msg = JSON.parse(ev.data);
            if (msg.type === 'incident_created'){
                L.marker([msg.lat, msg.lon]).bindPopup(msg.description || 'Incident').addTo(incidentsLayer);
            }
            if (msg.type === 'telemetry_anomaly'){
                L.circle([msg.lat, msg.lon], {radius:50, color:'orange'}).addTo(map);
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
document.getElementById('adminLoginBtn').onclick = () => { document.getElementById('adminModal').style.display = 'flex'; };
document.getElementById('adminCancel').onclick = () => { document.getElementById('adminModal').style.display = 'none'; };
document.getElementById('adminSubmit').onclick = async () => {
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
        document.getElementById('adminModal').style.display = 'none';
        alert('Admin login successful');
    }catch(e){ console.error(e); alert('Login error: '+e.message) }
};

// Admin register flow
document.getElementById('adminRegisterBtn').onclick = () => { document.getElementById('adminRegisterModal').style.display = 'flex'; };
document.getElementById('adminRegCancel').onclick = () => { document.getElementById('adminRegisterModal').style.display = 'none'; };
document.getElementById('adminRegSubmit').onclick = async () => {
    const username = document.getElementById('admin_reg_user').value;
    const email = document.getElementById('admin_reg_email').value;
    const password = document.getElementById('admin_reg_pass').value;
    const token = localStorage.getItem('admin_token');
    if (!token) { alert('Please login as admin first'); return }
    const res = await fetch('/admin/register', {method:'POST', headers: {'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({username,email,password})});
    const txt = await res.text();
    if (!res.ok){ alert('Create admin failed: '+txt); return }
    alert('Admin created'); document.getElementById('adminRegisterModal').style.display='none';
}

// Admin reset password flow
document.getElementById('adminResetBtn').onclick = () => { document.getElementById('adminResetModal').style.display = 'flex'; };
document.getElementById('adminResetCancel').onclick = () => { document.getElementById('adminResetModal').style.display = 'none'; };
document.getElementById('adminResetSubmit').onclick = async () => {
    const username = document.getElementById('admin_reset_user').value;
    const newpw = document.getElementById('admin_reset_pass').value;
    const token = localStorage.getItem('admin_token');
    if (!token) { alert('Please login as admin first'); return }
    const res = await fetch('/admin/reset_password', {method:'POST', headers: {'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({username,new_password:newpw})});
    const txt = await res.text();
    if (!res.ok){ alert('Reset failed: '+txt); return }
    alert('Password reset'); document.getElementById('adminResetModal').style.display='none';
}

async function loadFences(){
    fencesLayer.clearLayers();
    const res = await fetch('/api/fences');
    const data = await res.json();
    data.forEach(f => {
        const g = L.geoJSON(f.geojson, {style: {color: f.fence_type === 'restricted' ? 'red' : 'green'}}).bindPopup(f.name).addTo(fencesLayer);
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
    if (!data.length) { list.innerHTML = 'No incidents yet'; return }
    list.innerHTML = '';
    data.forEach(i => {
        const el = document.createElement('div'); el.className = 'list-item';
        el.innerHTML = `<div class="incident-title">Incident #${i.id}</div><div class="incident-meta">${i.desc || ''} • ${i.ts}</div>`;
        el.style.cursor = 'pointer';
        el.onclick = () => { showIncident(i); };
        list.appendChild(el);
    });
}

function showIncident(i){
    const container = document.getElementById('incidentDetails');
    container.innerHTML = '';
    const rows = [
        ['ID', i.id], ['Description', i.desc || ''], ['Status', i.status || ''], ['Timestamp', i.ts || ''], ['Latitude', i.lat], ['Longitude', i.lon]
    ];
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
    document.getElementById('incidentModal').style.display = 'flex';
}

document.getElementById('incidentClose')?.addEventListener('click', ()=>{ document.getElementById('incidentModal').style.display = 'none'; });

// delegate click events from popups (they are in map panes)
document.addEventListener('click', function(ev){
    const a = ev.target.closest && ev.target.closest('.view-incident');
    if (a){ ev.preventDefault(); const id = Number(a.dataset.id); fetch('/api/incidents').then(r=>r.json()).then(data=>{ const inc = data.find(x=>x.id===id); if (inc) showIncident(inc); }); }
});

document.getElementById('refresh').addEventListener('click', () => { loadFences(); loadIncidents(); });
document.getElementById('sos').addEventListener('click', async () => {
        const c = map.getCenter();
        try{
            const res = await fetch('/sos', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({user_id: null, lat: c.lat, lon: c.lng, description: 'Demo SOS from admin'})});
            if (!res.ok) { alert('SOS failed'); return }
            await loadIncidents();
        }catch(e){ console.error(e); alert('SOS error') }
});

loadFences(); loadIncidents();
