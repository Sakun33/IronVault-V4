// SecureVault PWA Service Worker
const CACHE_NAME = 'securevault-v1.0.0';
const STATIC_CACHE = 'securevault-static-v1.0.0';
const DYNAMIC_CACHE = 'securevault-dynamic-v1.0.0';

// Assets to cache on install (production-ready paths)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  // Note: In production, actual JS/CSS assets have hashed names
  // This will be updated by build process or PWA plugin
];

// URLs that should always try network first (never cache sensitive data)
const NETWORK_ONLY_URLS = [
  '/api/vault',
  '/api/passwords', 
  '/api/subscriptions',
  '/api/auth',
  '/api/session',
];

// URLs that should try network first but can fallback to cache
const NETWORK_FIRST_URLS = [
  '/api/',
  '/server/',
];

// URLs that should be cached (static assets only)
const CACHE_FIRST_URLS = [
  '/assets/',
  '/icons/',
  '/screenshots/',
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip browser extension requests
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
    return;
  }

  event.respondWith(
    handleFetchRequest(request)
  );
});

// Handle different fetch strategies
async function handleFetchRequest(request) {
  const url = new URL(request.url);
  
  // Never cache sensitive vault data
  if (shouldUseNetworkOnly(url)) {
    return networkOnlyStrategy(request);
  }
  
  // Network first for API calls and dynamic content
  if (shouldUseNetworkFirst(url)) {
    return networkFirstStrategy(request);
  }
  
  // Cache first for static assets
  if (shouldUseCacheFirst(url)) {
    return cacheFirstStrategy(request);
  }
  
  // Default: Network first with fallback
  return networkFirstStrategy(request);
}

// Check if URL should never be cached (sensitive data)
function shouldUseNetworkOnly(url) {
  return NETWORK_ONLY_URLS.some(pattern => 
    url.pathname.startsWith(pattern)
  );
}

// Check if URL should use network first strategy
function shouldUseNetworkFirst(url) {
  return NETWORK_FIRST_URLS.some(pattern => 
    url.pathname.startsWith(pattern)
  );
}

// Check if URL should use cache first strategy  
function shouldUseCacheFirst(url) {
  return CACHE_FIRST_URLS.some(pattern => 
    url.pathname.includes(pattern) || url.pathname.endsWith(pattern)
  );
}

// Network-only strategy - never cache sensitive data
async function networkOnlyStrategy(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.log('Network request failed for sensitive endpoint:', error);
    return new Response('Network unavailable - sensitive data requires connection', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain',
      }),
    });
  }
}

// Network first strategy - try network, fallback to cache (non-sensitive data only)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Only cache non-sensitive responses
      const url = new URL(request.url);
      if (!shouldUseNetworkOnly(url)) {
        const responseClone = networkResponse.clone();
        caches.open(DYNAMIC_CACHE)
          .then(cache => cache.put(request, responseClone))
          .catch(error => console.error('Failed to cache response', error));
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache...', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.destination === 'document') {
      return caches.match('/offline.html') || getOfflinePage();
    }
    
    // Return basic error response
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain',
      }),
    });
  }
}

// Cache first strategy - try cache, fallback to network
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Update cache in background
    fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(STATIC_CACHE)
            .then(cache => cache.put(request, response.clone()));
        }
      })
      .catch(error => console.log('Background update failed', error));
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      caches.open(STATIC_CACHE)
        .then(cache => cache.put(request, responseClone));
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache and network both failed', error);
    return new Response('Resource not available offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// Generate offline page response
function getOfflinePage() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SecureVault - Offline</title>
      <style>
        body { 
          font-family: system-ui, -apple-system, sans-serif; 
          text-align: center; 
          padding: 2rem;
          background-color: #0f0f23;
          color: #fff;
          margin: 0;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
        h1 { color: #6366f1; margin-bottom: 0.5rem; }
        p { color: #a1a1aa; margin-bottom: 1.5rem; }
        button {
          background: #6366f1;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
        }
        button:hover { background: #5145cd; }
      </style>
    </head>
    <body>
      <div class="offline-icon">🔒</div>
      <h1>SecureVault is Offline</h1>
      <p>You're currently offline, but your encrypted vault data is still accessible locally.</p>
      <button onclick="window.location.reload()">Try Again</button>
      <script>
        // Auto-refresh when online
        window.addEventListener('online', () => {
          window.location.reload();
        });
      </script>
    </body>
    </html>`,
    {
      status: 200,
      headers: new Headers({
        'Content-Type': 'text/html',
      }),
    }
  );
}

// Handle background sync for when connection is restored
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered');
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Perform any background sync tasks
      console.log('Performing background sync...')
    );
  }
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: 'SecureVault notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'securevault-notification',
    requireInteraction: false,
  };
  
  if (event.data) {
    const data = event.data.json();
    options.body = data.body || options.body;
    options.title = data.title || 'SecureVault';
  }
  
  event.waitUntil(
    self.registration.showNotification(options.title || 'SecureVault', options)
  );
});

// Message handler for update control
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'SKIP_WAITING') {
    console.log('Service Worker: Skipping waiting...');
    self.skipWaiting();
  }
});

console.log('Service Worker: Loaded and ready');