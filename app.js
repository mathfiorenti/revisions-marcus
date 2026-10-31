/* Révisions Marcus — appli de révision installable (PWA).
   Contenus : catalogue.json + dossier contenus/. Progression : locale d'abord, synchronisée avec Supabase grâce au code famille. */
(function () {
"use strict";
const CFG = window.REV_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");

/* ---------------- utilitaires ---------------- */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style" && typeof v === "object") for (const [p, val] of Object.entries(v)) e.style.setProperty(p, val);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
function svg(name) { const w = document.createElement("span"); w.innerHTML = ICONS[name] || ICONS.doc; return w.firstChild; }
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function today() { return ymd(new Date()); }
function addDays(s, n) { const [y, m, d] = s.split("-").map(Number); return ymd(new Date(y, m - 1, d + n)); }
function frDate(s, opts) { return new Date(s + (s.length === 10 ? "T12:00" : "")).toLocaleDateString("fr-FR", opts || { weekday: "long", day: "numeric", month: "long" }); }
function plural(n, one, many) { return n + " " + (n > 1 ? (many || one + "s") : one); }
function shuffle(a) { a = a.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; }
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
let toastT;
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 3200); }
function isDark() { return document.documentElement.dataset.theme !== "light"; }
function subjColor(m) { return m ? (isDark() ? m.couleurNuit || m.couleur : m.couleur) : "var(--accent)"; }

/* ---------------- pictogrammes ---------------- */
const ICONS = {
  colonne: '<svg viewBox="0 0 24 24"><path d="M4 6.5 12 3l8 3.5M4.5 7h15M6 7v11M10 7v11M14 7v11M18 7v11M4 18h16M3 21h18"/></svg>',
  plume: '<svg viewBox="0 0 24 24"><path d="M20 4C11 4 6 10 5 19M20 4c0 7-4 11-11 12M5 19l-1.5 1.5M9 10h5"/></svg>',
  graphique: '<svg viewBox="0 0 24 24"><path d="M4 20V4M4 20h16M8 16l3.5-4 3 2.5L20 8"/><circle cx="20" cy="8" r="1"/></svg>',
  compas: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="1.6"/><path d="M11 6 6 20M13 6l5 14M8.2 14h7.6"/></svg>',
  fiole: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5.2 9A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3L14 9V3M7.5 15h9"/></svg>',
  feuille: '<svg viewBox="0 0 24 24"><path d="M5 19c0-9 5-14 15-15-1 10-6 15-15 15ZM5 19l7-7"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5Z"/></svg>',
  bulle: '<svg viewBox="0 0 24 24"><path d="M4 5h16v10H10l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/></svg>',
  fiche: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/></svg>',
  flashcards: '<svg viewBox="0 0 24 24"><rect x="3.5" y="6.5" width="13" height="13.5" rx="2"/><path d="M7.5 6.5V5a1.8 1.8 0 0 1 1.8-1.8H19a1.5 1.5 0 0 1 1.5 1.5V15a1.8 1.8 0 0 1-1.8 1.8h-2.2"/></svg>',
  quiz: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.6M12 16.8v.2"/></svg>',
  animation: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="m10 9 5 3-5 3z"/></svg>',
  entrainement: '<svg viewBox="0 0 24 24"><path d="M5 20h14M7 16.5l9.5-9.5 2 2L9 18.5H7z"/><path d="M14.5 9l2 2"/></svg>',
  corrige: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="m9 13 2.2 2.2L16 10.5"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H4.5A1.5 1.5 0 0 1 3 15.5v-5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17"/><path d="M7 14h10v7H7z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3M8 7l4-4 4 4M5 11v8.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V11"/></svg>',
  zoom: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M10.5 8v5M8 10.5h5"/></svg>',
  speak: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>'
};
const KIND = {
  fiche: { label: "Fiche", icon: "fiche", verbe: "Lire" },
  flashcards: { label: "Flashcards", icon: "flashcards", verbe: "Réviser" },
  quiz: { label: "Quiz", icon: "quiz", verbe: "Jouer" },
  animation: { label: "Fiche animée", icon: "animation", verbe: "Regarder" },
  entrainement: { label: "Entraînement", icon: "entrainement", verbe: "S'entraîner" },
  corrige: { label: "Corrigé", icon: "corrige", verbe: "Lire" },
  video: { label: "Vidéo", icon: "video", verbe: "Regarder" }
};

/* ---------------- données ---------------- */
const S = { cat: null, matieres: [], byRes: {}, decks: {}, cards: {}, loaded: false };
async function loadCatalogue() {
  let cat;
  try { cat = await (await fetch("catalogue.json", { cache: "no-cache" })).json(); }
  catch (e) { cat = lsGet("rev.cat", null); if (!cat) throw e; }
  lsSet("rev.cat", cat);
  S.cat = cat; S.matieres = cat.matieres;
  for (const m of cat.matieres) for (const c of m.chapitres) for (const r of c.ressources) S.byRes[r.id] = { r, c, m };
  const fcs = Object.values(S.byRes).filter(x => x.r.type === "flashcards");
  await Promise.all(fcs.map(async ({ r, c, m }) => {
    try {
      const d = await (await fetch(r.fichier)).json();
      for (const [id, dk] of Object.entries(d.decks)) S.decks[id] = { id, ...dk, matiere: m, chapitre: c, res: r };
      for (const card of d.cards) S.cards[card.id] = card;
    } catch (e) { console.warn("flashcards", r.fichier, e); }
  }));
  S.loaded = true;
}

/* ---------------- progression locale + synchro ---------------- */
const P = Object.assign({ cards: {}, days: {}, seen: {}, sessions: [] }, lsGet("rev.progress", {}));
const SYNC = { code: lsGet("rev.code", ""), state: "off", last: lsGet("rev.lastSync", null), timer: null, busy: false };
const DEVICE = (() => { const u = navigator.userAgent; return /iPad|Macintosh.*Mobile|Macintosh/.test(u) && navigator.maxTouchPoints > 1 ? "iPad" : /iPhone/.test(u) ? "iPhone" : /Android/.test(u) ? "Android" : "Ordinateur"; })();
function saveLocal() { lsSet("rev.progress", P); scheduleSync(); }
function markSeen(id) { P.seen[id] = Date.now(); saveLocal(); }
function merge(remote) {
  if (!remote) return false;
  let changed = false;
  for (const [id, rc] of Object.entries(remote.cards || {})) { const lc = P.cards[id]; if (!lc || (rc.ts || 0) > (lc.ts || 0)) { P.cards[id] = rc; changed = true; } }
  for (const [d, n] of Object.entries(remote.days || {})) if ((P.days[d] || 0) < n) { P.days[d] = n; changed = true; }
  for (const [id, t] of Object.entries(remote.seen || {})) if ((P.seen[id] || 0) < t) { P.seen[id] = t; changed = true; }
  const have = new Set(P.sessions.map(s => s.id));
  for (const s of remote.sessions || []) if (!have.has(s.id)) { P.sessions.push(s); changed = true; }
  P.sessions.sort((a, b) => a.t - b.t); if (P.sessions.length > 300) P.sessions = P.sessions.slice(-300);
  return changed;
}
async function rpc(fn, body) {
  const r = await fetch(CFG.supabaseUrl + "/rest/v1/rpc/" + fn, { method: "POST", headers: { "Content-Type": "application/json", apikey: CFG.supabaseKey, Authorization: "Bearer " + CFG.supabaseKey }, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); const err = new Error(t); err.status = r.status; err.badCode = /code invalide/.test(t); throw err; }
  return r.json();
}
async function syncNow(opts) {
  if (!SYNC.code || SYNC.busy || !navigator.onLine) { if (!navigator.onLine && SYNC.code) SYNC.state = "offline"; return; }
  SYNC.busy = true;
  try {
    const remote = await rpc("lire_progression", { code: SYNC.code, p_profil: CFG.profil });
    if (remote && remote.donnees) merge(remote.donnees);
    lsSet("rev.progress", P);
    await rpc("ecrire_progression", { code: SYNC.code, p_donnees: P, p_appareil: DEVICE, p_profil: CFG.profil });
    SYNC.state = "ok"; SYNC.last = Date.now(); lsSet("rev.lastSync", SYNC.last); SYNC.lastRemote = remote;
    if (opts && opts.rerender) render();
  } catch (e) {
    SYNC.state = e.badCode ? "badcode" : "error";
  } finally { SYNC.busy = false; }
}
function scheduleSync() { clearTimeout(SYNC.timer); SYNC.timer = setTimeout(syncNow, 2500); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { clearTimeout(SYNC.timer); syncNow(); } else syncNow({ rerender: !sess }); });
addEventListener("online", () => syncNow());

