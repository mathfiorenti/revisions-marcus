/* Mode création — Révisions Marcus.
   Marcus ou un parent discute avec Claude (fonction Supabase « atelier ») pour créer un exercice interactif,
   le teste dans l'aperçu, le retouche, puis le publie dans l'appli de Marcus.
   Protégé par le code famille (le même que l'appli de Marcus). La conversation reste sur cet appareil. */
(function () {
  "use strict";
  const CFG = window.REV_CONFIG || {};
  const VERSION = "03/11 · 0 h";
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app");
  const MATIERES = { histoire: "Histoire", geographie: "Géographie", francais: "Français", ses: "SES", maths: "Maths", "physique-chimie": "Physique-chimie", svt: "SVT", anglais: "Anglais", espagnol: "Espagnol", allemand: "Allemand", snt: "SNT", autre: "Autre" };

  /* ---------- utilitaires ---------- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") for (const [p, val] of Object.entries(v)) e.style.setProperty(p, val);
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  }
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  let toastT; function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 3600); }
  const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const frDate = (s, o) => new Date(String(s).length === 10 ? s + "T12:00" : s).toLocaleDateString("fr-FR", o || { weekday: "long", day: "numeric", month: "long" });
  const euros = usd => (Math.round(usd * 0.93 * 100) / 100).toFixed(2).replace(".", ",") + " €";
  const note = (s, t) => t ? String(Math.round(s / t * 200) / 10).replace(".", ",") : "–";
  // Texte de Claude : paragraphes et **gras**, sans HTML injecté.
  function texteRiche(t) {
    const f = h("div", { class: "msg-t" });
    String(t || "").split(/\n{2,}/).forEach(par => {
      const p = h("p");
      par.split("\n").forEach((l, i) => { if (i) p.append(h("br")); l.split(/(\*\*[^*]+\*\*)/).forEach(m => /^\*\*[^*]+\*\*$/.test(m) ? p.append(h("strong", null, m.slice(2, -2))) : m && p.append(m.replace(/^\s*[-•]\s+/, "• "))); });
      f.append(p);
    });
    return f;
  }

  /* ---------- serveur ---------- */
  let CODE = lsGet("par.code", "") || lsGet("rev.code", "");
  const AUTEUR = () => lsGet("par.auteur", "marcus");
  async function rpc(fn, body) {
    const r = await fetch(CFG.supabaseUrl + "/rest/v1/rpc/" + fn, { method: "POST", headers: { "Content-Type": "application/json", apikey: CFG.supabaseKey, Authorization: "Bearer " + CFG.supabaseKey }, body: JSON.stringify(body) });
    if (!r.ok) { const e = new Error(await r.text()); e.status = r.status; e.badCode = r.status === 403; throw e; }
    return r.json();
  }
  async function fonction(nom, body, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 170000);
    try {
      const r = await fetch(CFG.supabaseUrl + "/functions/v1/" + nom, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json", apikey: CFG.supabaseKey }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(d.erreur || "erreur"); e.status = r.status; e.data = d; throw e; }
      return d;
    } finally { clearTimeout(t); }
  }

  /* ---------- données ---------- */
  const D = { cat: null, cartes: {}, tableau: lsGet("par.tableau", null), charge: false };
  async function chargerCatalogue() {
    try {
      D.cat = await (await fetch("../catalogue.json", { cache: "no-cache" })).json();
      for (const m of D.cat.matieres) for (const c of m.chapitres) for (const r of c.ressources) if (r.type === "flashcards") {
        try { const d = await (await fetch("../" + r.fichier)).json(); for (const card of d.cards) D.cartes[card.id] = { ...card, matiere: m.nom, chapitre: c.titre }; } catch (e) {}
      }
    } catch (e) {}
  }
  async function chargerTableau() {
    try { D.tableau = await rpc("parent_tableau", { code: CODE }); lsSet("par.tableau", D.tableau); D.charge = true; }
    catch (e) { if (e.badCode) { CODE = ""; lsSet("par.code", ""); } throw e; }
  }
  function chapitresTexte() {
    if (!D.cat) return "";
    return D.cat.matieres.flatMap(m => m.chapitres.map(c => m.id + "/" + c.id + " : " + c.titre)).join(" ; ");
  }
  function dstTexte() {
    if (!window.DST) return "";
    return DST.prochains(lsGet("par.classe", "")).map(s => s.quand + " : " + (s.epreuves.length ? s.epreuves.map(e => e.nom + " (" + e.heures + " h" + (e.date ? ", " + frDate(e.date, { weekday: "long", day: "numeric", month: "long" }) : "") + ")").join(", ") : s.vacances || "pas de DST")).join(" ; ");
  }

  /* ---------- conversation (gardée sur l'appareil) ---------- */
  const vide = () => ({ messages: [], exercice: null, exoId: null, statut: null, version: 0 });
  let C = lsGet("par.conv", null) || vide();
  function sauver() {
    if (lsSet("par.conv", C)) return;
    // stockage plein (photos) : on garde le texte, les pièces jointes restent en mémoire pour cette session
    const leger = { ...C, messages: C.messages.map(m => ({ ...m, pieces: m.pieces ? m.pieces.map(p => ({ ...p, data: "" })) : undefined })) };
    lsSet("par.conv", leger);
  }
  let pieces = [], envoi = false;

  /* ---------- routeur ---------- */
  function route() { return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean); }
  addEventListener("hashchange", render);
  function setTab(n) { for (const a of document.querySelectorAll(".tabbar a")) a.dataset.tab === n ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); }
  function render() {
    document.querySelectorAll("body > .apercu").forEach(x => x.remove()); document.body.classList.remove("apercu-ouvert");
    if (!CODE) { document.body.classList.add("locked"); app.replaceChildren(vVerrou()); return; }
    document.body.classList.remove("locked");
    const [v, id] = route();
    let view;
    if (v === "exercices") { setTab("exercices"); view = id ? vResultats(id) : vExercices(); }
    else if (v === "suivi") { setTab("suivi"); view = vSuivi(); }
    else { setTab("atelier"); view = vAtelier(); }
    app.replaceChildren(view);
  }

  /* ---------- verrou ---------- */
  function vVerrou() {
    const champ = h("input", { class: "txt-in code-in", type: "password", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "Code famille", "aria-label": "Code famille", maxlength: "40" });
    const msg = h("p", { class: "small", "aria-live": "polite", style: { margin: 0, minHeight: "1.3em" } });
    const bouton = h("button", { class: "btn", type: "submit" }, "Ouvrir le mode création");
    const carte = h("form", { class: "lock-card", onsubmit: async e => {
      e.preventDefault();
      const code = champ.value.trim().toUpperCase(); if (!code) return champ.focus();
      bouton.disabled = true; msg.textContent = "Vérification…";
      let ok = false; try { ok = await rpc("verifier_code_parent", { code }); } catch (err) { ok = false; }
      bouton.disabled = false;
      if (!ok) { msg.textContent = "Code incorrect. Après plusieurs erreurs, l'accès est bloqué 15 minutes."; carte.classList.remove("shake"); void carte.offsetWidth; carte.classList.add("shake"); champ.select(); return; }
      CODE = code; lsSet("par.code", code); render(); demarrer();
    } },
      h("span", { class: "lock-ico" }, iconeAtelier()),
      h("h1", null, "Mode création"),
      h("p", { class: "small", style: { margin: 0 } }, "Crée des exercices de révision avec l'aide de Claude. Entre le code famille (le même que dans l'appli de révision)."),
      champ, msg, bouton);
    setTimeout(() => champ.focus(), 300);
    return h("div", { class: "view lock" }, carte);
  }
  function iconeAtelier() { const s = document.createElement("span"); s.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 5.5h16v10H9l-5 4z"/><path d="M9 12l4.5-4.5 1.5 1.5L10.5 13.5H9z"/></svg>'; return s.firstChild; }

  /* ---------- atelier : conversation + aperçu ---------- */
  const IDEES_MARCUS = [
    "Un texte à trous en anglais sur le present perfect et le prétérit, avec une partie plus difficile.",
    "Entraîne-moi pour le DST de français : questions sur le roman réaliste (Balzac, Flaubert, Zola).",
    "J'ai pris mon cours en photo : fais-moi un exercice qui reprend exactement ce cours.",
    "10 questions rapides sur les dates du chapitre d'histoire sur Athènes et Rome."
  ];
  const IDEES = [
    "Un texte à trous en anglais sur le present perfect et le prétérit, avec une partie plus difficile.",
    "Prépare Marcus au DST de français : questions sur le roman réaliste (Balzac, Flaubert, Zola).",
    "J'ai pris son cours en photo : fais-lui un exercice qui reprend exactement ce cours.",
    "10 questions rapides pour vérifier qu'il connaît les dates du chapitre d'histoire sur Athènes et Rome."
  ];
  function vAtelier() {
    const liste = h("div", { class: "fil", "aria-live": "polite" });
    const peindreFil = () => {
      liste.replaceChildren();
      if (!C.messages.length) {
        liste.append(h("div", { class: "accueil-atelier" },
          h("h2", null, AUTEUR() === "parent" ? "Que veux-tu préparer pour " + (CFG.prenom || "Marcus") + " ?" : "Qu'est-ce que tu veux réviser ?"),
          h("p", { class: "small" }, "Décris l'exercice comme à un prof particulier : la matière, le chapitre, le type d'exercice. Tu peux joindre des photos du cours ou un PDF, et dicter au lieu d'écrire. Claude prépare l'exercice, tu le testes, tu demandes des retouches, puis tu l'ajoutes aux révisions."),
          h("div", { class: "idees" }, (AUTEUR() === "parent" ? IDEES : IDEES_MARCUS).map(t => h("button", { type: "button", class: "idee", onclick: () => { saisie.value = t; saisie.focus(); ajuster(); } }, t)))));
      }
      C.messages.forEach((m, i) => liste.append(bulle(m, i)));
      if (envoi) liste.append(h("div", { class: "msg ia attente" }, h("span", { class: "points" }, h("i"), h("i"), h("i")), h("span", { class: "small" }, "Claude prépare l'exercice… (souvent 20 à 60 secondes)")));
      requestAnimationFrame(() => { liste.scrollTop = liste.scrollHeight; });
    };
    function bulle(m, i) {
      if (m.role === "user") return h("div", { class: "msg moi" },
        m.pieces && m.pieces.length ? h("div", { class: "pj-l" }, m.pieces.map(p => h("span", { class: "pj" }, p.type === "pdf" ? "📄 " : "🖼 ", p.nom || "pièce jointe"))) : null,
        m.texte ? texteRiche(m.texte) : null);
      return h("div", { class: "msg ia" + (m.erreur ? " err" : "") }, texteRiche(m.texte),
        m.exercice ? h("button", { type: "button", class: "exo-carte", onclick: () => { C.exercice = m.exercice; sauver(); ouvrirApercu(); } },
          h("span", { class: "exo-ico" }, iconeAtelier()),
          h("span", { class: "exo-t" }, h("b", null, m.exercice.titre || "Exercice"), h("span", { class: "small" }, (MATIERES[m.exercice.matiere] || "") + " · " + Exos.resume(m.exercice) + (m.version ? " · version " + m.version : ""))),
          h("span", { class: "exo-go" }, "Aperçu ›")) : null);
    }

    /* zone de saisie */
    const saisie = h("textarea", { class: "txt-in saisie", rows: "1", placeholder: "Ta demande…", "aria-label": "Ton message" });
    const ajuster = () => { saisie.style.height = "auto"; saisie.style.height = Math.min(220, saisie.scrollHeight + 2) + "px"; };
    saisie.addEventListener("input", ajuster);
    saisie.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); envoyer(); } });
    const pjZone = h("div", { class: "pj-l" });
    const peindrePj = () => pjZone.replaceChildren(...pieces.map((p, k) => h("span", { class: "pj" }, p.type === "pdf" ? "📄 " : "🖼 ", p.nom, h("button", { type: "button", "aria-label": "Retirer", onclick: () => { pieces.splice(k, 1); peindrePj(); } }, "×"))));
    peindrePj();
    const fichier = h("input", { type: "file", accept: "image/*,application/pdf", multiple: true, hidden: true, onchange: async () => {
      for (const f of fichier.files) {
        try {
          if (f.type === "application/pdf") {
            if (f.size > 8e6) { toast("PDF trop lourd (8 Mo maximum)."); continue; }
            pieces.push({ type: "pdf", media_type: "application/pdf", nom: f.name, data: await enBase64(f) });
          } else if (f.type.startsWith("image/")) pieces.push({ type: "image", media_type: "image/jpeg", nom: f.name || "photo.jpg", data: await compresser(f) });
        } catch (e) { toast("Impossible de lire " + f.name); }
      }
      if (pieces.length > 10) { pieces = pieces.slice(0, 10); toast("10 pièces jointes au maximum."); }
      fichier.value = ""; peindrePj();
    } });
    const micro = h("button", { type: "button", class: "ico-btn", "aria-label": "Dicter", title: "Dicter", onclick: () => dicter(saisie, micro, ajuster) }, svgIco("mic"));
    const joindre = h("button", { type: "button", class: "ico-btn", "aria-label": "Joindre des photos ou un PDF", title: "Joindre des photos ou un PDF", onclick: () => fichier.click() }, svgIco("clip"));
    const envoyerBtn = h("button", { type: "button", class: "btn envoyer", "aria-label": "Envoyer", onclick: () => envoyer() }, svgIco("send"));
    const composer = h("div", { class: "composer" }, pjZone, h("div", { class: "composer-l" }, joindre, micro, saisie, envoyerBtn), fichier);

    async function envoyer(texteForce) {
      const texte = (texteForce || saisie.value).trim();
      if (envoi || (!texte && !pieces.length)) return;
      if (!navigator.onLine) return toast("Pas de connexion internet.");
      C.messages.push({ role: "user", texte, pieces: pieces.length ? pieces : undefined });
      pieces = []; peindrePj(); saisie.value = ""; ajuster();
      envoi = true; sauver(); peindreFil(); envoyerBtn.disabled = true;
      try {
        const d = await fonction("atelier", {
          code: CODE, auteur: AUTEUR(),
          messages: C.messages.filter(m => !m.erreur).map(m => ({ role: m.role, texte: m.texte + (m.role === "assistant" && m.exercice ? "\n[Exercice proposé dans l'aperçu : « " + m.exercice.titre + " »" + (m.version ? ", version " + m.version : "") + "]" : ""), pieces: m.pieces && m.pieces.filter(p => p.data).length ? m.pieces.filter(p => p.data) : undefined })),
          exercice: C.exercice,
          contexte: { date: frDate(ymd(new Date())), dst: dstTexte(), chapitres: chapitresTexte() }
        });
        const msg = { role: "assistant", texte: d.texte || "" };
        if (d.exercice) {
          const pb = Exos.verifier(d.exercice);
          C.version = (C.version || 0) + 1; msg.exercice = d.exercice; msg.version = C.version;
          C.exercice = d.exercice; C.statut = C.exoId ? "modifie" : null;
          if (pb.length) msg.texte += "\n\n(Contrôle automatique : " + pb.join(" ; ") + ". Demandez à Claude de corriger ces points.)";
        }
        if (d.tronque) msg.texte += "\n\n(La réponse a été coupée car trop longue : demandez un exercice un peu plus court.)";
        C.messages.push(msg);
        if (d.usage && D.tableau) { D.tableau.usage = D.tableau.usage || {}; D.tableau.usage.jour = { n: d.usage.n, cout_usd: d.usage.cout_jour }; }
        if (d.exercice && matchMedia("(min-width: 980px)").matches) peindreApercu();
        else if (d.exercice) setTimeout(ouvrirApercu, 250);
      } catch (e) {
        const t = e.status === 401 ? "Le code famille n'est plus valable : rouvre le mode création avec le nouveau code." :
          e.status === 429 ? "La limite du jour est atteinte (pour maîtriser le coût). Réessayez demain." :
          e.status === 503 ? "L'IA n'est pas disponible pour l'instant (clé non configurée)." :
          e.name === "AbortError" ? "Claude a mis trop de temps à répondre. Réessayez, ou demandez un exercice plus court." :
          "Je n'ai pas pu joindre Claude (" + (e.message || "erreur") + "). Réessayez dans un instant.";
        C.messages.push({ role: "assistant", texte: t, erreur: true });
        if (e.status === 401) { CODE = ""; lsSet("par.code", ""); }
      } finally {
        envoi = false; sauver(); envoyerBtn.disabled = false; peindreFil(); majCout();
      }
    }

    /* aperçu */
    const apercu = h("aside", { class: "apercu", "aria-label": "Aperçu de l'exercice" });
    let ongletApercu = "tester";
    function peindreApercu() {
      const exo = C.exercice;
      apercu.replaceChildren();
      if (!exo) { apercu.append(h("div", { class: "apercu-vide" }, h("strong", null, "Aperçu"), "L'exercice apparaîtra ici, tel que " + (CFG.prenom || "Marcus") + " le verra. Tu pourras le tester avant de l'ajouter.")); return; }
      const pb = Exos.verifier(exo);
      const publie = C.statut === "publie";
      const zone = h("div", { class: "apercu-corps" });
      const peindreZone = () => zone.replaceChildren(ongletApercu === "tester"
        ? Exos.rendre(exo, { mode: "apercu", corriger: (it, rep) => corrigerApercu(it, rep, exo), refaire: () => { peindreZone(); zone.scrollTop = 0; } })
        : Exos.solutions(exo));
      peindreZone();
      apercu.append(
        h("div", { class: "apercu-head" },
          h("button", { type: "button", class: "icon-btn fermer", "aria-label": "Fermer l'aperçu", onclick: fermerApercu }, "✕"),
          h("div", { class: "grow" }, h("div", { class: "eyebrow" }, (MATIERES[exo.matiere] || exo.matiere) + (exo.chapitre ? " · " + exo.chapitre : "")), h("h2", null, exo.titre)),
          h("div", { class: "segmented" }, [["tester", "Tester"], ["reponses", "Réponses"]].map(([v, l]) => h("button", { "aria-pressed": ongletApercu === v ? "true" : "false", onclick: () => { ongletApercu = v; peindreApercu(); } }, l)))),
        ...(pb.length ? [h("div", { class: "alerte" }, h("strong", null, "À corriger avant de publier : "), pb.join(" ; "))] : []),
        zone,
        h("div", { class: "apercu-actions" },
          h("div", { class: "small statut-exo" }, publie ? "✓ Publié pour " + (CFG.prenom || "Marcus") : C.statut === "brouillon" ? "Enregistré en brouillon" : C.statut === "modifie" ? "Modifié depuis la publication : republiez pour mettre à jour" : "Pas encore publié"),
          h("div", { class: "row" },
            h("button", { class: "btn quiet", disabled: !!pb.length || null, onclick: () => publier("brouillon") }, "Brouillon"),
            h("button", { class: "btn", disabled: !!pb.length || null, onclick: () => publier("publie") }, publie ? "Republier" : C.exoId ? "Republier les modifications" : "Ajouter aux révisions"))));
    }
    async function publier(statut) {
      if (statut === "publie" && !C.exoId && !confirm("Publier « " + C.exercice.titre + " » ? " + (CFG.prenom || "Marcus") + " le verra tout de suite dans " + (MATIERES[C.exercice.matiere] || "sa matière") + ".")) return;
      try {
        const r = await rpc("parent_enregistrer", { code: CODE, p_id: C.exoId, p_contenu: C.exercice, p_statut: statut });
        C.exoId = r.id; C.statut = statut; sauver();
        toast(statut === "publie" ? "Publié : " + (CFG.prenom || "Marcus") + " le voit dans son appli." : "Brouillon enregistré.");
        chargerTableau().catch(() => {});
        peindreApercu();
      } catch (e) { toast(e.badCode ? "Code famille refusé." : "Échec de l'enregistrement. Réessayez."); }
    }
    function ouvrirApercu() { peindreApercu(); if (apercu.parentNode !== document.body && !matchMedia("(min-width: 980px)").matches) document.body.append(apercu); document.body.classList.add("apercu-ouvert"); apercu.scrollTop = 0; }
    function fermerApercu() { document.body.classList.remove("apercu-ouvert"); }

    const cout = h("span", { class: "small cout" });
    function majCout() { const u = D.tableau && D.tableau.usage; cout.textContent = u && u.jour ? "Aujourd'hui : " + u.jour.n + " message" + (u.jour.n > 1 ? "s" : "") + " · " + euros(Number(u.jour.cout_usd || 0)) : ""; }
    majCout();
    const entete = h("header", { class: "atelier-head" },
      h("div", { class: "grow" }, h("a", { class: "eyebrow retour-appli", href: "../" }, "‹ Révisions"), h("h1", null, "Créer un exercice")),
      h("div", { class: "atelier-outils" },
        h("div", { class: "segmented petit", role: "group", "aria-label": "Qui crée ?" }, [["marcus", CFG.prenom || "Marcus"], ["parent", "Un parent"]].map(([v, l]) => h("button", { "aria-pressed": AUTEUR() === v ? "true" : "false", onclick: () => { lsSet("par.auteur", v); render(); } }, l))),
        cout,
        C.exercice ? h("button", { class: "btn quiet petit apercu-btn", onclick: ouvrirApercu }, "Voir l'aperçu") : null,
        C.messages.length ? h("button", { class: "btn quiet petit", onclick: () => { if (!confirm("Commencer une nouvelle conversation ? L'exercice en cours " + (C.exoId ? "reste enregistré dans « Exercices »." : "non publié sera perdu."))) return; C = vide(); sauver(); render(); } }, "Nouvelle conversation") : null));
    peindreFil(); peindreApercu();
    document.body.classList.remove("apercu-ouvert");
    document.querySelectorAll("body > .apercu").forEach(x => x.remove());
    return h("div", { class: "view atelier" }, entete, h("div", { class: "atelier-grille" }, h("section", { class: "conversation" }, liste, composer), apercu));
  }

  async function corrigerApercu(it, reponse, exo) {
    try {
      const d = await fonction("corriger", { code: CODE, matiere: MATIERES[exo.matiere] || exo.matiere, recto: it.question, verso: it.attendu, plus: it.explication || "", reponse }, 20000);
      return d.verdict ? { verdict: d.verdict, correction: d.correction + (d.astuce ? " " + d.astuce : "") } : null;
    } catch (e) { return null; }
  }

  /* ---------- pièces jointes et dictée ---------- */
  function enBase64(f) { return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(f); }); }
  function compresser(f, max = 1600, q = .72) {
    return new Promise((ok, ko) => {
      const img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", q).split(",")[1]); };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("image")); };
      img.src = url;
    });
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let ecoute = null;
  function dicter(champ, btn, apres) {
    if (!SR) return toast("La dictée n'est pas disponible dans ce navigateur (utilisez Safari sur iPhone/iPad ou Chrome).");
    if (ecoute) { ecoute.stop(); return; }
    const rec = new SR(); rec.lang = "fr-FR"; rec.continuous = true; rec.interimResults = true;
    const base = champ.value ? champ.value.replace(/\s*$/, " ") : "";
    let final = "";
    rec.onresult = e => { let inter = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) final += t; else inter += t; } champ.value = base + final + inter; apres(); };
    rec.onend = () => { ecoute = null; btn.classList.remove("on"); };
    rec.onerror = ev => { if (ev.error === "not-allowed") toast("Autorisez le micro pour dicter."); };
    try { rec.start(); ecoute = rec; btn.classList.add("on"); toast("Je t'écoute… touche le micro pour arrêter."); } catch (e) {}
  }
  function svgIco(n) {
    const P = { mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', clip: '<path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1L13 4.3a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4l7.1-7.1"/>', send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>' };
    const s = document.createElement("span"); s.innerHTML = '<svg viewBox="0 0 24 24">' + P[n] + "</svg>"; return s.firstChild;
  }

  /* ---------- exercices publiés et brouillons ---------- */
  function vExercices() {
    const t = D.tableau, exos = (t && t.exercices) || [];
    const groupe = (titre, l) => l.length ? h("section", { class: "sec" }, h("h2", null, titre), h("div", { class: "exo-liste" }, l.map(ligneExo))) : null;
    return h("div", { class: "view" },
      h("header", null, h("div", { class: "eyebrow" }, "Exercices"), h("h1", null, "Exercices de " + (CFG.prenom || "Marcus"))),
      !exos.length ? h("div", { class: "empty-box" }, h("strong", null, "Aucun exercice pour l'instant"), "Crée-en un dans l'onglet Créer : il apparaîtra ici, avec les notes de " + (CFG.prenom || "Marcus") + ".") : null,
      groupe("Publiés", exos.filter(e => e.statut === "publie")),
      groupe("Brouillons", exos.filter(e => e.statut === "brouillon")),
      groupe("Retirés (30 derniers jours)", exos.filter(e => e.statut === "retire")));
  }
  function ligneExo(e) {
    const r = e.resultats || [], der = r[0];
    return h("div", { class: "exo-l" },
      h("a", { class: "exo-l-main", href: "#/exercices/" + e.id },
        h("span", { class: "chip" }, MATIERES[e.matiere] || e.matiere),
        h("b", null, e.titre),
        h("span", { class: "small" }, Exos.resume(e.contenu)),
        h("span", { class: "small" }, der ? "Dernière note : " + note(der.score, der.total) + "/20 le " + frDate(der.ts, { day: "numeric", month: "short" }) + " · " + r.length + " essai" + (r.length > 1 ? "s" : "") : e.statut === "publie" ? "Pas encore fait par " + (CFG.prenom || "Marcus") : "")),
      h("div", { class: "row" },
        h("button", { class: "btn quiet petit", onclick: () => reprendre(e) }, "Retoucher"),
        e.statut === "publie" ? h("button", { class: "btn quiet petit", onclick: () => changerStatut(e, "retire") }, "Retirer") :
          h("button", { class: "btn quiet petit", onclick: () => changerStatut(e, "publie") }, "Publier")));
  }
  function reprendre(e) {
    if (C.messages.length && C.exoId !== e.id && !confirm("Ouvrir cet exercice dans l'onglet Créer ? La conversation en cours sera remplacée.")) return;
    C = { messages: [{ role: "assistant", texte: "Voici l'exercice « " + e.titre + " ». Dis-moi ce que tu veux changer : je renverrai une version complète à republier.", exercice: e.contenu, version: 1 }], exercice: e.contenu, exoId: e.id, statut: e.statut, version: 1 };
    sauver(); location.hash = "#/";
  }
  async function changerStatut(e, statut) {
    if (statut === "retire" && !confirm("Retirer « " + e.titre + " » de l'appli de " + (CFG.prenom || "Marcus") + " ? Ses notes sont conservées.")) return;
    try { await rpc("parent_statut", { code: CODE, p_id: e.id, p_statut: statut }); await chargerTableau(); toast(statut === "publie" ? "Publié." : "Retiré de son appli."); render(); }
    catch (err) { toast("Échec. Réessayez."); }
  }
  function vResultats(id) {
    const e = ((D.tableau && D.tableau.exercices) || []).find(x => x.id === id);
    if (!e) return vExercices();
    const r = e.resultats || [], der = r[0];
    const plats = []; (e.contenu.parties || []).forEach(p => (p.items || []).forEach(it => plats.push(it)));
    const libelle = it => (it.question || it.affirmation || it.consigne || (it.texte || "").replace(/\[\[([^\]|]+)[^\]]*\]\]/g, "…")).slice(0, 140);
    const rates = der && der.details ? der.details.filter(d => d.s < .99) : [];
    return h("div", { class: "view" },
      h("div", { class: "topbar" }, h("a", { class: "back", href: "#/exercices" }, "‹ Exercices")),
      h("header", null, h("div", { class: "eyebrow" }, (MATIERES[e.matiere] || e.matiere) + (e.chapitre ? " · " + e.chapitre : "")), h("h1", null, e.titre)),
      h("div", { class: "kpis" },
        h("div", { class: "kpi" }, h("b", null, der ? note(der.score, der.total) : "–"), h("span", null, "dernière note sur 20")),
        h("div", { class: "kpi" }, h("b", null, r.length), h("span", null, "essai" + (r.length > 1 ? "s" : ""))),
        h("div", { class: "kpi" }, h("b", null, der && der.duree_s ? Math.max(1, Math.round(der.duree_s / 60)) : "–"), h("span", null, "minutes (dernier essai)"))),
      r.length > 1 ? h("section", { class: "card" }, h("h2", null, "Historique"), h("ul", { class: "log" }, r.slice(0, 10).map(x => h("li", null, h("span", null, note(x.score, x.total) + " / 20"), h("span", null, frDate(x.ts, { weekday: "short", day: "numeric", month: "short" }) + " " + new Date(x.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })))))) : null,
      der ? h("section", { class: "card" }, h("h2", null, rates.length ? "Questions ratées au dernier essai" : "Tout juste au dernier essai"),
        rates.length ? h("ul", { class: "log rates" }, rates.map(d => { const it = plats[d.n - 1] || {}; return h("li", null, h("span", null, "Q" + d.n + " · " + libelle(it)), h("span", null, d.s > 0 ? Math.round(d.s * 100) + " %" : "faux")); })) : null) : h("div", { class: "empty-box" }, (CFG.prenom || "Marcus") + " n'a pas encore fait cet exercice."),
      h("section", { class: "card" }, h("h2", null, "Corrigé"), Exos.solutions(e.contenu)),
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => reprendre(e) }, "Retoucher avec Claude")));
  }

  /* ---------- suivi de Marcus ---------- */
  function vSuivi() {
    const t = D.tableau || {}, pr = t.progression && t.progression.donnees || {};
    const auj = ymd(new Date()), jours = pr.days || {};
    let serie = 0; { let d = new Date(); if (!jours[ymd(d)]) d.setDate(d.getDate() - 1); while (jours[ymd(d)]) { serie++; d.setDate(d.getDate() - 1); } }
    let sept = 0; for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); sept += jours[ymd(d)] || 0; }
    const barres = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); barres.push({ d: ymd(d), n: jours[ymd(d)] || 0 }); }
    const max = Math.max(5, ...barres.map(x => x.n));
    // notions fragiles (même calcul que l'appli de Marcus)
    const mn = {};
    for (const [id, p] of Object.entries(pr.cards || {})) { const c = D.cartes[id]; if (!c) continue; const k = c.notion || "Divers"; const o = mn[k] || (mn[k] = { notion: k, m: c.matiere, ok: 0, ko: 0, mid: 0 }); o.ok += p.ok || 0; o.ko += p.ko || 0; o.mid += p.mid || 0; }
    const fragiles = Object.values(mn).map(o => { const n = o.ok + o.ko + o.mid; return { ...o, n, rate: n ? (o.ok + o.mid * .5) / n : 1 }; }).filter(o => o.n >= 3 && o.rate < .75).sort((a, b) => a.rate - b.rate).slice(0, 8);
    const sessions = (pr.sessions || []).slice(-8).reverse();
    const notes = ((t.exercices) || []).flatMap(e => (e.resultats || []).map(r => ({ e, r }))).sort((a, b) => Date.parse(b.r.ts) - Date.parse(a.r.ts)).slice(0, 8);
    const classe = lsGet("par.classe", "");
    const dst = window.DST ? DST.prochains(classe) : [];
    const u = t.usage || {};
    return h("div", { class: "view" },
      h("header", null, h("div", { class: "eyebrow" }, "Suivi"), h("h1", null, "Où en est " + (CFG.prenom || "Marcus")),
        t.progression ? h("p", { class: "small", style: { margin: "6px 0 0" } }, "Dernière activité : " + frDate(t.progression.maj, { weekday: "long", day: "numeric", month: "long" }) + " à " + new Date(t.progression.maj).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + (t.progression.appareil ? " (" + t.progression.appareil + ")" : "")) : null),
      h("div", { class: "kpis" },
        h("div", { class: "kpi" }, h("b", null, serie), h("span", null, "jours d'affilée")),
        h("div", { class: "kpi" }, h("b", null, sept), h("span", null, "cartes révisées sur 7 jours")),
        h("div", { class: "kpi" }, h("b", null, notes.length ? note(notes[0].r.score, notes[0].r.total) : "–"), h("span", null, "dernière note d'exercice")),
        h("div", { class: "kpi" }, h("b", null, (pr.alertes || []).length), h("span", null, "réponse" + ((pr.alertes || []).length > 1 ? "s" : "") + " signalée" + ((pr.alertes || []).length > 1 ? "s" : "")))),
      h("section", { class: "card" }, h("div", { class: "sec-head" }, h("h2", null, "Prochains DST"),
          h("div", { class: "segmented petit", role: "group", "aria-label": "Classe" }, (window.DST ? DST.classes() : []).map(c => h("button", { "aria-pressed": classe === c.id ? "true" : "false", onclick: () => { lsSet("par.classe", classe === c.id ? "" : c.id); render(); } }, c.nom.replace("2nde ", ""))))),
        dst.map(s => h("div", { class: "dst-ligne" }, h("b", null, s.quand), h("span", null, s.epreuves.length ? s.epreuves.map(e => e.nom + " (" + e.heures + " h" + (e.date ? ", " + frDate(e.date, { weekday: "short", day: "numeric", month: "short" }) + " " + e.heure : "") + ")").join(" · ") : s.vacances || "Pas de DST")))),
      h("section", { class: "card" }, h("h2", null, "Cartes révisées, 14 derniers jours"),
        h("div", { class: "bars", role: "img", "aria-label": barres.map(x => x.d + " : " + x.n).join(", ") }, barres.map(x => h("div", { title: frDate(x.d, { weekday: "short", day: "numeric" }) + " : " + x.n }, h("i", { class: x.n ? "" : "zero", style: { height: (x.n / max * 100) + "%" } }), h("span", null, frDate(x.d, { weekday: "narrow" })))))),
      h("section", { class: "card" }, h("h2", null, "Notions fragiles"),
        fragiles.length ? h("ul", { class: "log" }, fragiles.map(o => h("li", null, h("span", null, o.m + " · " + o.notion), h("span", null, Math.round(o.rate * 100) + " % de réussite")))) : h("p", { class: "small", style: { margin: 0 } }, "Pas assez de réponses pour repérer des notions fragiles."),
        fragiles.length ? h("button", { class: "btn quiet petit", onclick: () => { C = vide(); sauver(); location.hash = "#/"; setTimeout(() => { const s = $(".saisie"); if (s) { s.value = "Prépare un exercice de remédiation sur ces notions où Marcus se trompe souvent : " + fragiles.slice(0, 4).map(o => o.notion + " (" + o.m + ")").join(", ") + "."; s.dispatchEvent(new Event("input")); s.focus(); } }, 80); } }, "Créer un exercice sur ces notions") : null),
      h("section", { class: "card" }, h("h2", null, "Notes aux exercices"),
        notes.length ? h("ul", { class: "log" }, notes.map(({ e, r }) => h("li", null, h("span", null, e.titre), h("span", null, note(r.score, r.total) + "/20 · " + frDate(r.ts, { day: "numeric", month: "short" }))))) : h("p", { class: "small", style: { margin: 0 } }, "Aucun exercice fait pour l'instant.")),
      h("section", { class: "card" }, h("h2", null, "Dernières séances de flashcards"),
        sessions.length ? h("ul", { class: "log" }, sessions.map(s => h("li", null, h("span", null, s.titre + " · " + s.ok + " sues, " + s.mid + " presque, " + s.ko + " à revoir"), h("span", null, new Date(s.t).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + (s.min ? " · " + s.min + " min" : ""))))) : h("p", { class: "small", style: { margin: 0 } }, "Aucune séance pour l'instant.")),
      (pr.alertes || []).length ? h("section", { class: "card", style: { borderColor: "var(--ko)" } }, h("h2", null, "À regarder"), h("p", { class: "small", style: { margin: 0 } }, "La correction par l'IA a signalé " + pr.alertes.length + " réponse(s) hors sujet ou préoccupante(s), la dernière le " + frDate(new Date(pr.alertes[pr.alertes.length - 1].t).toISOString(), { day: "numeric", month: "long" }) + ". Le contenu n'est pas conservé.")) : null,
      h("section", { class: "card" }, h("h2", null, "Coût du mode création"),
        h("p", { class: "small", style: { margin: 0 } }, "Aujourd'hui : " + ((u.jour && u.jour.n) || 0) + " message(s), " + euros(Number((u.jour && u.jour.cout_usd) || 0)) + " · ce mois-ci : " + euros(Number((u.mois && u.mois.cout_usd) || 0)) + ". Plafond : 80 messages ou environ 2,80 € par jour."),
        h("div", { class: "row" }, h("button", { class: "btn quiet petit", onclick: () => { if (confirm("Fermer le mode création sur cet appareil ? Le code famille sera redemandé.")) { CODE = ""; lsSet("par.code", ""); render(); } } }, "Fermer le mode création sur cet appareil"),
          h("a", { class: "btn quiet petit", href: "../", target: "_blank", rel: "noopener" }, "Ouvrir l'appli de " + (CFG.prenom || "Marcus")))),
      h("p", { class: "small", style: { textAlign: "center" } }, "Mode création · version " + VERSION));
  }

  /* ---------- thème et démarrage ---------- */
  function applyTheme() {
    const t = lsGet("rev.theme", "dark"), dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
  async function demarrer() {
    await Promise.all([chargerCatalogue(), window.DST ? DST.charger("../dst.json") : null]);
    try { await chargerTableau(); } catch (e) { if (e.badCode) toast("Le code famille a changé : entre le nouveau code."); }
    if (!$(".saisie") || !$(".saisie").value) render();
  }
  if ("serviceWorker" in navigator && location.protocol !== "file:") addEventListener("load", () => navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {}));
  applyTheme();
  render();
  if (CODE) demarrer(); else Promise.all([chargerCatalogue(), window.DST ? DST.charger("../dst.json") : null]);
})();
