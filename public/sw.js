self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('landsafe-v1').then((cache) => cache.addAll([
      '/',
      '/offline',
      '/icon-192x192.png',
      '/icon-512x512.png',
    ]))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.filter((name) => name !== 'landsafe-v1').map((name) => caches.delete(name))
    ))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request).catch(() => caches.match('/offline')))
  );
});