/* ---------------- flashcards : répétition espacée ---------------- */
const INT = [0, 1, 2, 4, 8, 16, 30], NEW_PER_DAY = 15, MAX_SESSION = 40, MASTER = 4;
function deckOf(c) { return S.decks[c.deck] || { titre: c.deck, ordre: 99 }; }
function sortedCards(filter) { return Object.values(S.cards).filter(c => !filter || filter(c)).sort((a, b) => (deckOf(a).ordre || 99) - (deckOf(b).ordre || 99) || String(a.deck).localeCompare(String(b.deck)) || (a.n || 0) - (b.n || 0)); }
function pc(id) { return P.cards[id]; }
function dueList(f) { const t = today(); return sortedCards(f).filter(c => { const p = pc(c.id); return p && p.l && p.d && p.d <= t; }); }
function newToday() { const t = today(); return Object.values(P.cards).filter(p => p.f === t).length; }
function newList(f) { const left = Math.max(0, NEW_PER_DAY - newToday()); return sortedCards(f).filter(c => !pc(c.id) || !pc(c.id).l).slice(0, left); }
function streak() { let d = today(); if (!P.days[d]) d = addDays(d, -1); let n = 0; while (P.days[d]) { n++; d = addDays(d, -1); } return n; }
function mastered(f) { return sortedCards(f).filter(c => (pc(c.id) || {}).b >= MASTER).length; }
function notionStats() {
  const m = {};
  for (const c of Object.values(S.cards)) { const p = pc(c.id); if (!p) continue; const k = c.notion || "Divers"; const o = m[k] || (m[k] = { notion: k, deck: deckOf(c), ok: 0, ko: 0, mid: 0 }); o.ok += p.ok || 0; o.ko += p.ko || 0; o.mid += p.mid || 0; }
  return Object.values(m).map(o => { const n = o.ok + o.ko + o.mid; return { ...o, n, rate: n ? (o.ok + o.mid * .5) / n : 1 }; }).filter(o => o.n >= 3 && o.rate < .75).sort((a, b) => a.rate - b.rate);
}

/* ---------------- petits composants animés ---------------- */
function ring(pct, size, label, color) {
  const r = 18, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, pct)));
  const ns = "http://www.w3.org/2000/svg", el = document.createElementNS(ns, "svg");
  el.setAttribute("viewBox", "0 0 44 44"); el.setAttribute("width", size); el.setAttribute("height", size); el.setAttribute("class", "ring"); el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<circle class="bg" cx="22" cy="22" r="18"/><circle class="fg" cx="22" cy="22" r="18" style="--c:' + c.toFixed(2) + ';--off:' + off.toFixed(2) + (color ? ';stroke:' + color : '') + '"/>';
  return h("span", { class: "ring-wrap", style: { width: size + "px", height: size + "px" } }, el, label != null ? h("span", { class: "lbl" }, label) : null);
}
function countUp(el, n, ms) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || n < 2) { el.textContent = n; return el; }
  const t0 = performance.now(), d = ms || 700; el.textContent = "0";
  const step = t => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(n * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step); return el;
}
function flame(n) {
  const ico = '<svg viewBox="0 0 24 24"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.4 1.2-3.9 2.4-5 .1 1.6.8 2.6 1.8 3 .2-3.4.6-6.3.8-9Z"/></svg>';
  const s = h("span", { class: "flame" + (n ? "" : " off"), title: "Jours d'affilée" }); s.innerHTML = ico; s.append(n ? plural(n, "jour") + " d'affilée" : "Lance ta série"); return s;
}
function scopeFilter(q) {
  const d = q.get("deck"), c = q.get("c"), m = q.get("m");
  if (d) return x => x.deck === d;
  if (c) return x => deckOf(x).chapitre && deckOf(x).chapitre.id === c;
  if (m) return x => deckOf(x).matiere && deckOf(x).matiere.id === m;
  return null;
}
function scopeInfo(q) {
  const d = q.get("deck"), c = q.get("c"), m = q.get("m");
  if (d && S.decks[d]) return { titre: S.decks[d].titre, back: "#/cartes/" + S.decks[d].matiere.id + "?c=" + S.decks[d].chapitre.id };
  if (c) { const dk = Object.values(S.decks).find(x => x.chapitre.id === c); if (dk) return { titre: dk.chapitre.titre, back: "#/cartes/" + dk.matiere.id + "?c=" + c }; }
  if (m) { const mm = S.matieres.find(x => x.id === m); if (mm) return { titre: mm.nom, back: "#/cartes/" + m }; }
  return { titre: "Cartes du jour", back: "#/cartes" };
}
function decksOf(m) { return Object.values(S.decks).filter(d => d.matiere.id === m.id); }
function chapStats(f) { const cs = sortedCards(f), n = cs.length; return { n, m: cs.filter(c => (pc(c.id) || {}).b >= MASTER).length, seen: cs.filter(c => (pc(c.id) || {}).l).length, due: dueList(f).length }; }
function stag(nodes) { nodes.forEach((n, i) => n && n.style && n.style.setProperty("--i", i)); return nodes; }

