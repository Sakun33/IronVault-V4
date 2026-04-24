// IronVault PWA Service Worker v3.0.0
// Key design: Network First for HTML/navigation (so deploys update immediately),
// Cache First only for hashed /assets/ files (which are immutable by content hash).
const CACHE_VERSION = 'ironvault-v3.0.0';
const ASSETS_CACHE  = 'ironvault-assets-v3.0.0';
const DYNAMIC_CACHE = 'ironvault-dynamic-v3.0.0';

const KNOWN_CACHES = [CACHE_VERSION, ASSETS_CACHE, DYNAMIC_CACHE];

// Never cache — sensitive API endpoints
const NETWORK_ONLY = [
  '/api/vault', '/api/passwords', '/api/subscriptions',
  '/api/auth', '/api/session',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting immediately so the new SW takes over as fast as possible.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(['/offline.html', '/manifest.json'])
    ).catch(() => {})
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return;

  // Never cache sensitive API calls
  if (NETWORK_ONLY.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(fetch(request).catch(() =>
      new Response('Network unavailable', { status: 503 })
    ));
    return;
  }

  // Network first for ALL API calls and navigation (HTML documents).
  // This ensures every deploy is picked up immediately.
  if (
    request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Cache first ONLY for hashed /assets/ files — these are immutable.
  // Vite content-hashes every asset, so stale-cache is safe here.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Default: network first for everything else
  event.respondWith(networkFirstWithOfflineFallback(request));
});

// ── Strategies ────────────────────────────────────────────────────────────────
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.destination === 'document') {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
    return new Response('Offline', { status: 503 });
  }
}

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ASSETS_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING' || event.data?.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] IronVault service worker v3.0.0 loaded');
