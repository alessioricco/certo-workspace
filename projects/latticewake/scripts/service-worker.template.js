const BUILD_ID = '__BUILD_ID__';
const ASSETS = [];
const scopePath = new URL(self.registration.scope).pathname;
const scopeKey = [...scopePath].map(character => (character.codePointAt(0) ?? 0).toString(16)).join('');
const cachePrefix = `latticewake-${scopeKey}-`;
const cacheName = `${cachePrefix}${BUILD_ID}`;
const assetUrls = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...assetUrls])));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(cacheName);
      return (await cache.match(new URL('index.html', scope))) ?? Response.error();
    }));
  } else if (assetUrls.has(url.href)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(request)) ?? fetch(request)));
  }
});
