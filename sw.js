const CACHE_NAME = 'matrices-dirac-v5';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png',
    './icons/favicon-16.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Solo borrar cachés de esta propia app (por prefijo): no tocar las cachés
// del portal ni las de otras apps alojadas en subcarpetas del mismo dominio.
const esCachePropia = (c) => c.startsWith('matrices-dirac-');

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME && esCachePropia(k)).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Solo GET y solo peticiones dentro del propio scope (/MatricesDirac/):
    // no interfiere con angelmicelti.github.io ni con otros repos de GitHub Pages.
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith(self.registration.scope)) return;
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});
