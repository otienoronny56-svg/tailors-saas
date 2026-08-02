const CACHE_NAME = 'tailors-cache-v2000';

const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/choose-role.html',
  '/about.html',
  '/pricing.html',
  '/privacy.html',
  '/terms.html',
  '/support.html',
  '/tailor-onboarding.html',
  '/styles.css',
  '/app.js',
  '/mobile-nav.js',
  '/manifest.json',
  '/js/core/config.js',
  '/js/core/globals.js',
  '/js/core/auth.js',
  '/js/core/init.js',
  '/js/core/algorithm.js',
  '/js/core/offline-store.js',
  '/js/ui/theme.js',
  '/js/ui/offline-ui.js',
  '/js/features/orders.js',
  '/js/features/clients.js',
  '/js/features/inventory.js',
  '/js/features/management.js',
  '/js/features/messaging.js',
  '/js/features/analytics.js',
  '/js/features/payments.js',
  '/js/features/admin-settings.js',
  '/js/features/dashboard-marketplace.js',
  '/js/features/tailors-directory.js',
  '/js/utils/helpers.js',
  '/js/utils/kra-tax.js',
  '/js/lib/supabase.min.js',
  '/logo.jpeg',
  '/hero_bg.png',
  '/hero_slide2.png',
  '/hero_slide3.png',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event - Pre-cache core shell resources gracefully
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Use Promise.allSettled so if any single image fails, the whole SW install won't fail
        return Promise.allSettled(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.warn('Failed to pre-cache URL:', url, err);
            });
          })
        );
      })
  );
});

// Activate Event - Clean up stale cache versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Cleaning old cache version:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Strategic Offline Request Handling
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests or non-http(s)
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Bypass Service Worker caching for Supabase API calls (let OfflineStore handle database offline caching)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // 1. Navigation / HTML Requests: Network First, fallback to Cache, fallback to /index.html
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request, { ignoreSearch: true })
            .then(cachedResponse => {
              if (cachedResponse) return cachedResponse;
              return caches.match('/index.html', { ignoreSearch: true });
            });
        })
    );
    return;
  }

  // 2. Static Assets (CSS, JS, Fonts, Images): Cache First with Network Fallback & Background Update (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
      const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
        }
        return networkResponse;
      }).catch(err => {
        console.warn('Network fetch failed for asset:', request.url);
      });

      return cachedResponse || fetchPromise;
    })
  );
});