/* ---------------- routeur ---------------- */
let sess = null, cleanup = null;
function route() { const raw = location.hash.replace(/^#\/?/, ""); const [path, qs] = raw.split("?"); return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || "") }; }
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
addEventListener("hashchange", render);
function setTab(name) { for (const a of document.querySelectorAll(".tabbar a")) { if (a.dataset.tab === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); } }
function render() {
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  document.body.classList.remove("immersive");
  if (!S.loaded) { app.replaceChildren(h("div", { class: "loading" }, "Chargement…")); return; }
  const { parts, q } = route();
  const v = parts[0] || "";
  if (v !== "session") { sess = null; hush(); }
  let view;
  if (v === "") { setTab("accueil"); view = vHome(); }
  else if (v === "m") { setTab("accueil"); view = vSubject(parts[1]); }
  else if (v === "r") { view = vResource(parts[1]); if (!view) return; }
  else if (v === "cartes") { setTab("cartes"); view = parts[1] ? vCardsSubject(parts[1], q.get("c")) : vCards(); }
  else if (v === "session") { setTab("cartes"); view = vSession(q); }
  else if (v === "ajouter") { setTab("accueil"); view = vAdd(q.get("m")); }
  else if (v === "suivi") { setTab("suivi"); view = vStats(); }
  else if (v === "reglages") { setTab("reglages"); view = vSettings(); }
  else { setTab("accueil"); view = vHome(); }
  app.replaceChildren(view);
  if (v !== "r") window.scrollTo({ top: 0 });
}
function topbar(label, href) {
  return h("div", { class: "topbar" }, h("button", { class: "back", onclick: () => (history.length > 1 && !href ? history.back() : go(href || "#/")) }, svg("back"), label || "Retour"));
}

/* ---------------- vues ---------------- */
function greeting() { const hr = new Date().getHours(); return hr < 5 ? "Encore debout" : hr < 12 ? "Bonjour" : hr < 18 ? "Salut" : "Bonsoir"; }
function counts(m) { let n = 0; for (const c of m.chapitres) n += c.ressources.length; return n; }
function isNew(dateStr) { return dateStr && dateStr >= addDays(today(), -7); }

function vHome() {
  const due = dueList().length, nw = newList().length, todo = Math.min(MAX_SESSION, due + nw), total = Object.keys(S.cards).length;
  const doneToday = P.days[today()] || 0, goal = doneToday + todo;
  const st = streak();
  const n = h("span");
  const todayBox = h("section", { class: "today" },
    ring(goal ? doneToday / goal : (total ? 1 : 0), 96, todo ? countUp(n, todo) : "✓"),
    h("div", { class: "txt" },
      h("div", { class: "big" }, todo === 0 ? (total ? (doneToday ? "Bravo, tout est revu pour aujourd'hui !" : "Rien à revoir aujourd'hui") : "Pas encore de cartes") : (todo > 1 ? "cartes au programme aujourd'hui" : "carte au programme aujourd'hui")),
      h("div", { class: "stats" }, nw ? h("span", null, h("strong", null, nw), " nouvelle" + (nw > 1 ? "s" : "")) : null, due ? h("span", null, h("strong", null, due), " à revoir") : null, h("span", null, h("strong", null, mastered()), " / " + total + " maîtrisées"))),
    h("div", { class: "actions" }, h("button", { class: "btn", disabled: !todo, onclick: () => go("#/session?mode=jour") }, due && !nw ? "Réviser mes cartes" : nw && !due ? "Découvrir les nouvelles cartes" : "C'est parti")));
  const grid = h("div", { class: "subjects stagger" }, stag(S.matieres.map(m => {
    const nb = counts(m), recent = m.chapitres.some(c => isNew(c.ajoute)), dks = decksOf(m);
    const stt = dks.length ? chapStats(c => deckOf(c).matiere.id === m.id) : null;
    return h("a", { class: "subject" + (nb ? "" : " empty"), href: "#/m/" + m.id, style: { "--subj": subjColor(m) } },
      h("span", { class: "top" }, h("span", { class: "pic" }, svg(m.pictogramme)), recent ? h("span", { class: "new" }, "Nouveau") : stt && stt.n ? ring(stt.m / stt.n, 40, Math.round(stt.m / stt.n * 100) + "%") : null),
      h("h3", null, m.nom),
      h("span", { class: "meta" }, nb ? plural(m.chapitres.length, "chapitre") + " · " + plural(nb, "support") + (stt && stt.due ? " · " + stt.due + " cartes à revoir" : "") : "Bientôt"));
  })));
  const recents = [];
  for (const m of S.matieres) for (const c of m.chapitres) for (const r of c.ressources) if (r.type !== "video") recents.push({ m, c, r });
  recents.sort((a, b) => (b.c.ajoute || "").localeCompare(a.c.ajoute || ""));
  const unseen = recents.filter(x => !P.seen[x.r.id]).slice(0, 4);
  return h("div", { class: "view" }, ...stag([
    h("header", { class: "hello" }, h("div", null, h("div", { class: "eyebrow" }, frDate(today())), h("h1", null, greeting() + " " + (CFG.prenom || ""))), flame(st)),
    todayBox,
    addCta(),
    h("section", { class: "sec" }, h("div", { class: "sec-head" }, h("h2", null, "Tes matières")), grid),
    unseen.length ? h("section", { class: "sec" }, h("div", { class: "sec-head" }, h("h2", null, "À découvrir")),
      h("div", { class: "feed" }, unseen.map(({ m, c, r }) => h("a", { href: "#/r/" + r.id, style: { "--subj": subjColor(m) } },
        h("span", { class: "ico" }, svg(KIND[r.type].icon)),
        h("span", null, h("div", { class: "t" }, r.titre), h("div", { class: "s" }, m.nom + " · " + c.titre)), svg("chev"))))) : null
  ]));
}

function resTile(r, m) {
  const k = KIND[r.type] || KIND.fiche;
  return h("a", { class: "res" + (P.seen[r.id] ? " done" : ""), href: "#/r/" + r.id, style: { "--kind": r.type === "corrige" ? "var(--muted)" : subjColor(m) } },
    h("span", { class: "seen", title: "Pas encore ouvert" }),
    h("span", { class: "ico" }, svg(k.icon)),
    h("span", null, h("span", { class: "kind-label" }, k.label), h("div", { class: "t" }, r.titre)),
    h("span", { class: "s" }, r.detail || ""));
}
function vSubject(id) {
  const m = S.matieres.find(x => x.id === id);
  if (!m) return vHome();
  const col = subjColor(m);
  const body = m.chapitres.length ? [...m.chapitres].reverse().map(c => {
    const main = c.ressources.filter(r => r.type !== "video"), vids = c.ressources.filter(r => r.type === "video");
    return h("section", { class: "chapter", style: { "--subj": col } },
      h("div", { class: "chapter-head" }, h("span", { class: "eyebrow" }, isNew(c.ajoute) ? "Nouveau · ajouté le " + frDate(c.ajoute, { day: "numeric", month: "long" }) : "Chapitre"), h("h2", null, c.titre), c.sousTitre ? h("span", { class: "small" }, c.sousTitre) : null),
      h("div", { class: "res-grid" }, main.map(r => resTile(r, m))),
      vids.length ? [h("div", { class: "subhead" }, "Vidéos"), h("div", { class: "videos" }, vids.map(r => resTile(r, m)))] : null);
  }) : [h("div", { class: "empty-box" }, h("strong", null, "Rien pour l'instant"), "Les fiches, cartes et quiz de " + m.nom + " apparaîtront ici dès qu'un chapitre sera ajouté.")];
  return h("div", { class: "view", style: { "--subj": col } },
    ...stag([topbar("Accueil", "#/"),
    h("header", { class: "subj-hero" }, h("span", { class: "pic" }, svg(m.pictogramme)), h("div", { class: "grow" }, h("div", { class: "eyebrow" }, "Seconde"), h("h1", null, m.nom)),
      decksOf(m).length ? h("a", { class: "btn tint", href: "#/cartes/" + m.id }, svg("flashcards"), "Cartes") : null),
    ...body, addCta(m.id)]));
}

/* ---------------- lecteur ---------------- */
function vResource(id) {
  const x = S.byRes[id];
  if (!x) return vHome();
  const { r, m } = x;
  if (r.type === "flashcards") { location.replace("#/cartes/" + m.id + "?c=" + encodeURIComponent(x.c.id)); return null; }
  markSeen(r.id);
  document.body.classList.add("immersive");
  const back = () => (history.length > 1 ? history.back() : go("#/m/" + m.id));
  const bar = h("div", { class: "reader-bar" }, h("button", { class: "icon-btn", onclick: back, "aria-label": "Retour" }, svg("back"), h("span", { class: "lbl" }, m.nom)), h("div", { class: "ttl" }, r.titre));
  const body = h("div", { class: "reader-body" });
  const wrap = h("div", { class: "reader", style: { "--subj": subjColor(m) } }, bar, body);
  const url = r.fichier;
  if (/\.pdf$/i.test(url)) {
    let zoom = 0;
    const pages = h("div", { class: "pages zoom-0" }, h("div", { class: "loading" }, "Ouverture de la fiche…"));
    bar.append(
      h("button", { class: "icon-btn", onclick: () => { zoom = 1 - zoom; pages.className = "pages zoom-" + zoom; if (pages._redraw) setTimeout(pages._redraw, 50); } }, svg("zoom"), h("span", { class: "lbl" }, "Zoom")),
      h("button", { class: "icon-btn", onclick: () => sharePdf(url, r.titre) }, svg("print"), h("span", { class: "lbl" }, "Imprimer")));
    body.append(pages);
    renderPdf(url, pages);
  } else if (/\.html?$/i.test(url)) {
    bar.append(h("button", { class: "icon-btn", onclick: () => { const f = body.querySelector("iframe"); if (f && f.requestFullscreen) f.requestFullscreen().catch(() => {}); else window.open(url, "_blank"); } }, svg("expand"), h("span", { class: "lbl" }, "Plein écran")));
    body.append(h("iframe", { src: url, title: r.titre, allow: "fullscreen; autoplay", allowfullscreen: true }));
  } else if (/\.(mp4|webm|m4v)$/i.test(url)) {
    body.style.background = "#000";
    body.append(h("video", { src: url, controls: true, playsinline: true, autoplay: true, preload: "metadata" }));
  }
  return wrap;
}
let pdfLib = null;
function loadPdfLib() {
  if (pdfLib) return pdfLib;
  pdfLib = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/pdf.min.js"; s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js"; res(window.pdfjsLib); }; s.onerror = rej; document.head.append(s); });
  return pdfLib;
}
async function renderPdf(url, box) {
  let cancelled = false, io = null;
  cleanup = () => { cancelled = true; if (io) io.disconnect(); };
  try {
    const lib = await loadPdfLib();
    const doc = await lib.getDocument({ url, isEvalSupported: false }).promise;
    if (cancelled) return;
    box.replaceChildren();
    const first = await doc.getPage(1), ratio = first.getViewport({ scale: 1 }).height / first.getViewport({ scale: 1 }).width;
    const slots = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const slot = h("div", { class: "pg", style: { "aspect-ratio": "1 / " + ratio.toFixed(4) }, "data-n": i, role: "img", "aria-label": "Page " + i + " sur " + doc.numPages }, h("span", { class: "pg-n" }, i));
      box.append(slot); slots.push(slot);
    }
    const draw = async slot => {
      if (slot.dataset.state) return; slot.dataset.state = "drawing";
      const page = await doc.getPage(+slot.dataset.n); if (cancelled) return;
      const base = page.getViewport({ scale: 1 }), dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.min(slot.clientWidth * dpr, 1800);
      const vp = page.getViewport({ scale: w / base.width });
      const cv = h("canvas", { width: Math.floor(vp.width), height: Math.floor(vp.height) });
      await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      if (cancelled || slot.dataset.state !== "drawing") { cv.width = cv.height = 0; return; }
      slot.replaceChildren(cv); slot.dataset.state = "done";
    };
    const free = slot => { const cv = slot.querySelector("canvas"); if (cv) { cv.width = cv.height = 0; slot.replaceChildren(h("span", { class: "pg-n" }, slot.dataset.n)); } delete slot.dataset.state; };
    io = new IntersectionObserver(es => { for (const e of es) { if (e.isIntersecting) draw(e.target); else if (Math.abs(e.boundingClientRect.top) > innerHeight * 4) free(e.target); } }, { root: box.closest(".reader-body"), rootMargin: "150% 0px" });
    slots.forEach(s => io.observe(s));
    box._redraw = () => slots.forEach(s => { free(s); io.unobserve(s); io.observe(s); });
  } catch (e) {
    box.replaceChildren(h("div", { class: "loading" }, "Impossible d'afficher la fiche ici. ", h("a", { href: url, target: "_blank" }, "Ouvrir le PDF")));
  }
}
async function sharePdf(url, title) {
  try {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], (title || "fiche") + ".pdf", { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  window.open(url, "_blank");
}

/* ---------------- flashcards : écrans ---------------- */
let fcMode = lsGet("rev.fcMode", "oral");
function modesBox() {
  return h("div", { class: "modes", role: "radiogroup", "aria-label": "Mode de révision" },
    [["oral", "Réponse orale", "Tu réponds à voix haute, l'appli te corrige et te lit la correction"], ["rapide", "Révision rapide", "Dans ta tête, tu retournes, tu te notes"], ["ecrite", "Réponse écrite", "Tu écris, puis tu compares à la carte"]].map(([md, t, d]) => h("button", { class: "mode", role: "radio", "aria-checked": fcMode === md ? "true" : "false", onclick: e => { fcMode = md; lsSet("rev.fcMode", md); for (const b of e.currentTarget.parentNode.children) b.setAttribute("aria-checked", b === e.currentTarget ? "true" : "false"); } },
      md === "oral" ? [svg("mic"), t] : t, h("small", null, d))));
}
function vCards() {
  const due = dueList().length, nw = newList().length, todo = Math.min(MAX_SESSION, due + nw);
  const doneToday = P.days[today()] || 0, n = h("span");
  const mats = S.matieres.filter(m => decksOf(m).length);
  const ns = notionStats().slice(0, 6);
  return h("div", { class: "view" }, ...stag([
    h("header", null, h("div", { class: "eyebrow" }, "Flashcards"), h("h1", null, "Tes cartes")),
    h("section", { class: "today" },
      ring(doneToday + todo ? doneToday / (doneToday + todo) : 1, 80, todo ? countUp(n, todo) : "✓"),
      h("div", { class: "txt" }, h("div", { class: "big" }, todo ? "Les cartes du jour, toutes matières" : "Rien à revoir aujourd'hui"), h("div", { class: "small" }, "Un mélange des cartes à revoir et de nouvelles cartes.")),
      modesBox(),
      h("div", { class: "actions" }, h("button", { class: "btn", disabled: !todo, onclick: () => go("#/session?mode=jour") }, "Commencer"))),
    h("section", { class: "sec" }, h("div", { class: "sec-head" }, h("h2", null, "Par matière")),
      mats.length ? h("div", { class: "sec stagger", style: { gap: "10px" } }, stag(mats.map(m => {
        const st = chapStats(c => deckOf(c).matiere.id === m.id), nch = new Set(decksOf(m).map(d => d.chapitre.id)).size;
        return h("a", { class: "mat-card", href: "#/cartes/" + m.id, style: { "--subj": subjColor(m) } },
          h("span", { class: "pic" }, svg(m.pictogramme)),
          h("span", null, h("h3", null, m.nom), h("div", { class: "meta" }, plural(nch, "chapitre") + " · " + plural(st.n, "carte") + " · " + st.m + " maîtrisée" + (st.m > 1 ? "s" : "")), st.due ? h("span", { class: "due-pill" }, st.due + " à revoir") : null),
          ring(st.n ? st.m / st.n : 0, 52, (st.n ? Math.round(st.m / st.n * 100) : 0) + "%"));
      }))) : h("div", { class: "empty-box" }, h("strong", null, "Pas encore de cartes"), "Les flashcards arrivent ici à chaque nouveau chapitre.")),
    h("section", { class: "sec" }, h("div", { class: "sec-head" }, h("h2", null, "Notions à retravailler")),
      ns.length ? h("ul", { class: "notions" }, ns.map(o => h("li", null, h("span", { class: "nm" }, o.notion), h("span", { class: "rate" + (o.rate >= .5 ? " mid" : "") }, Math.round(o.rate * 100) + " %"), h("span", { class: "sub" }, (o.deck.matiere ? o.deck.matiere.nom + " · " : "") + o.n + " réponses, " + o.ko + " ratée" + (o.ko > 1 ? "s" : "")))))
        : h("div", { class: "empty-box" }, h("strong", null, "Rien à signaler"), "Après quelques révisions, les notions qui résistent apparaissent ici."))
  ]));
}
function vCardsSubject(mid, focus) {
  const m = S.matieres.find(x => x.id === mid);
  if (!m) return vCards();
  const col = subjColor(m), dks = decksOf(m);
  const chaps = []; for (const d of dks) if (!chaps.find(c => c.id === d.chapitre.id)) chaps.push(d.chapitre);
  chaps.sort((a, b) => (b.ajoute || "").localeCompare(a.ajoute || ""));
  const all = chapStats(c => deckOf(c).matiere.id === m.id);
  const view = h("div", { class: "view", style: { "--subj": col } }, ...stag([
    topbar("Cartes", "#/cartes"),
    h("header", { class: "subj-hero" }, h("span", { class: "pic" }, svg(m.pictogramme)), h("div", { class: "grow" }, h("div", { class: "eyebrow" }, "Flashcards"), h("h1", null, m.nom), h("div", { class: "small" }, plural(all.n, "carte") + " · " + all.m + " maîtrisée" + (all.m > 1 ? "s" : ""))), ring(all.n ? all.m / all.n : 0, 60, (all.n ? Math.round(all.m / all.n * 100) : 0) + "%")),
    h("section", { class: "card", style: { gap: "10px" } }, h("div", { class: "small", style: { fontWeight: 700, color: "var(--ink)" } }, "Mode de révision"), modesBox()),
    ...chaps.map(ch => {
      const f = c => deckOf(c).chapitre.id === ch.id, st = chapStats(f);
      const parts = dks.filter(d => d.chapitre.id === ch.id).sort((a, b) => (a.ordre || 99) - (b.ordre || 99));
      return h("section", { class: "chap-card" + (focus === ch.id ? " focus" : ""), id: "chap-" + ch.id },
        h("div", { class: "chap-top" }, h("div", null, h("div", { class: "eyebrow" }, isNew(ch.ajoute) ? "Nouveau chapitre" : "Chapitre"), h("h2", null, ch.titre), h("div", { class: "deck-meta", style: { marginTop: "4px" } }, st.n + " cartes · " + st.m + " maîtrisées · " + (st.seen - st.m) + " en cours · " + (st.n - st.seen) + " nouvelles")), ring(st.n ? st.m / st.n : 0, 54, (st.n ? Math.round(st.m / st.n * 100) : 0) + "%")),
        h("div", { class: "chap-actions" },
          h("button", { class: "btn", onclick: () => go("#/session?mode=jour&c=" + encodeURIComponent(ch.id)) }, st.due ? "Réviser (" + st.due + " à revoir)" : "Réviser ce chapitre"),
          h("button", { class: "btn tint", onclick: () => go("#/session?mode=chapitre&c=" + encodeURIComponent(ch.id)) }, "Veille d'interro · tout")),
        parts.length > 1 ? h("div", { class: "parts" }, parts.map(d => {
          const s2 = chapStats(c => c.deck === d.id);
          return h("div", { class: "part" },
            h("div", { class: "part-main" }, h("span", { class: "t" }, d.titre), d.sousTitre ? h("span", { class: "small" }, d.sousTitre) : null,
              h("div", { class: "meter" }, h("i", { class: "m", style: { width: (s2.n ? s2.m / s2.n * 100 : 0) + "%" } }), h("i", { class: "p", style: { width: (s2.n ? (s2.seen - s2.m) / s2.n * 100 : 0) + "%" } })),
              h("div", { class: "deck-meta" }, s2.n + " cartes" + (s2.due ? " · " + s2.due + " à revoir" : ""))),
            h("button", { class: "btn quiet", onclick: () => go("#/session?mode=chapitre&deck=" + encodeURIComponent(d.id)) }, "Juste cette partie"));
        })) : null);
    })
  ]));
  if (focus) setTimeout(() => { const el = document.getElementById("chap-" + focus); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 120);
  return view;
}

function vSession(q) {
  const mode = q.get("mode") || "jour", info = scopeInfo(q);
  if (!sess || sess.key !== location.hash) {
    const f = scopeFilter(q);
    let queue;
    if (mode === "chapitre") queue = shuffle(sortedCards(f).map(c => c.id));
    else { const due = shuffle(dueList(f).map(c => c.id)), nw = newList(f).map(c => c.id); queue = []; let i = 0, j = 0; while (i < due.length || j < nw.length) { if (i < due.length) queue.push(due[i++]); if (i < due.length) queue.push(due[i++]); if (j < nw.length) queue.push(nw[j++]); } queue = queue.slice(0, MAX_SESSION); }
    if (!queue.length) { setTimeout(() => { toast("Rien à revoir ici aujourd'hui. Essaie la veille d'interro."); go(info.back); }, 0); return h("div"); }
    sess = { key: location.hash, mode, titre: info.titre, back: info.back, queue, i: 0, res: { ok: 0, mid: 0, ko: 0 }, missed: [], again: {}, start: Date.now() };
  }
  document.body.classList.add("immersive");
  const el = {};
  const wrap = h("div", { class: "view fc-wrap" },
    h("div", { class: "topbar" }, h("button", { class: "back", onclick: () => quit() }, svg("back"), "Quitter"), el.track = h("div", { class: "track" }, h("i")), el.count = h("span", { class: "count" })),
    h("div", { class: "stage" }, el.flash = h("div", { class: "flash", role: "button", tabindex: "0", "aria-label": "Retourner la carte", onclick: () => flip() },
      h("div", { class: "face front" }, h("div", { class: "face-top" }, el.chipF = h("span", { class: "chip" }), el.notF = h("span", { class: "notion" })), el.recto = h("p", { class: "recto" }), el.hint = h("div", { class: "hint" })),
      h("div", { class: "face back", "aria-live": "polite" }, h("div", { class: "face-top" }, el.chipB = h("span", { class: "chip" }), h("button", { class: "icon-btn", style: { padding: "4px 6px" }, onclick: e => { e.stopPropagation(); speak(el.verso.textContent); }, "aria-label": "Lire à voix haute" }, svg("speak"))), el.q = h("div", { class: "q" }), el.mine = h("div", { class: "mine" }), el.verso = h("p", { class: "verso" }), el.plus = h("div", { class: "plus" })))),
    el.answer = h("div", { class: "answer" }, el.ta = h("textarea", { rows: "3", lang: "fr", placeholder: "Écris ta réponse…", onkeydown: e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); flip(); } } }), h("button", { class: "btn", onclick: () => flip() }, "Voir la réponse")),
    el.oral = h("div", { class: "oral" },
      el.micBtn = h("button", { class: "mic", type: "button", "aria-label": "Répondre à voix haute", onclick: () => micToggle() }, svg("mic"), h("span", { class: "ring1" }), h("span", { class: "ring2" })),
      el.oralTxt = h("div", { class: "oral-txt", "aria-live": "polite" }, "Touche le micro et réponds à voix haute"),
      h("div", { class: "oral-tools" },
        h("button", { class: "icon-btn", type: "button", onclick: () => speak(S.cards[sess.queue[sess.i]].recto) }, svg("speak"), h("span", { class: "lbl" }, "Relire la question")),
        el.hands = h("button", { class: "icon-btn", type: "button", "aria-pressed": lsGet("rev.mainsLibres", false) ? "true" : "false", onclick: e => { const v = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", v ? "true" : "false"); lsSet("rev.mainsLibres", v); if (v) toast("Mains libres : questions lues, écoute et passage automatiques"); } }, "🎧", h("span", { class: "lbl" }, "Mains libres")),
        h("button", { class: "icon-btn", type: "button", onclick: () => { stopEcoute(); flip(); } }, "Je ne sais pas"))),
    el.verdict = h("div", { class: "verdict-o", hidden: true }),
    el.reveal = h("button", { class: "btn", onclick: () => flip() }, "Retourner la carte"),
    el.grades = h("div", { class: "grades" },
      h("button", { class: "g ko", onclick: () => grade("ko") }, "À revoir", h("small", null, "tout à l'heure")),
      h("button", { class: "g mid", onclick: () => grade("mid") }, "Presque", h("small", null, "demain")),
      el.okBtn = h("button", { class: "g ok", onclick: () => grade("ok") }, "Je savais", el.okL = h("small"))));
  const end = h("div", { class: "view fc-wrap", hidden: true });
  const root = h("div", null, wrap, end);

  function show() {
    const c = S.cards[sess.queue[sess.i]]; if (!c) return next();
    const d = deckOf(c), col = subjColor(d.matiere);
    wrap.style.setProperty("--subj", col); wrap.style.setProperty("--subjCard", d.matiere ? d.matiere.couleur : "#2a46c4");
    el.flash.classList.remove("enter"); void el.flash.offsetWidth; el.flash.classList.add("enter");
    for (const ch of [el.chipF, el.chipB]) ch.textContent = (d.matiere ? d.matiere.nom : "") + (c.type ? " · " + c.type : "");
    el.notF.textContent = c.notion || "";
    el.recto.textContent = c.recto || ""; el.recto.className = "recto" + (/^[\s\-–−0-9\/et]+$/.test(c.recto || "") && (c.recto || "").length < 16 ? " date" : "");
    el.q.textContent = c.recto || ""; el.verso.textContent = c.verso || "";
    el.plus.replaceChildren(); if (c.plus) { el.plus.append(h("b", null, "À retenir aussi · "), c.plus); el.plus.hidden = false; } else el.plus.hidden = true;
    el.mine.hidden = true; el.ta.value = "";
    el.flash.classList.remove("flipped");
    const oral = fcMode === "oral" && !!SR, typed = fcMode === "ecrite" || (fcMode === "oral" && !SR);
    stopEcoute(); el.verdict.hidden = true; el.verdict.replaceChildren(); sess.note = null;
    el.answer.hidden = !typed; el.reveal.hidden = typed || oral; el.oral.hidden = !oral; el.grades.hidden = true;
    for (const b of el.grades.children) b.classList.remove("suggere");
    el.hint.textContent = oral ? "Réponds à voix haute." : typed ? "Écris ta réponse ci-dessous, puis compare." : "Réponds dans ta tête, puis retourne la carte.";
    if (oral) { el.oralTxt.textContent = "Touche le micro et réponds à voix haute"; el.oralTxt.classList.remove("live"); if (mainsLibres()) setTimeout(() => speak(c.recto, () => setTimeout(() => { if (sess && S.cards[sess.queue[sess.i]] === c && !el.flash.classList.contains("flipped")) micToggle(true); }, 350)), 300); }
    const p = pc(c.id) || { b: 0 }, nb = Math.min(6, (p.b || 0) + 1);
    el.okL.textContent = sess.mode === "chapitre" && p.l && p.d > today() ? "pas de changement" : INT[nb] <= 1 ? "demain" : "dans " + INT[nb] + " j";
    const tot = sess.queue.length; el.count.textContent = Math.min(sess.i + 1, tot) + " / " + tot; el.track.firstChild.style.width = (sess.i / tot * 100) + "%";
    if (!oral) hush();
    if (typed) setTimeout(() => el.ta.focus({ preventScroll: true }), 50);
  }
  function mainsLibres() { return el.hands.getAttribute("aria-pressed") === "true"; }
  function stopEcoute() { if (sess && sess.rec) { sess.rec.abort(); sess.rec = null; } el.micBtn.classList.remove("on"); }
  function micToggle(auto) {
    if (sess.rec) { sess.rec.stop(); return; }
    if (el.flash.classList.contains("flipped")) return;
    hush(); el.oralTxt.textContent = "Je t'écoute…"; el.oralTxt.classList.add("live"); el.micBtn.classList.add("on");
    sess.rec = ecouter({
      onInterim: t => { el.oralTxt.textContent = "« " + t + " »"; },
      onFinal: t => { sess.rec = null; el.micBtn.classList.remove("on"); el.oralTxt.classList.remove("live");
        if (!t) { el.oralTxt.textContent = "Je n'ai rien entendu. Touche le micro pour réessayer."; return; }
        corrigerOral(t); },
      onError: err => { sess.rec = null; el.micBtn.classList.remove("on"); el.oralTxt.classList.remove("live");
        el.oralTxt.textContent = err === "not-allowed" || err === "service-not-allowed" ? "Le micro est bloqué : autorise-le pour cette appli (Réglages de l'iPhone > Safari > Micro), puis réessaie." : auto ? "Touche le micro pour répondre." : "Le micro n'a pas fonctionné. Réessaie, ou passe en réponse écrite."; }
    });
  }
  function corrigerOral(t) {
    const c = S.cards[sess.queue[sess.i]], n = noteOrale(t, c); sess.note = n;
    el.mine.textContent = "Ta réponse : « " + t + " »"; el.mine.hidden = false;
    flip();
    const lab = { ok: "Validé", mid: "Presque", ko: "À revoir" }[n.verdict];
    el.verdict.className = "verdict-o v-" + n.verdict;
    el.verdict.replaceChildren(h("div", { class: "v-top" }, h("b", null, lab), h("span", { class: "small" }, "Correction automatique · tu peux choisir une autre note")),
      n.trouves.length || n.manquants.length ? h("div", { class: "kw" }, n.trouves.map(k => h("span", { class: "kw-ok" }, "✓ " + k.aff)), n.manquants.slice(0, 5).map(k => h("span", { class: "kw-ko" }, "✗ " + k.aff))) : null);
    el.verdict.hidden = false; setTimeout(() => el.verdict.scrollIntoView({ block: "nearest", behavior: "smooth" }), 450);
    for (const b of el.grades.children) b.classList.toggle("suggere", b.classList.contains(n.verdict));
    speak(phraseRetour(n, c), () => { if (mainsLibres() && sess && sess.note === n) setTimeout(() => { if (sess && sess.note === n) grade(n.verdict); }, 900); });
  }
  function flip() {
    if (el.flash.classList.contains("flipped")) return;
    const typed = fcMode === "ecrite";
    if (typed) { const a = el.ta.value.trim(); el.mine.textContent = a ? "Ta réponse : " + a : "Tu n'as rien écrit."; el.mine.hidden = false; el.answer.hidden = true; }
    if (fcMode === "oral" && SR && !sess.note) { stopEcoute(); el.mine.textContent = "Tu as passé cette carte."; el.mine.hidden = false; sess.note = { verdict: "ko" }; for (const b of el.grades.children) b.classList.toggle("suggere", b.classList.contains("ko")); speak("La réponse : " + S.cards[sess.queue[sess.i]].verso); }
    el.flash.classList.remove("enter"); el.flash.classList.add("flipped"); el.reveal.hidden = true; el.oral.hidden = true; el.grades.hidden = false;
  }
  function grade(g) {
    if (!el.flash.classList.contains("flipped")) return;
    const id = sess.queue[sess.i], t = today();
    const p = Object.assign({ b: 0, d: null, ok: 0, ko: 0, mid: 0, l: null }, pc(id) || {}); const fresh = !p.l;
    const scheduled = sess.mode === "jour" || fresh || !p.d || p.d <= t;
    if (g === "ko") { p.b = 1; p.d = addDays(t, 1); }
    else if (scheduled) { if (g === "ok") { p.b = Math.min(6, (p.b || 0) + 1); p.d = addDays(t, INT[p.b]); } else { p.b = Math.max(1, p.b || 0); p.d = addDays(t, 1); } }
    p[g] = (p[g] || 0) + 1; p.l = t; p.ts = Date.now(); if (fresh) p.f = t;
    P.cards[id] = p; P.days[t] = (P.days[t] || 0) + 1;
    sess.res[g]++;
    if (g === "ko") { if (!sess.missed.includes(id)) sess.missed.push(id); sess.again[id] = (sess.again[id] || 0) + 1; if (sess.again[id] <= 2) sess.queue.push(id); }
    stopEcoute(); hush(); saveLocal(); next();
  }
  function next() { sess.i++; if (sess.i >= sess.queue.length) finish(); else show(); }
  function logSession() {
    const r = sess.res, n = r.ok + r.mid + r.ko; if (!n || sess.logged) return; sess.logged = true;
    P.sessions.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), mode: sess.mode, titre: sess.titre + (sess.mode === "chapitre" ? " · veille d'interro" : ""), ok: r.ok, mid: r.mid, ko: r.ko, min: Math.max(1, Math.round((Date.now() - sess.start) / 60000)), app: DEVICE });
    if (P.sessions.length > 300) P.sessions = P.sessions.slice(-300);
    saveLocal();
  }
  function finish() {
    logSession(); syncNow();
    const r = sess.res, n = r.ok + r.mid + r.ko;
    wrap.hidden = true; end.hidden = false;
    if (n && r.ok / n >= .6) confetti();
    end.replaceChildren(h("div", { class: "done" },
      h("div", null, h("div", { class: "eyebrow" }, "Session terminée"), h("h2", { style: { fontSize: "1.6rem", marginTop: "4px" } }, !n ? "Session vide" : r.ok / n >= .85 ? "Excellent, tu maîtrises" : r.ok / n >= .6 ? "Bien joué" : "Tu progresses, continue demain")),
      h("div", { class: "tally" }, h("div", { class: "ok" }, h("b", null, r.ok), "Je savais"), h("div", { class: "mid" }, h("b", null, r.mid), "Presque"), h("div", { class: "ko" }, h("b", null, r.ko), "À revoir")),
      sess.missed.length ? h("div", null, h("p", { class: "small", style: { margin: "0 0 8px" } }, "Les cartes ratées reviennent demain :"), h("ul", { class: "missed" }, sess.missed.map(id => { const c = S.cards[id]; return c ? h("li", null, c.recto, h("span", null, c.verso)) : null; }))) : null,
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { const b = sess.back; sess = null; go(b); } }, "Retour aux cartes"))));
    window.scrollTo({ top: 0 });
  }
  function quit() { logSession(); const b = sess.back; sess = null; hush(); go(b); }
  const onKey = e => {
    if (!sess || wrap.hidden) return; if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === " " || e.key === "Enter") { if (!el.flash.classList.contains("flipped")) { e.preventDefault(); flip(); } }
    else if (e.key === "1") grade("ko"); else if (e.key === "2") grade("mid"); else if (e.key === "3") grade("ok"); else if (e.key === "Escape") quit();
  };
  document.addEventListener("keydown", onKey);
  cleanup = () => { document.removeEventListener("keydown", onKey); if (sess && sess.rec) sess.rec.abort(); hush(); };
  show();
  return root;
}

