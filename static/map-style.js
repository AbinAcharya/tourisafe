/* Tourisafe shared map styling — clean basemaps, designed safety zones, and
   map markers. Loaded before tourist.js / admin.js (after Leaflet). */
(function (global) {
  const L = global.L;

  const PALETTE = {
    sage: '#2f6b5b',
    sageBright: '#4f9a86',
    amber: '#c88a35',
    amberBright: '#e0a94e',
    danger: '#c0392b',
    dangerBright: '#e05a4f',
    location: '#2878c8',
  };

  // OpenStreetMap standard raster tiles — free and require no API key. (The old
  // CARTO basemaps began returning "API KEY REQUIRED" error tiles, which broke
  // the map on both pages and triggered a storm of failing tile requests.) Light
  // and dark use the SAME source, so tiles are fetched/cached once and shared.
  const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  // 1x1 transparent PNG, shown instead of a broken image if a tile ever fails.
  const BLANK_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  function tileOpts(extra) {
    return Object.assign({
      subdomains: 'abc',
      maxZoom: 19,
      crossOrigin: true,
      updateWhenZooming: false, // don't re-request tiles mid-zoom gesture
      errorTileUrl: BLANK_TILE,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }, extra || {});
  }
  function basemap(kind) {
    return L.tileLayer(OSM_URL, tileOpts());
  }

  // Dark basemap: the same OSM tiles, darkened entirely in the browser via a CSS
  // invert/hue-rotate filter on this layer's container (.ts-dark-tiles). No
  // separate keyed dark source, so it can never hit an API-key wall — and the
  // vector safety zones / markers (in other Leaflet panes) keep their true
  // colours because the filter only touches this tile layer.
  function darkBasemap() {
    return L.tileLayer(OSM_URL, tileOpts({ className: 'ts-dark-tiles' }));
  }

  // Per-type vector styling for safety zones.
  const ZONE = {
    restricted: { color: PALETTE.danger, fillColor: PALETTE.dangerBright, weight: 2.5, fillOpacity: 0.24, dashArray: null },
    'high-risk': { color: PALETTE.amber, fillColor: PALETTE.amberBright, weight: 2.5, fillOpacity: 0.2, dashArray: '8 6' },
    safe: { color: PALETTE.sage, fillColor: PALETTE.sageBright, weight: 2, fillOpacity: 0.14, dashArray: null },
  };
  function zoneStyle(type) {
    const base = ZONE[type] || ZONE.safe;
    return Object.assign({ lineJoin: 'round', lineCap: 'round' }, base);
  }

  const ZONE_TITLE = { restricted: 'Restricted', 'high-risk': 'High risk', safe: 'Safe zone' };

  // Apply style + hover lift + a permanent name pill to every sub-layer of a
  // geoJSON layer created from a fence record.
  function decorateZone(geoLayer, meta) {
    const type = (meta && meta.type) || 'safe';
    const style = zoneStyle(type);
    geoLayer.eachLayer(function (layer) {
      if (!layer.setStyle) return;
      layer.setStyle(style);
      layer.on('mouseover', function () {
        layer.setStyle({ weight: style.weight + 1.5, fillOpacity: Math.min(0.5, style.fillOpacity + 0.16) });
        if (layer.bringToFront) layer.bringToFront();
      });
      layer.on('mouseout', function () { layer.setStyle(style); });
      if (meta && meta.name && layer.bindTooltip) {
        layer.bindTooltip(
          '<span class="zone-pill zone-pill--' + type + '">' + escapeHtml(meta.name) + '</span>',
          { permanent: true, direction: 'center', className: 'zone-label', opacity: 1 }
        );
      }
    });
    return geoLayer;
  }

  function divPin(kind, glyph) {
    return L.divIcon({
      className: 'ts-pin-wrap',
      html: '<span class="ts-pin ts-pin--' + kind + '">' +
        '<span class="ts-pin__pulse"></span>' +
        '<span class="ts-pin__core">' + (glyph || '') + '</span></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -12],
    });
  }
  function incidentMarker(latlng, opts) { return L.marker(latlng, Object.assign({ icon: divPin('incident', '!') }, opts || {})); }
  function touristMarker(latlng, opts) { return L.marker(latlng, Object.assign({ icon: divPin('tourist') }, opts || {})); }
  function selfMarker(latlng, opts) { return L.marker(latlng, Object.assign({ icon: divPin('self') }, opts || {})); }

  function accuracyCircle(latlng, radius) {
    return L.circle(latlng, { radius: radius || 0, color: PALETTE.location, fillColor: PALETTE.location, fillOpacity: 0.08, weight: 1 });
  }
  // A soft highlight ring dropped at an alert/anomaly location.
  function ping(latlng, tone) {
    const c = tone === 'alert' ? PALETTE.danger : PALETTE.amber;
    return L.circle(latlng, { radius: 60, color: c, weight: 2, fillColor: c, fillOpacity: 0.12, className: 'ts-ping' });
  }

  // One-shot fade of the vector overlay pane (safety zones) after they load.
  // Runs on the container, so it never re-triggers on pan/zoom the way a
  // per-path animation would.
  function fadeInZones(map) {
    if (!map || !map.getPane) return;
    const pane = map.getPane('overlayPane');
    if (!pane) return;
    pane.style.animation = 'none';
    void pane.offsetWidth; // force reflow so the animation replays
    pane.style.animation = 'tsFadeIn .6s ease';
  }

  function icons() {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      global.lucide.createIcons({ attrs: { 'stroke-width': 2, width: 18, height: 18 } });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.TouriSafe = {
    PALETTE, basemap, darkBasemap, zoneStyle, ZONE_TITLE, decorateZone,
    incidentMarker, touristMarker, selfMarker, accuracyCircle, ping, fadeInZones, icons, escapeHtml,
  };
})(window);
