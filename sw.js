'use strict';

// Bump this whenever a cached file changes, or installed/offline clients keep the old version.
var CACHE_NAME = 'receipts-cache-v1';
var ASSETS = [
  './',
  'index.html',
  'new.html',
  'receipt.html',
  'style.css',
  'receipt.css',
  'storage.js',
  'calc.js',
  'pwa.js',
  'history.js',
  'form.js',
  'receipt-view.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-180.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (response) {
        var copy = response.clone();
        return caches.open(CACHE_NAME).then(function (cache) {
          return cache.put(event.request, copy).then(function () {
            return response;
          });
        });
      }).catch(function () {
        return cached;
      });
    })
  );
});
