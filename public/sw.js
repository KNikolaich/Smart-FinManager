const CACHE_NAME = 'finance-app-v2';
const OFFLINE_URL = '/offline.html';
const ASSETS = ['/', '/index.html', '/manifest.json', OFFLINE_URL];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))));

self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE_URL)));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