/* ---------------- voix ---------------- */
function frVoice() { try { const vs = speechSynthesis.getVoices() || []; const fr = vs.filter(v => /^fr/i.test(v.lang)); return fr.find(v => /fr[-_]FR/i.test(v.lang) && /(Amélie|Audrey|Marie|Thomas|Google|Premium|Enhanced|Natural)/i.test(v.name)) || fr.find(v => /fr[-_]FR/i.test(v.lang)) || fr[0] || null; } catch (e) { return null; } }
function speak(t, onend) {
  let done = false; const fin = () => { if (done) return; done = true; onend && onend(); };
  if (!("speechSynthesis" in window) || !t) { setTimeout(fin, 0); return; }
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = "fr-FR"; const v = frVoice(); if (v) u.voice = v; u.rate = 1.02; u.onend = fin; u.onerror = fin; speechSynthesis.speak(u);
    setTimeout(fin, 1500 + t.length * 85); } catch (e) { setTimeout(fin, 0); }
}
function hush() { try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) {} }

/* ---------------- ajouter un cours (photos → cartes + fiche) ---------------- */
let pendingCache = lsGet("rev.demandes", []);
function addCta(mid) {
  const pend = pendingCache.filter(d => d.statut === "en_attente" || d.statut === "en_cours").length;
  return h("a", { class: "add-cta", href: "#/ajouter" + (mid ? "?m=" + mid : "") },
    h("span", { class: "ico" }, svg("camera")),
    h("span", null, h("div", { class: "t" }, "J'ajoute un nouveau cours"), h("div", { class: "s" }, pend ? plural(pend, "cours") + " en préparation" : "Photographie ton cours : cartes et fiche de révision arrivent toutes seules")),
    svg("chev"));
}
async function refreshDemandes() {
  if (!SYNC.code || !navigator.onLine) return pendingCache;
  try { pendingCache = await rpc("lister_demandes", { code: SYNC.code }) || []; lsSet("rev.demandes", pendingCache); } catch (e) {}
  return pendingCache;
}
function compressImage(file, max = 1800, q = .72) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      let data = cv.toDataURL("image/jpeg", q); if (data.length > 2300000) data = cv.toDataURL("image/jpeg", .55);
      res({ data: data.split(",")[1], preview: data });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("image illisible")); };
    img.src = url;
  });
}
const STATUT = { en_attente: ["En attente", "⏳"], en_cours: ["En préparation", "✨"], pret: ["Prêt", "✅"], erreur: ["Problème", "⚠️"] };
function vAdd(mPre) {
  const st = { m: mPre || (S.matieres.find(m => m.chapitres.length) || S.matieres[0]).id, photos: [], nb: 25, fiche: true };
  const wrap = h("div", { class: "view add" });
  const listBox = h("div", { class: "sec" });
  const paintList = () => {
    const ds = pendingCache;
    listBox.replaceChildren(h("div", { class: "sec-head" }, h("h2", null, "Mes cours envoyés")),
      ds.length ? h("div", { class: "feed" }, ds.map(d => { const m = S.matieres.find(x => x.id === d.matiere), [lab, emo] = STATUT[d.statut] || [d.statut, ""];
        const href = d.statut === "pret" && d.chapitre_id ? "#/cartes/" + d.matiere + "?c=" + encodeURIComponent(d.chapitre_id) : null;
        return h(href ? "a" : "div", { href, class: "dem", style: { "--subj": subjColor(m) } }, h("span", { class: "ico" }, svg(m ? m.pictogramme : "fiche")),
          h("span", null, h("div", { class: "t" }, d.titre || (m ? m.nom : d.matiere)), h("div", { class: "s" }, (m ? m.nom + " · " : "") + d.nb_photos + " photo" + (d.nb_photos > 1 ? "s" : "") + " · " + d.nb_cartes + " cartes" + (d.fiche ? " + fiche" : "") + (d.message ? " · " + d.message : ""))),
          h("span", { class: "statut s-" + d.statut }, emo + " " + lab)); }))
        : h("div", { class: "empty-box" }, "Aucun cours envoyé pour l'instant."));
  };
  if (!SYNC.code) {
    wrap.append(...stag([topbar("Accueil", "#/"), h("header", null, h("div", { class: "eyebrow" }, "Nouveau cours"), h("h1", null, "Ajoute ton cours")),
      h("div", { class: "empty-box" }, h("strong", null, "Il faut d'abord le code famille"), "Va dans Réglages et saisis le code : il permet d'envoyer tes photos en toute sécurité."), h("a", { class: "btn", href: "#/reglages" }, "Aller aux réglages")]));
    return wrap;
  }
  const chips = h("div", { class: "mchips" }, S.matieres.map(m => h("button", { class: "mchip", type: "button", "aria-pressed": st.m === m.id ? "true" : "false", style: { "--subj": subjColor(m) }, onclick: e => { st.m = m.id; for (const b of chips.children) b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false"); } }, svg(m.pictogramme), m.nom)));
  const titre = h("input", { class: "txt-in", placeholder: "Ex : Chapitre 3, la cellule", maxlength: "120" });
  const remarque = h("textarea", { class: "txt-in", rows: "2", placeholder: "Facultatif · ex : interro jeudi sur la partie II", maxlength: "500" });
  const thumbs = h("div", { class: "thumbs" });
  const fileIn = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
  const paintThumbs = () => { thumbs.replaceChildren(...st.photos.map((p, i) => h("div", { class: "thumb" }, h("img", { src: p.preview, alt: "Page " + (i + 1) }), h("span", { class: "num" }, i + 1), h("button", { type: "button", class: "rm", "aria-label": "Retirer la photo " + (i + 1), onclick: () => { st.photos.splice(i, 1); paintThumbs(); } }, svg("close"))))); send.disabled = !st.photos.length; pick.querySelector(".pt").textContent = st.photos.length ? "Ajouter d'autres pages" : "Prendre ou choisir des photos"; };
  fileIn.addEventListener("change", async () => {
    const files = [...fileIn.files].slice(0, 20 - st.photos.length); fileIn.value = "";
    for (const f of files) { try { st.photos.push(await compressImage(f)); paintThumbs(); } catch (e) { toast("Une photo n'a pas pu être lue."); } }
  });
  const pick = h("button", { type: "button", class: "pick", onclick: () => fileIn.click() }, h("span", { class: "ico" }, svg("camera")), h("span", { class: "pt" }, "Prendre ou choisir des photos"), h("span", { class: "small" }, "Une photo par page, bien à plat et lisible · 20 pages max"));
  const nbVal = h("b", null, st.nb);
  const slider = h("input", { type: "range", min: "10", max: "60", step: "5", value: st.nb, "aria-label": "Nombre de flashcards", oninput: e => { st.nb = +e.target.value; nbVal.textContent = st.nb; } });
  const ficheT = h("button", { type: "button", class: "toggle", role: "switch", "aria-checked": "true", onclick: e => { st.fiche = !st.fiche; e.currentTarget.setAttribute("aria-checked", st.fiche ? "true" : "false"); } }, h("span", { class: "knob" }));
  const bar = h("div", { class: "track", hidden: true }, h("i")), status = h("div", { class: "small", "aria-live": "polite" });
  const send = h("button", { class: "btn", disabled: true, onclick: async () => {
    send.disabled = true; bar.hidden = false; const total = st.photos.length + 2; let k = 0; const step = t => { k++; bar.firstChild.style.width = (k / total * 100) + "%"; status.textContent = t; };
    try {
      const id = await rpc("creer_demande", { code: SYNC.code, p_matiere: st.m, p_titre: titre.value, p_nb: st.nb, p_fiche: st.fiche, p_remarque: remarque.value }); step("Envoi des photos…");
      for (let i = 0; i < st.photos.length; i++) { await rpc("deposer_photo", { code: SYNC.code, p_demande: id, p_n: i + 1, p_data: st.photos[i].data }); step("Photo " + (i + 1) + " sur " + st.photos.length + " envoyée"); }
      await rpc("soumettre_demande", { code: SYNC.code, p_demande: id }); step("C'est envoyé !");
      await refreshDemandes();
      confetti();
      form.replaceChildren(h("div", { class: "sent" }, h("div", { class: "big-ok" }, "✓"), h("h2", null, "Cours envoyé !"), h("p", { class: "small" }, "Tes flashcards" + (st.fiche ? " et ta fiche de révision" : "") + " arrivent dans l'appli d'ici une heure (entre 8 h et 22 h). Tu verras le badge « Nouveau » dans la matière."),
        h("div", { class: "row" }, h("button", { class: "btn quiet", onclick: () => render() }, "Ajouter un autre cours"), h("a", { class: "btn", href: "#/" }, "Retour à l'accueil"))));
      paintList();
    } catch (e) { send.disabled = false; bar.hidden = true; status.textContent = e.badCode ? "Le code famille n'est plus valable : vérifie-le dans Réglages." : /trop de demandes/.test(e.message) ? "Beaucoup de cours envoyés aujourd'hui : réessaie demain." : "L'envoi n'a pas abouti. Vérifie ta connexion et réessaie."; }
  } }, svg("share"), "Envoyer mon cours");
  const form = h("div", { class: "sec", style: { gap: "18px" } },
    h("section", { class: "card" }, h("div", { class: "lab" }, "1 · La matière"), chips, h("div", { class: "lab" }, "Le titre du cours"), titre),
    h("section", { class: "card" }, h("div", { class: "lab" }, "2 · Les pages du cours"), pick, fileIn, thumbs),
    h("section", { class: "card" }, h("div", { class: "lab" }, "3 · Ce que tu veux"),
      h("div", { class: "nb" }, h("span", null, "Nombre de flashcards"), nbVal), slider,
      h("div", { class: "opt" }, h("span", null, h("strong", null, "Fiche de révision"), h("div", { class: "small" }, "Une fiche synthétique en PDF, à lire ou imprimer")), ficheT),
      h("div", { class: "lab" }, "Une précision ?"), remarque),
    h("div", { class: "sec", style: { gap: "10px" } }, send, bar, status));
  wrap.append(...stag([topbar("Accueil", "#/"), h("header", null, h("div", { class: "eyebrow" }, "Nouveau cours"), h("h1", null, "Ajoute ton cours")), form, listBox]));
  paintList(); refreshDemandes().then(paintList);
  return wrap;
}

/* ---------------- réponse orale : écoute en français et correction ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function ecouter({ onInterim, onFinal, onError }) {
  if (!SR) { onError && onError("absent"); return null; }
  const r = new SR(); r.lang = "fr-FR"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let txt = "", fini = false;
  const finir = () => { if (fini) return; fini = true; clearTimeout(garde); onFinal && onFinal(txt.trim()); };
  r.onresult = e => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; txt = t; onInterim && onInterim(t); };
  r.onerror = e => { if (e.error === "no-speech" || e.error === "aborted") return; fini = true; clearTimeout(garde); onError && onError(e.error); };
  r.onend = finir;
  const garde = setTimeout(() => { try { r.stop(); } catch (e) {} setTimeout(finir, 800); }, 15000);
  try { r.start(); } catch (e) { fini = true; clearTimeout(garde); onError && onError("start"); return null; }
  return { stop: () => { try { r.stop(); } catch (e) {} }, abort: () => { fini = true; clearTimeout(garde); try { r.abort(); } catch (e) {} } };
}
const STOP = new Set("alors aussi autre autres avant avec avoir bien cela celle celles celui cette ceux chaque comme comment dans depuis donc elle elles entre etre fait faire grand grande leur leurs mais meme moins notre nous parce pendant peut plus pour pourquoi quand quel quelle quelles quels sans selon sont sous tous tout toute toutes tres une unes vers votre vous apres ainsi avait etait sera sont ont deux trois premier premiere dont celui ceci".split(" "));
function normTxt(t) { return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function racine(w) { return /^\d+$/.test(w) ? w : w.slice(0, 6); }
function termesCles(verso) {
  const out = new Map(), mots = (verso || "").split(/\s+/);
  // l'essentiel est en tête de réponse (avant le premier « : », « ; », « ( » ou « . ») : ces mots comptent double
  let tete = mots.findIndex(m => /[:;(.]$|^\(/.test(m)); tete = tete < 0 ? Math.min(mots.length, 10) : Math.min(tete + 1, 12);
  mots.forEach((brut, i) => {
    const propre = brut.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/^(?:[ldjmnstc]|qu|jusqu|lorsqu|puisqu)['’]/i, ""); if (!propre) return;
    for (const w of normTxt(propre).split(" ")) {
      if (!w || /^[ivx]+(er|e)?$/.test(w)) continue;
      let poids = 0;
      if (/^\d+$/.test(w)) poids = 3;
      else if (/^\p{Lu}/u.test(propre) && i > 0 && !/[.!?:]$/.test(mots[i - 1] || "") && w.length >= 3) poids = 2;
      else if (w.length >= 5 && !STOP.has(w)) poids = 1;
      if (!poids) continue;
      if (i < tete) poids += 2;
      const k = racine(w); const cur = out.get(k);
      if (!cur || cur.poids < poids) out.set(k, { k, poids, aff: propre });
    }
  });
  return [...out.values()].sort((a, b) => b.poids - a.poids || b.aff.length - a.aff.length).slice(0, 8);
}
function noteOrale(reponse, carte) {
  const r = normTxt(reponse);
  if (!r || /^(je (ne )?sais pas|aucune idee|j en sais rien|passe|joker)/.test(r)) return { verdict: "ko", score: 0, trouves: [], manquants: termesCles(carte.verso) };
  const mots = r.split(" "), rac = new Set(mots.map(racine));
  const termes = termesCles(carte.verso);
  if (!termes.length) return { verdict: "mid", score: .5, trouves: [], manquants: [] };
  const trouve = t => rac.has(t.k) || (t.k.length >= 5 && !/^\d+$/.test(t.k) && mots.some(m => m.length >= 5 && (m.startsWith(t.k.slice(0, 5)) || t.k.startsWith(m.slice(0, 5)))));
  const trouves = termes.filter(trouve), manquants = termes.filter(t => !trouve(t));
  const tot = termes.reduce((a, t) => a + t.poids, 0), ok = trouves.reduce((a, t) => a + t.poids, 0), score = ok / tot;
  return { verdict: score >= .5 ? "ok" : score >= .28 ? "mid" : "ko", score, trouves, manquants };
}
function phraseRetour(n, carte) {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const manque = n.manquants.slice(0, 3).map(t => t.aff).join(", ");
  if (n.verdict === "ok") return pick(["Bien joué !", "Exact !", "Parfait, c'est ça.", "Très bien !"]) + (n.manquants.length && manque ? " Pour être complet, ajoute : " + manque + "." : "");
  if (n.verdict === "mid") return "Presque. Il te manquait : " + manque + ". La réponse : " + carte.verso;
  return pick(["Pas tout à fait.", "Ce n'est pas ça.", "Raté, mais tu vas la retenir."]) + " La réponse : " + carte.verso;
}

/* ---------------- suivi ---------------- */
function vStats() {
  const t = today(), days = [];
  for (let i = 13; i >= 0; i--) { const d = addDays(t, -i); days.push({ d, n: P.days[d] || 0 }); }
  const max = Math.max(5, ...days.map(x => x.n));
  const last7 = days.slice(-7).reduce((s, x) => s + x.n, 0);
  const seenList = Object.entries(P.seen).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, ts]) => ({ x: S.byRes[id], ts })).filter(o => o.x);
  const sessions = P.sessions.slice(-8).reverse();
  const ns = notionStats().slice(0, 8);
  const syncLine = !SYNC.code ? h("span", { class: "pill off" }, "Progression gardée sur cet appareil seulement") : SYNC.state === "ok" ? h("span", { class: "pill" }, "Synchronisé" + (SYNC.last ? " · " + new Date(SYNC.last).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "")) : h("span", { class: "pill off" }, SYNC.state === "badcode" ? "Code famille refusé" : "Hors ligne · synchro au retour du réseau");
  return h("div", { class: "view" },
    h("header", null, h("div", { class: "eyebrow" }, "Suivi"), h("h1", null, "Où en est " + (CFG.prenom || "l'élève")), h("div", { style: { marginTop: "8px" } }, syncLine)),
    h("div", { class: "kpis" },
      h("div", { class: "kpi" }, h("b", null, streak()), h("span", null, "jours d'affilée")),
      h("div", { class: "kpi" }, h("b", null, last7), h("span", null, "cartes révisées sur 7 jours")),
      h("div", { class: "kpi" }, h("b", null, mastered()), h("span", null, "cartes maîtrisées sur " + Object.keys(S.cards).length)),
      h("div", { class: "kpi" }, h("b", null, Object.keys(P.seen).length), h("span", null, "supports ouverts sur " + Object.keys(S.byRes).length))),
    h("section", { class: "card" }, h("h2", null, "Cartes révisées, 14 derniers jours"),
      h("div", { class: "bars", role: "img", "aria-label": days.map(x => frDate(x.d, { day: "numeric", month: "short" }) + " : " + x.n).join(", ") },
        days.map(x => h("div", { title: frDate(x.d, { weekday: "short", day: "numeric" }) + " : " + x.n }, h("i", { class: x.n ? "" : "zero", style: { height: (x.n / max * 100) + "%" } }), h("span", null, frDate(x.d, { weekday: "narrow" })))))),
    h("section", { class: "sec" }, h("h2", null, "Par chapitre"),
      Object.values(S.decks).length ? h("div", { class: "decks" }, Object.values(S.decks).map(d => { const cs = sortedCards(c => c.deck === d.id), n = cs.length, mm = cs.filter(c => (pc(c.id) || {}).b >= MASTER).length, seen = cs.filter(c => (pc(c.id) || {}).l).length;
        return h("div", { class: "deck", style: { "--subj": subjColor(d.matiere) } }, h("div", { class: "deck-main" }, h("span", { class: "chip" }, d.matiere.nom), h("h3", null, d.titre), h("div", { class: "meter" }, h("i", { class: "m", style: { width: (n ? mm / n * 100 : 0) + "%" } }), h("i", { class: "p", style: { width: (n ? (seen - mm) / n * 100 : 0) + "%" } })), h("div", { class: "deck-meta" }, mm + " maîtrisées · " + (seen - mm) + " en cours · " + (n - seen) + " jamais vues"))); })) : null),
    h("section", { class: "sec" }, h("h2", null, "Notions qui coincent"),
      ns.length ? h("ul", { class: "notions" }, ns.map(o => h("li", null, h("span", { class: "nm" }, o.notion), h("span", { class: "rate" + (o.rate >= .5 ? " mid" : "") }, Math.round(o.rate * 100) + " %"), h("span", { class: "sub" }, (o.deck.matiere ? o.deck.matiere.nom + " · " : "") + o.n + " réponses")))) : h("div", { class: "empty-box" }, "Pas assez de réponses pour l'instant.")),
    h("section", { class: "card" }, h("h2", null, "Dernières sessions"),
      sessions.length ? h("ul", { class: "log" }, sessions.map(s => h("li", null, h("span", null, s.titre + " · " + s.ok + " sues, " + s.mid + " presque, " + s.ko + " à revoir"), h("span", null, new Date(s.t).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + (s.app ? " · " + s.app : ""))))) : h("p", { class: "small", style: { margin: 0 } }, "Aucune session pour l'instant.")),
    h("section", { class: "card" }, h("h2", null, "Derniers supports ouverts"),
      seenList.length ? h("ul", { class: "log" }, seenList.map(({ x, ts }) => h("li", null, h("span", null, x.m.nom + " · " + x.r.titre), h("span", null, new Date(ts).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }))))) : h("p", { class: "small", style: { margin: 0 } }, "Rien d'ouvert pour l'instant.")));
}

