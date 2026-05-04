// IronVault PWA Service Worker v3.5.0
//
// Strategy:
// - Network-first for HTML / navigation requests (every deploy picks up).
// - Network-first for /assets/ JS+CSS, falling back to cache only when offline.
//   Vite hashes asset filenames, so a new deploy's index.html will reference
//   a new bundle name; this guards against an old SW serving a stale chunk
//   if the cache key collision ever sneaks in.
// - Cache-first for /assets/ images (heavier, low-churn).
// - Skip-waiting + clients.claim so a new SW takes over immediately on
//   install/activate — no "old tab keeps running v(n-1)" window.
const CACHE_VERSION = 'ironvault-v3.5.0';
const ASSETS_CACHE  = 'ironvault-assets-v3.5.0';
const DYNAMIC_CACHE = 'ironvault-dynamic-v3.5.0';

const KNOWN_CACHES = [CACHE_VERSION, ASSETS_CACHE, DYNAMIC_CACHE];

// Never cache — sensitive API endpoints
const NETWORK_ONLY = [
  '/api/vault', '/api/passwords', '/api/subscriptions',
  '/api/auth', '/api/session',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Take over from any older SW immediately
  self.skipWaiting();
  event.waitUntil(
    // Purge ALL caches not belonging to this version before caching new shell.
    // This evicts every prior version's hashed-asset bundle.
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k)))
    ).then(() =>
      caches.open(CACHE_VERSION).then((cache) =>
        cache.addAll(['/offline.html', '/manifest.json']).catch(() => {})
      )
    )
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

  // Network-first for HTML / navigation — every deploy picked up immediately
  if (
    request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // /assets/ — split by destination so JS/CSS get a fresh fetch when online
  // (defensive against the "stale bundle" symptom even though Vite hashes)
  // while images keep cache-first.
  if (url.pathname.startsWith('/assets/')) {
    if (request.destination === 'script' || request.destination === 'style') {
      event.respondWith(networkFirstAssets(request));
    } else {
      event.respondWith(cacheFirstStrategy(request));
    }
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

// JS / CSS: try the network first; fall back to cache only if offline. The
// fresh response is written to ASSETS_CACHE so future offline visits work.
async function networkFirstAssets(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ASSETS_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Asset unavailable offline', { status: 503 });
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
