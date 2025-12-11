// sw.js
const CACHE_NAME = 'chesshire-cat-v1';
const ASSETS = [
  './',
  './ChesshireCat.html',
  './ChesshireCat.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
