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
        const name = prompt('Fence name');
        const type = prompt('Fence type (safe/restricted/high-risk)', 'restricted');
        const token = localStorage.getItem('admin_token');
        if (!token) { alert('Please set admin token via Login button'); return }
        fetch('/fences', {method:'POST', headers: {'Content-Type':'application/json', 'Authorization': 'Bearer '+token}, body: JSON.stringify({name, fence_type: type, geojson: geojson.geometry})}).then(r=>r.json()).then(d=>{ alert('Fence created id='+d.id); loadFences(); });
});

map.on(L.Draw.Event.EDITED, function (event) {
    const layers = event.layers;
    layers.eachLayer(function(layer){
        const geojson = layer.toGeoJSON();
        const id = layer._leaflet_id; // not same as DB id; skipping mapping complexity
        // For simplicity we create a new fence and remove the old one.
        const name = prompt('Updated fence name');
        const type = prompt('Fence type (safe/restricted/high-risk)', 'restricted');
        const token = localStorage.getItem('admin_token');
        if (!token) { alert('Please set admin token via Login button'); return }
        fetch('/fences', {method:'POST', headers: {'Content-Type':'application/json', 'Authorization': 'Bearer '+token}, body: JSON.stringify({name, fence_type: type, geojson: geojson.geometry})}).then(r=>r.json()).then(d=>{ alert('Fence updated (created new) id='+d.id); loadFences(); });
    });
});

map.on(L.Draw.Event.DELETED, function (event) {
    const layers = event.layers;
    layers.eachLayer(function(layer){
        // Deletion must map to DB id; admin must use the refresh list and delete by id.
        const id = prompt('Enter DB fence id to delete');
        const token = localStorage.getItem('admin_token');
        if (!token) { alert('Please set admin token via Login button'); return }
        if (!id) return;
        fetch('/fences/'+id, {method:'DELETE', headers: {'Authorization':'Bearer '+token}}).then(r=>{ if(r.ok) alert('deleted'); loadFences(); });
    });
});

// Admin login helper
const adminLoginBtn = L.control({position: 'topright'});
adminLoginBtn.onAdd = function () {
    const el = L.DomUtil.create('div', 'admin-login');
    el.innerHTML = '<button id="adminLogin">Admin Login</button>';
    return el;
};
adminLoginBtn.addTo(map);
document.addEventListener('click', async (e)=>{ if (e.target && e.target.id === 'adminLogin'){ const username = prompt('admin username'); const password = prompt('password'); const form = new FormData(); form.append('username', username); form.append('password', password); const res = await fetch('/login', {method:'POST', body: form}); const data = await res.json(); localStorage.setItem('admin_token', data.access_token); alert('token saved'); } });

async function loadFences(){
    fencesLayer.clearLayers();
    const res = await fetch('/api/fences');
    const data = await res.json();
    data.forEach(f => {
        L.geoJSON(f.geojson, {style: {color: f.fence_type === 'restricted' ? 'red' : 'green'}}).bindPopup(f.name).addTo(fencesLayer);
    });
}

async function loadIncidents(){
    incidentsLayer.clearLayers();
    const res = await fetch('/api/incidents');
    const data = await res.json();
    data.forEach(i => {
        L.marker([i.lat, i.lon]).bindPopup(i.desc || 'Incident').addTo(incidentsLayer);
    });
}

document.getElementById('refresh').onclick = () => { loadFences(); loadIncidents(); };
document.getElementById('sos').onclick = async () => {
    // demo SOS at map center
    const c = map.getCenter();
    await fetch('/sos', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({user_id: null, lat: c.lat, lon: c.lng, description: 'Demo SOS from admin'})});
    loadIncidents();
}

loadFences(); loadIncidents();