/* ---------------- réglages ---------------- */
function vSettings() {
  const input = h("input", { id: "code", inputmode: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", maxlength: "12", value: SYNC.code, placeholder: "XXXXXX" });
  const status = h("div", { class: "small" });
  const paint = () => { status.replaceChildren(!SYNC.code ? h("span", { class: "pill off" }, "Pas de code : la progression reste sur cet appareil") : SYNC.state === "badcode" ? h("span", { class: "pill off" }, "Code refusé") : SYNC.state === "ok" ? h("span", { class: "pill" }, "Synchronisation active") : h("span", { class: "pill off" }, "Code enregistré · synchro dès que possible")); };
  paint();
  const save = async () => {
    const code = input.value.trim().toUpperCase();
    if (!code) { SYNC.code = ""; lsSet("rev.code", ""); SYNC.state = "off"; paint(); return; }
    try { const ok = await rpc("verifier_code", { code }); if (!ok) { SYNC.state = "badcode"; paint(); toast("Ce code n'est pas le bon."); return; } }
    catch (e) { toast("Pas de réseau : réessaie dans un instant."); return; }
    SYNC.code = code; lsSet("rev.code", code); await syncNow(); paint(); toast("Progression synchronisée.");
  };
  const theme = lsGet("rev.theme", "dark");
  const seg = h("div", { class: "segmented", role: "group", "aria-label": "Apparence" }, [["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"]].map(([v, l]) => h("button", { "aria-pressed": theme === v ? "true" : "false", onclick: () => { lsSet("rev.theme", v); applyTheme(); render(); } }, l)));
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  return h("div", { class: "view" },
    h("header", null, h("div", { class: "eyebrow" }, "Réglages"), h("h1", null, "Réglages")),
    h("section", { class: "card" }, h("h2", null, "Code famille"),
      h("p", { class: "small", style: { margin: 0 } }, "Le même code sur le téléphone et sur l'iPad : la progression se retrouve sur les deux, et le suivi est visible depuis n'importe quel appareil."),
      h("div", { class: "field" }, h("label", { for: "code" }, "Code"), input), status,
      h("div", { class: "row" }, h("button", { class: "btn", onclick: save }, "Enregistrer"), SYNC.code ? h("button", { class: "btn quiet", onclick: async () => { await syncNow({ rerender: false }); paint(); toast(SYNC.state === "ok" ? "Synchronisé." : "Synchro impossible pour l'instant."); } }, "Synchroniser maintenant") : null)),
    h("section", { class: "card" }, h("h2", null, "Apparence"), seg),
    standalone ? null : h("section", { class: "card" }, h("h2", null, "Installer l'appli"),
      h("div", { class: "install" }, h("b", null, "1"), h("span", null, "Sur iPhone ou iPad, ouvre cette page dans Safari."), h("b", null, "2"), h("span", null, "Touche le bouton Partager (le carré avec une flèche vers le haut)."), h("b", null, "3"), h("span", null, "Choisis « Sur l'écran d'accueil », puis « Ajouter »."), h("b", null, "4"), h("span", null, "Sur Android : menu ⋮ de Chrome, puis « Installer l'application ».")),
      installEvt ? h("button", { class: "btn", onclick: async () => { installEvt.prompt(); installEvt = null; } }, "Installer maintenant") : null),
    h("section", { class: "card" }, h("h2", null, "Mise à jour"),
      h("p", { class: "small", style: { margin: 0 } }, "Les nouveaux contenus arrivent tout seuls à l'ouverture. Version des contenus : " + (S.cat && S.cat.version || "?") + "."),
      h("div", { class: "row" }, h("button", { class: "btn quiet", onclick: async () => { try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (e) {} location.reload(); } }, "Vérifier les mises à jour"))));
}

/* ---------------- thème, installation, service worker ---------------- */
function applyTheme() {
  const t = lsGet("rev.theme", "dark"), dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  for (const mt of document.querySelectorAll('meta[name="theme-color"]')) mt.setAttribute("content", dark ? "#0b0e14" : "#f3efe6");
}
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; });
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").then(reg => {
    reg.addEventListener("updatefound", () => { const w = reg.installing; if (w) w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) toast("Nouvelle version prête : elle s'appliquera à la prochaine ouverture."); }); });
  }).catch(() => {}));
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(); render(); });

