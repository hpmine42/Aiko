const CACHE_PREFIX = 'aiko-shell-';
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_ID__`;
const PRECACHE_PATHS = __PRECACHE_PATHS__;
const SHELL_URL = new URL('./', self.registration.scope).href;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_PATHS.map((path) => new Request(new URL(path, self.registration.scope))));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const url = new URL(request.url);
    const immutableAsset = /\/assets\/[^/]+-[\w-]{6,}\.(?:js|css)$/.test(url.pathname);

    // Vite hashes these filenames, so a cached response can never shadow a
    // newer deployment. New HTML is always checked online first.
    if (immutableAsset) {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    }

    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return await cache.match(request)
          || await cache.match(SHELL_URL)
          || new Response('Aiko ist offline und konnte die App-Hülle nicht finden.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
