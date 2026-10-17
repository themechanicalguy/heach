/*
 * HEACH shell service worker (PF-07). Caches the app shell (locale pages, Next assets, fonts,
 * icons) so the app opens offline with the offline banner. It never caches /api responses:
 * those carry personal and health data (PF-07.1, SE-09). Plain JS, no build step.
 */
/* global self, caches, fetch, URL */
const CACHE = 'heach-shell-v1';
const SHELL = ['/or', '/en', '/hi', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
}

/** Pages: network first; offline, the cached copy of the page or of its language's home. */
async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const locale = new URL(request.url).pathname.split('/')[1] || 'or';
    return (
      (await cache.match(request)) ||
      (await cache.match(`/${locale}`)) ||
      (await cache.match('/or'))
    );
  }
}

/** Hashed static files never change: cache first. */
async function asset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // never cached, never intercepted
  if (event.request.mode === 'navigate') event.respondWith(page(event.request));
  else if (isCacheableAsset(url)) event.respondWith(asset(event.request));
});
