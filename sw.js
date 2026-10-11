/**
 * Service Worker for Al-Sari Broadcast System
 * Cache-first strategy with fallback to index.html
 */

const CACHE_NAME = 'sari-cache-v31';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/chime-b64.js',
  '/attention-chime.mp3',
  '/universfield-attention-chime-123107.mp3',
  '/app-admin-tools.js',
  '/app-notifications.js',
  '/app-features.js',
  '/app-modules.js',
  '/app-barcodes.js',
  '/firebase-sync.js',
  '/firebase-config.js',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some assets could not be pre-cached on install', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET and chrome-extension / API requests
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML navigation requests: Network-First (ensures newly added buttons and UI updates appear immediately)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', resClone));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Dedicated handling for stylesheets to strictly prevent invalid MIME types
  const isStyle = request.destination === 'style' || url.pathname.endsWith('.css') || url.pathname.includes('/styles.css');
  if (isStyle) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const ct = cachedResponse ? (cachedResponse.headers.get('content-type') || '') : '';
        if (cachedResponse && ct.includes('text/css')) {
          // Valid CSS cached, revalidate in background
          fetch(request, { headers: { 'Accept': 'text/css' } }).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && (networkResponse.headers.get('content-type') || '').includes('text/css')) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }
        // No valid cached CSS or wrong content-type: fetch fresh
        return fetch(request, { headers: { 'Accept': 'text/css' } }).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resCt = networkResponse.headers.get('content-type') || '';
            if (resCt.includes('text/css')) {
              const toCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
            }
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      })
    );
    return;
  }

  // Cache-first for other static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
