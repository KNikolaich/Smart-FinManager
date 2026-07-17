const CACHE_NAME = 'finance-app-v3';
const OFFLINE_URL = '/offline.html';
// Shell files pre-cached on install so the app loads even when refreshed offline
const SHELL_URLS = ['/', '/index.html', '/manifest.json', OFFLINE_URL];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())  // activate immediately, no waiting for old tabs
  );
});

self.addEventListener('activate', (e) => {
  // Remove stale caches from previous versions
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // take control of all tabs immediately
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never intercept API calls — the app manages offline API responses itself
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Navigation: network-first, fall back to cached /index.html so the React app
    // loads and handles offline state itself (instead of showing a dead offline.html)
    e.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            // Cache the freshly fetched page for future offline access
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          // Serve cached index.html → React app boots and works offline
          caches.match('/index.html').then(r => r || caches.match(OFFLINE_URL))
        )
    );
  } else {
    // Static assets (JS, CSS, images, fonts): cache-first.
    // On a cache miss, fetch from network and store for next time.
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        });
      })
    );
  }
});
