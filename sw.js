/* MeryCon — service worker: funciona sin conexión.
   Al publicar cambios, sube el número de CACHE para que el iPhone descargue la versión nueva. */
const CACHE = 'merycon-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './app.css',
  './data.js', './core.js', './app.js', './views-hoy.js', './views-ejercicio.js', './views-evol.js', './views-ficha.js', './boot.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Red primero (para recibir actualizaciones), caché si no hay conexión
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
