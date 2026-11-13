const cacheName = 'dg-storeflow-v16';
const assetVersion = '20261112-2';
const appShell = [
  './',
  './index.html',
  `./styles.css?v=${assetVersion}`,
  `./board-layout.js?v=${assetVersion}`,
  `./operations.js?v=${assetVersion}`,
  `./sync-core.js?v=${assetVersion}`,
  `./app.js?v=${assetVersion}`,
  `./manifest.webmanifest?v=${assetVersion}`,
  `./planner-core.js?v=${assetVersion}`,
  `./planner-ui.js?v=${assetVersion}`,
  `./planner.css?v=${assetVersion}`,
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('dg-storeflow-') && key !== cacheName).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

const shellUrls = new Set(appShell.map((path) => new URL(path, self.registration.scope).href));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const appPage = event.request.mode === 'navigate' &&
    [new URL('./', self.registration.scope).pathname, new URL('./index.html', self.registration.scope).pathname].includes(url.pathname);
  if (!appPage && !shellUrls.has(url.href)) return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(appPage ? './index.html' : event.request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(appPage ? './index.html' : event.request).then((cached) => cached || Response.error()))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((clients) => {
    const app = clients.find((client) => client.url.startsWith(self.registration.scope));
    return app ? app.focus() : self.clients.openWindow(self.registration.scope);
  }));
});
