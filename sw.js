// Offline cache for the app shell. Bump VERSION whenever you upload new files.
// Strategy: serve from cache first (works with no internet AND if the site is taken down),
// refresh the cache in the background only when the server returns a valid response.
const VERSION = 'kesef-v2';
const FILES = ['./', './index.html', './manifest.webmanifest', './xlsx.full.min.js', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function refresh(req, cacheKey) {
  return fetch(req).then(res => {
    // Never overwrite the cached app with a 404 / error page (e.g. if hosting is removed)
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(cacheKey || req, copy));
    }
    return res;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then(cached => {
      const net = refresh(req, './index.html').catch(() => null);
      if (cached) { e.waitUntil(net); return cached; }
      return net.then(res => res || new Response('Offline', { status: 503 }));
    }));
    return;
  }

  e.respondWith(caches.match(req).then(hit => {
    if (hit) { e.waitUntil(refresh(req).catch(() => {})); return hit; }
    return refresh(req);
  }));
});
