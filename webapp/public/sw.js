const CACHE_STATIC = 'cooppanier-static-v3';
const CACHE_PAGES = 'cooppanier-pages-v3';

const PRECACHE_STATIC = [
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

const PRECACHE_PAGES = [
  '/',
  '/auth/login',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then((c) => c.addAll(PRECACHE_STATIC)),
      caches.open(CACHE_PAGES).then((c) => c.addAll(PRECACHE_PAGES)),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  const validCaches = [CACHE_STATIC, CACHE_PAGES];
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !validCaches.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Ignorer les appels Supabase et les API internes
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) return;

  // Assets _next/static → cache-first (immuables)
  if (url.pathname.startsWith('/_next/static')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Images statiques → cache-first
  if (
    url.pathname.startsWith('/icons') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname === '/logo.png'
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Pages HTML → stale-while-revalidate
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      caches.open(CACHE_PAGES).then((cache) =>
        cache.match(e.request).then((cached) => {
          const fetchPromise = fetch(e.request).then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }
});
