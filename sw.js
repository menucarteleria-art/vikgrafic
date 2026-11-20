// Service worker: permite instalar la app y abrirla aunque no haya internet.
// Cuando cambies algo de la página, subí el número de versión para renovar la caché.
const CACHE = "vikgrafic-v4";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./nestor.html",
  "./juegos.js",
  "./manifest.webmanifest",
  "./img/publicidad-vikgrafic.webp",
  "./img/icons/icon-192.png",
  "./img/icons/icon-512.png",
  "./img/icons/apple-touch-icon.png",
  "./img/icons/favicon-32.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Estadísticas de Google: siempre por internet, nunca desde la caché.
  if (/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/.test(new URL(req.url).hostname)) return;

  // Páginas: primero internet (para ver siempre lo último), si no hay conexión, la copia guardada.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Resto (imágenes, Bootstrap, fuentes): primero la caché, si no está se descarga y se guarda.
  event.respondWith(
    caches.match(req).then(guardado => guardado || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
      }
      return res;
    }))
  );
});
