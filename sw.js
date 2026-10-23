// Service Worker de Konica Minolta Technical Station
// - La app (index.html) se busca primero en la red para recibir siempre la última versión de Netlify;
//   si no hay conexión, se usa la copia guardada.
// - La librería del CDN (SheetJS) tiene versión fija, así que se sirven desde la caché.
// Cambiar VERSION cuando se agreguen archivos nuevos a la lista de precarga.

const VERSION = "km-station-v3";

// Solo estos dominios se guardan en caché; el resto (por ejemplo Supabase) va siempre directo a la red
const CDN_CACHEABLES = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com"];

const PRECARGA = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-192.png",
    "./icons/icon-maskable-512.png",
    "./icons/apple-touch-icon.png",
    "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(VERSION)
            // Si un CDN falla no se bloquea la instalación: ese archivo se guardará en el primer uso.
            .then((cache) => Promise.allSettled(PRECARGA.map((url) => cache.add(url))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);

    // Páginas y archivos propios: red primero, caché como respaldo sin conexión
    if (req.mode === "navigate" || url.origin === self.location.origin) {
        event.respondWith(
            fetch(req)
                .then((resp) => {
                    if (resp.ok) {
                        const copia = resp.clone();
                        caches.open(VERSION).then((cache) => cache.put(req, copia));
                    }
                    return resp;
                })
                .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
        );
        return;
    }

    if (!CDN_CACHEABLES.includes(url.hostname)) return;

    // Librerías de CDN versionadas: caché primero
    event.respondWith(
        caches.match(req).then((guardado) => guardado || fetch(req).then((resp) => {
            if (resp.ok || resp.type === "opaque") {
                const copia = resp.clone();
                caches.open(VERSION).then((cache) => cache.put(req, copia));
            }
            return resp;
        }))
    );
});
