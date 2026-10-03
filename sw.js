// sw.js: the "service worker", a small helper the browser keeps running
// in the background for this site. It saves a copy of the game's files on
// the device so the game still opens with no internet connection.
// It never sees or stores anything about games: online play goes over a
// separate connection (a WebSocket) that doesn't pass through here.

// The name of the saved copy. Changing the version number makes browsers
// throw away the old copy and save a fresh one.
const CACHE_NAME = 'chesshire-cat-v12';
// The files to save: the page, the logo, and the app details
const ASSETS = [
  './',
  './index.html',
  './ChesshireCat.png',
  './manifest.webmanifest'
];

// First visit (or a new version of this file): save the files, and take
// over straight away instead of waiting for old tabs to close
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Once active: delete saved copies from older versions, and start looking
// after any open tabs of the game immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: always try to serve the freshest copy so page updates show
// up immediately, falling back to the cache when offline. Only this site's
// own files are cached; game traffic is a WebSocket and never passes here.
self.addEventListener('fetch', event => {
  // Only plain file downloads ("GET") from this same website are handled;
  // anything else is left to the browser as normal
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    // Try the internet first; if that works, update the saved copy too...
    fetch(event.request)
      .then(resp => {
        var respClone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        return resp;
      })
      // ...and if there's no connection, use the saved copy instead
      .catch(() => caches.match(event.request))
  );
});
