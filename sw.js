/* =========================================================================
   Service Worker — "La Obtención de las Matrices de Dirac"
   Alojada en: https://tecdea.github.io/matricesdirac/

   Este Service Worker queda estrictamente delimitado por su propio scope
   (la subcarpeta /matricesdirac/). NO intercepta, NO cachea y NO interfiere
   con:
     - el portal raíz https://tecdea.github.io/
     - otras apps alojadas en subcarpetas del mismo dominio
     - recursos de otros orígenes (CDN de Tailwind, MathJax, fuentes, etc.)
   ========================================================================= */

// Versión de la app: única fuente de verdad para el chip de la interfaz.
// Súbelas en cada despliegue (v6, v7, ...) para que los clientes se actualicen.
const VERSION = 'v1.6';
const CACHE_NAME = 'matrices-dirac-' + VERSION;

// Ámbito propio, resuelto a partir del registro de este Service Worker.
// En producción será https://tecdea.github.io/matricesdirac/
const SCOPE = new URL(self.registration.scope);

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
        caches.open(CACHE_NAME).then((cache) =>
            // Cacheo tolerante: si un recurso falta (p. ej. un icono), el SW
            // se instala igualmente en lugar de quedar inservible.
            Promise.allSettled(ASSETS.map((asset) => cache.add(asset)))
        )
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

// API de versión: la página envía { type: 'GET_VERSION' } y este SW responde
// con { type: 'VERSION', version } para alimentar el chip de la interfaz.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.source.postMessage({ type: 'VERSION', version: VERSION });
    }
});

// Una petición solo se gestiona si pertenece a esta app:
// mismo origen Y ruta dentro del propio scope (/matricesdirac/).
const esPeticionPropia = (url) =>
    url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Solo GET: este SW no toca ningún otro método HTTP.
    if (req.method !== 'GET') return;

    let url;
    try {
        url = new URL(req.url);
    } catch (e) {
        return;
    }

    // Ignorar siempre lo ajeno al propio scope: el portal raíz
    // tecdea.github.io, otras subcarpetas y otros orígenes (CDN).
    if (!esPeticionPropia(url)) return;

    // No interceptar el propio archivo sw.js: así la página y el navegador
    // siempre comprueban su versión real contra la red.
    if (url.pathname.endsWith('sw.js')) return;

    // Navegaciones: red primero (contenido siempre fresco) con respaldo en
    // caché para uso offline. Evita servir index.html desactualizado.
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const copia = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, copia)).catch(() => {});
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(req, { ignoreSearch: true })
                        .then((cached) => cached || caches.match('./index.html'))
                )
        );
        return;
    }

    // Resto de recursos del propio scope: caché primero, red como respaldo.
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                // Nunca cachear respuestas opacas, de error o de redirección.
                if (res && res.ok && res.type === 'basic') {
                    const copia = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, copia)).catch(() => {});
                }
                return res;
            });
        })
    );
});
