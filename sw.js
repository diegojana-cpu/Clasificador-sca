// Guarda la app en el teléfono para que abra sin señal. Las llamadas a Claude nunca pasan por la caché.
const CACHE = "clasificador-v8";
const ARCHIVOS = ["./", "index.html", "app.js", "vendor/anthropic.js", "manifest.webmanifest", "icono.svg", "icono-180.png", "icono-192.png", "icono-512.png",
  "semilla/base.json", "semilla/colombia-natural.jpg", "semilla/honduras-honey.jpg",
  "atlas/", "atlas/index.html", "atlas/fotos.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // Red primero (para recibir actualizaciones), caché si no hay señal.
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); } return r; })
    .catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match("index.html"))));
});