/* ---------------- ouverture animée et confettis ---------------- */
function splash() {
  let seen = false; try { seen = sessionStorage.getItem("rev.splash") === "1"; sessionStorage.setItem("rev.splash", "1"); } catch (e) {}
  if (seen || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const tick = '<svg viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.3L18.5 7.5"/></svg>';
  const el = h("div", { class: "splash", "aria-hidden": "true" },
    h("div", { class: "stack" }, h("div", { class: "c c1" }), h("div", { class: "c c2" }), h("div", { class: "c c3" }), h("div", { class: "c c4" }, h("span", null, "M")), h("div", { class: "tick", html: tick })),
    h("div", { class: "word" }, "Révisions", h("small", null, "Seconde · " + (CFG.prenom || ""))));
  const kill = () => el.remove();
  el.addEventListener("click", kill); el.addEventListener("animationend", e => { if (e.animationName === "splashOut") kill(); });
  document.body.append(el); setTimeout(kill, 2600);
}
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = h("canvas", { class: "confetti" }); document.body.append(cv);
  const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr, ctx = cv.getContext("2d");
  const cols = ["#a68cf0", "#e57b9f", "#f2b04a", "#5fd39e", "#8f9cff", "#5cc3df"];
  const ps = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 16 * dpr, vy: (-Math.random() * 14 - 6) * dpr, s: (5 + Math.random() * 6) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  const step = t => {
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) { p.vy += .45 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); ctx.restore(); }
    if (t - t0 < 2200) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
}

/* reflet qui suit le doigt */
document.addEventListener("pointermove", e => { const t = e.target.closest && e.target.closest(".subject,.mat-card,.add-cta"); if (!t) return; const r = t.getBoundingClientRect(); t.style.setProperty("--mx", (e.clientX - r.left) + "px"); t.style.setProperty("--my", (e.clientY - r.top) + "px"); }, { passive: true });

/* ---------------- démarrage ---------------- */
applyTheme();
splash();
render();
loadCatalogue().then(() => { render(); syncNow({ rerender: true }); refreshDemandes().then(() => { if (!sess && (location.hash === "" || location.hash === "#/")) render(); }); }).catch(() => { app.replaceChildren(h("div", { class: "empty-box" }, h("strong", null, "Impossible de charger les contenus"), "Vérifie la connexion, puis rouvre l'appli.")); });
})();
