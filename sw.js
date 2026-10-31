/* Service worker : appli disponible hors ligne.
   Le code de l'appli (HTML, JS, CSS, JSON) est pris sur le réseau en priorité : une nouvelle version
   s'applique dès la réouverture. Les contenus lourds (PDF, images) restent en cache d'abord. */
const VERSION = "rev-2026-10-31-21";
const SHELL = ["./", "index.html", "styles.css", "app.js", "config.js", "manifest.webmanifest", "catalogue.json",
  "icones/icone-192.png", "icones/icone-512.png", "icones/apple-touch-icon.png", "vendor/pdf.min.js", "vendor/pdf.worker.min.js"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await Promise.all(SHELL.map(f => c.add(new Request(f, { cache: "reload" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

async function prechargerContenus() {
  // Tous les contenus (sauf vidéos) pour réviser sans réseau ; fait après l'activation, sans bloquer la mise à jour.
  try {
    const c = await caches.open(VERSION);
    const cat = await (await fetch("catalogue.json", { cache: "no-cache" })).json();
    const files = [];
    for (const m of cat.matieres) for (const ch of m.chapitres) for (const r of ch.ressources) if (r.fichier && !/\.(mp4|webm|m4v)$/i.test(r.fichier)) files.push(r.fichier);
    for (const f of files) { if (!(await c.match(f))) await c.add(f).catch(() => {}); }
  } catch (err) {}
}

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter(k => k !== VERSION && k !== "rev-polices");
    // récupère les contenus déjà téléchargés dans l'ancien cache avant de le supprimer
    const c = await caches.open(VERSION);
    for (const k of old) {
      try { const oc = await caches.open(k); for (const req of await oc.keys()) { if (!/\.(js|css|html|json|webmanifest)$|\/$/.test(new URL(req.url).pathname) && !(await c.match(req))) await c.put(req, await oc.match(req)); } } catch (err) {}
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
  prechargerContenus();
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

function reseauDabord(req) {
  return new Promise(resolve => {
    let fini = false;
    const repli = async () => { if (fini) return; const hit = await caches.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await caches.match("index.html") : null); if (hit && !fini) { fini = true; resolve(hit); } };
    const t = setTimeout(repli, 4000); // réseau trop lent : on sert la copie locale
    fetch(req, { cache: "no-cache" }).then(r => {
      clearTimeout(t);
      if (r.ok) { const copie = r.clone(); caches.open(VERSION).then(c => c.put(req, copie)); }
      if (!fini) { fini = true; resolve(r); }
    }).catch(async () => { clearTimeout(t); await repli(); if (!fini) { fini = true; resolve(Response.error()); } });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (/\.(mp4|webm|m4v)$/i.test(url.pathname)) return;                 // vidéos : lecture directe (requêtes partielles)
  if (url.hostname.endsWith("supabase.co")) return;                     // synchro, IA, voix : jamais en cache
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("rev-polices").then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  if (req.mode === "navigate" || /\.(js|css|json|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/")) {
    e.respondWith(reseauDabord(req));
    return;
  }
  // Contenus (PDF, images, médias) : cache d'abord, rafraîchi en arrière-plan.
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
