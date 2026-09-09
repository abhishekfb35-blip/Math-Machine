const CACHE_PREFIX = 'turtlelittle-';
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_ID__`;
const APP_SHELL_KEY = '/__app-shell__';

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function warmAppShell() {
  const cache = await caches.open(CACHE_NAME);

  try {
    const shellResponse = await fetch('/', { cache: 'no-store' });
    if (!shellResponse.ok) {
      throw new Error(`App shell request failed with ${shellResponse.status}`);
    }

    const shellHtml = await shellResponse.clone().text();
    const assetPaths = [...shellHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'))
      .map((url) => `${url.pathname}${url.search}`);

    const uniqueAssetPaths = [...new Set(assetPaths)];
    const warmedAssets = await Promise.all(
      uniqueAssetPaths.map(async (assetPath) => {
        const response = await fetch(assetPath, { cache: 'no-store' });
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || contentType.includes('text/html')) {
          throw new Error(`Invalid app asset response for ${assetPath}`);
        }
        return [assetPath, response];
      })
    );

    await cache.put(APP_SHELL_KEY, shellResponse);
    await Promise.all(
      warmedAssets.map(([assetPath, response]) => cache.put(assetPath, response))
    );
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    warmAppShell().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (url.origin !== self.location.origin) return;

  // API failures must reach the application as failures. Returning fabricated
  // empty data can make carts and catalogs appear to have been erased.
  if (url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL_KEY, clone))
            );
          }
          return response;
        })
        .catch(async () => {
          const fallback = await caches.match(APP_SHELL_KEY);
          return fallback || Response.error();
        })
    );
    return;
  }

  // Vite fingerprints production assets, so each URL uniquely identifies its
  // content and can safely be served cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            );
          }
          return response;
        });
      })
    );
  }
});
