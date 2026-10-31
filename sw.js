/* Service worker : appli disponible hors ligne, contenus mis à jour en arrière-plan. */
const VERSION = "rev-2026-10-31-12";
const SHELL = ["./", "index.html", "styles.css", "app.js", "config.js", "manifest.webmanifest", "catalogue.json",
  "icones/icone-192.png", "icones/icone-512.png", "icones/apple-touch-icon.png", "vendor/pdf.min.js", "vendor/pdf.worker.min.js"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(SHELL);
    // Pré-charge tous les contenus (sauf vidéos) pour pouvoir réviser sans réseau.
    try {
      const cat = await (await fetch("catalogue.json", { cache: "no-cache" })).json();
      const files = [];
      for (const m of cat.matieres) for (const ch of m.chapitres) for (const r of ch.ressources) if (r.fichier && !/\.(mp4|webm|m4v)$/i.test(r.fichier)) files.push(r.fichier);
      await Promise.all(files.map(f => c.add(f).catch(() => {})));
    } catch (err) {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== "rev-polices") await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (/\.(mp4|webm|m4v)$/i.test(url.pathname)) return;                 // vidéos : lecture directe (requêtes partielles)
  if (url.hostname.endsWith("supabase.co")) return;                     // synchro : jamais en cache
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("rev-polices").then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  const fresh = url.pathname.endsWith("catalogue.json") || url.pathname.endsWith(".json") || req.mode === "navigate";
  if (fresh) {
    // Réseau d'abord : les nouveaux contenus apparaissent dès l'ouverture.
    e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(VERSION).then(c => c.put(req, r.clone())); return r; })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? caches.match("index.html") : Response.error())));
    return;
  }
  // Le reste : cache d'abord, rafraîchi en arrière-plan.
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
