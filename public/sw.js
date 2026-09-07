const CACHE_NAME = 'finance-app-v4';
const OFFLINE_URL = '/offline.html';
const IS_DEV_PREVIEW =
  self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' ||
  self.location.hostname.endsWith('.replit.dev');
// Shell files pre-cached on install so the app loads even when refreshed offline
const SHELL_URLS = ['/', '/index.html', '/manifest.json', OFFLINE_URL];

self.addEventListener('install', (e) => {
  if (IS_DEV_PREVIEW) {
    e.waitUntil(self.skipWaiting());
    return;
  }

  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())  // activate immediately, no waiting for old tabs
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const staleFinanceCaches = keys.filter(key =>
        key.startsWith('finance-app-') &&
        (IS_DEV_PREVIEW || key !== CACHE_NAME)
      );

      await Promise.all(
        staleFinanceCaches.map(key => caches.delete(key))
      );

      await self.clients.claim();

      // A stale development worker can keep serving broken Vite modules to every
      // new tab. Reload controlled previews once after v4 takes over and clears it.
      if (IS_DEV_PREVIEW && staleFinanceCaches.length > 0) {
        const windows = await self.clients.matchAll({ type: 'window' });
        await Promise.all(windows.map(client => client.navigate(client.url)));
      }
    })()
  );
});

self.addEventListener('fetch', (e) => {
  // Vite module URLs are stable in development and must never be cache-first.
  if (IS_DEV_PREVIEW) return;

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
