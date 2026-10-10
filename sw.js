// Northstar service worker: installable app, push notifications, and offline start.
// Network first: online you always get the latest deploy; offline it falls back to the
// last copy it saw, so you can still open the app and log doors with no signal.
const CACHE = 'northstar-shell-v1';
const CACHEABLE = (url) =>
  (url.origin === self.location.origin && !url.pathname.startsWith('/api/')) ||
  url.hostname === 'cdn.jsdelivr.net' ||
  url.hostname === 'fonts.googleapis.com' ||
  url.hostname === 'fonts.gstatic.com';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!CACHEABLE(url)) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: url.origin === self.location.origin }).then((hit) => hit || caches.match('/')))
  );
});

self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { p = { body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(p.title || 'Northstar', {
      body: p.body || '',
      tag: p.tag,
      renotify: !!p.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: p.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
