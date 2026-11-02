/* Service worker de l'atelier parents : réseau d'abord (toujours la dernière version), copie locale si pas de réseau. */
const VERSION = "atelier-2026-11-03-1";
self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k.startsWith("atelier-") && k !== VERSION) await caches.delete(k); await self.clients.claim(); })()); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: "no-cache" }).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; })
    .catch(async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await caches.match("./") : null) || Response.error()));
});
