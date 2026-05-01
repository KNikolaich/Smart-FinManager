const CACHE_NAME = 'finance-app-v2';
const OFFLINE_URL = '/offline.html';
const ASSETS = ['/', '/index.html', '/manifest.json', OFFLINE_URL];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))));

self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(async () => {
        // Retry once after a short delay if navigation fails (useful for VPN toggling)
        try {
          await new Promise(r => setTimeout(r, 1500));
          return await fetch(e.request);
        } catch {
          return caches.match(OFFLINE_URL);
        }
      })
    );
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
