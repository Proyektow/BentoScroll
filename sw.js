const CACHE_NAME = 'bentoscroll-v8';
const MAP_CACHE = 'bentoscroll-osm-tiles-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/style.css',
  './data/pack.json',
  './js/db.js',
  './js/games.js',
  './js/scanner.js',
  './js/fog.js',
  './js/lab.js',
  './js/vault.js',
  './js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== MAP_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  if (url.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(MAP_CACHE).then((cache) =>
        cache.match(e.request).then((cached) => {
          if (cached) return cached;
          return fetch(e.request).then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  if (!url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
