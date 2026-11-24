// Mentor Desk service worker: offline app shell.
const CACHE = 'mentor-desk-202611242212';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isPage = req.mode === 'navigate';
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const key = isPage ? './index.html' : req;
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(key, r.clone()); return r; }).catch(() => hit);
    // pages: network first (gets updates), fall back to cache offline; assets: cache first
    if (isPage) return net.then(r => r || hit);
    return hit || net;
  }));
});
// Push from the Mentor Desk sender: the push carries no data, so ask the sender what is due and show it.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let items = [];
    try {
      const c = await caches.open('mentor-push-cfg');
      const r = await c.match(new URL('./push-cfg', self.registration.scope).href);
      const cfg = r ? await r.json() : null;
      if (cfg) {
        const res = await fetch(cfg.url + '/due', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cfg.id, secret: cfg.secret }) });
        if (res.ok) items = (await res.json()).items || [];
      }
    } catch (err) {}
    if (!items.length) items = [{ title: 'Mentor Desk', body: 'A task is due now. Tap to open.', k: 'due' }];
    for (const it of items.slice(0, 4)) {
      await self.registration.showNotification(it.title, { body: it.body || 'Tap to open Mentor Desk', tag: 'md-' + (it.k || Date.now()), renotify: true, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './#today' } });
    }
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./#today');
  }));
});
