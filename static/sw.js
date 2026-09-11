/*
 * Tourisafe service worker — offline shell only.
 *
 * Cache-first for the static app shell so the tourist page still opens with no
 * connection. Everything live (/api/*, /telemetry, /sos, /ws, tiles) is
 * network-only and is NEVER cached: stale safety data would be worse than none.
 *
 * Bump CACHE_VERSION whenever a shell file changes so clients pick it up.
 */
const CACHE_VERSION = 'tourisafe-shell-v1';

const SHELL = [
  '/tourist',
  '/static/tourist.html',
  '/static/styles.css?v=17',
  '/static/map-style.js?v=4',
  '/static/i18n.js?v=1',
  '/static/tourist.js?v=10',
  '/static/logo.svg',
  '/static/favicon.svg',
  '/manifest.webmanifest',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Paths that must always hit the network — live data and the websocket.
const NETWORK_ONLY = ['/api/', '/telemetry', '/sos', '/ws', '/login', '/register', '/auth/', '/admin/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // addAll() rejects the whole batch if any single request fails (e.g. a CDN
      // hiccup), which would abort the install. Cache each entry independently.
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && NETWORK_ONLY.some(prefix => url.pathname.startsWith(prefix))) return;
  // Map tiles: large, volatile, and quota-hungry — leave them to the browser.
  if (!sameOrigin && !url.hostname.startsWith('unpkg.com')) return;

  event.respondWith(
    caches.match(request, {ignoreSearch: false}).then(hit => {
      if (hit) return hit;
      return fetch(request)
        .then(response => {
          // Only cache successful basic/cors responses for shell-ish assets.
          if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          // Offline navigation falls back to the cached shell.
          if (request.mode === 'navigate') return caches.match('/static/tourist.html');
          return caches.match(request, {ignoreSearch: true});
        });
    })
  );
});
