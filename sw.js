const CACHE_NAME = 'tailors-cache-v3001';

const urlsToCache = [
  '/about.html',
  '/choose-role.html',
  '/index.html',
  '/login.html',
  '/old_dashboard.html',
  '/pricing.html',
  '/privacy.html',
  '/support.html',
  '/tailor-onboarding.html',
  '/terms.html',
  '/views/admin/admin-analytics.html',
  '/views/admin/admin-clients.html',
  '/views/admin/admin-dashboard.html',
  '/views/admin/admin-expenses.html',
  '/views/admin/admin-inventory.html',
  '/views/admin/admin-listings.html',
  '/views/admin/admin-management.html',
  '/views/admin/admin-messages.html',
  '/views/admin/admin-order-details.html',
  '/views/admin/admin-order-form.html',
  '/views/admin/admin-orders.html',
  '/views/admin/admin-settings.html',
  '/views/admin/admin-tailors-directory.html',
  '/views/admin/admin-transactions.html',
  '/views/admin/financial-overview.html',
  '/views/client/blog-post.html',
  '/views/client/blog.html',
  '/views/client/client-dashboard.html',
  '/views/client/marketplace.html',
  '/views/client/track.html',
  '/views/manager/all-orders.html',
  '/views/manager/clients.html',
  '/views/manager/expenses.html',
  '/views/manager/manager-blog.html',
  '/views/manager/manager-dashboard.html',
  '/views/manager/manager-inventory.html',
  '/views/manager/manager-listings.html',
  '/views/manager/manager-messages.html',
  '/views/manager/order-details.html',
  '/views/manager/order-form.html',
  '/views/manager/shop.html',
  '/views/superadmin/superadmin-blog.html',
  '/views/superadmin/superadmin-dashboard.html',
  '/views/superadmin/superadmin-ledger.html',
  '/views/superadmin/superadmin-orgs.html',
  '/views/superadmin/superadmin-users-list.html',
  '/views/superadmin/superadmin-users.html',
  '/views/worker/worker-assignments.html',
  '/views/worker/worker-management.html',
  '/',
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
  '/js/ui/sidebar.js',
  '/js/ui/modals.js',
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
              const pathname = new URL(request.url).pathname;
              return caches.match(pathname, { ignoreSearch: true }).then(pathMatch => {
                if (pathMatch) return pathMatch;
                return caches.match('/index.html', { ignoreSearch: true });
              });
            });
        })
    );
    return;
  }

  // 2. Static Assets (CSS, JS, Fonts, Images): Cache First with Network Fallback
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
        }
        return networkResponse;
      }).catch(err => {
        console.warn('Network fetch failed for asset:', request.url);
        return new Response('', { status: 503, statusText: 'Offline Asset Unavailable' });
      });
    })
  );
});
