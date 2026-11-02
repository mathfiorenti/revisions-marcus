/* Moteur d'exercices interactifs — partagé entre l'appli de Marcus et l'espace parents.
   Format d'un exercice (JSON) :
   { titre, matiere, chapitre, chapitre_id, consigne, duree, niveau: "standard"|"exigeant", banque?: [mots],
     parties: [ { titre, consigne, banque?, items: [ item ] } ] }
   Types d'items :
     trous     { texte: "She [[has lived|'s lived]] here [[since]] 2019.", explication }
     qcm       { question, choix: [..], bonne: index, explication }
     vraifaux  { affirmation, vrai: true|false, explication }
     associer  { consigne?, paires: [[gauche, droite], ..], explication }
     ordre     { consigne?, elements: [.. dans le bon ordre ..], explication }
     ouverte   { question, attendu, explication? }   (corrigée par l'IA si possible)
   API : Exos.rendre(exo, { mode: "eleve"|"apercu", corriger: async (item, reponse) => ({ verdict: "ok"|"mid"|"ko", correction }), onFini })
         Exos.solutions(exo) → élément qui montre toutes les réponses ; Exos.verifier(exo) → liste de problèmes ; Exos.resume(exo) */
(function () {
  "use strict";
  const TYPES = { trous: "Texte à trous", qcm: "QCM", vraifaux: "Vrai ou faux", associer: "Associer", ordre: "Remettre dans l'ordre", ouverte: "Question rédigée" };

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
  const melange = a => { a = a.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  const norm = t => String(t == null ? "" : t).replace(/[’‘`´]/g, "'").replace(/[“”«»]/g, '"').replace(/ /g, " ").replace(/\s+/g, " ").trim().replace(/[.!?;:,]+$/, "").toLowerCase();
  // Texte simple avec **gras** et sauts de ligne, sans HTML injecté.
  function riche(t) {
    const f = document.createDocumentFragment();
    String(t || "").split(/\n/).forEach((ligne, i) => {
      if (i) f.append(h("br"));
      ligne.split(/(\*\*[^*]+\*\*)/).forEach(m => { if (/^\*\*[^*]+\*\*$/.test(m)) f.append(h("strong", null, m.slice(2, -2))); else if (m) f.append(m); });
    });
    return f;
  }
  function trousDe(texte) {
    const out = []; const re = /\[\[([^\]]+)\]\]/g; let m, last = 0;
    while ((m = re.exec(texte))) { out.push({ t: texte.slice(last, m.index) }); out.push({ r: m[1].split("|").map(s => s.trim()).filter(Boolean) }); last = re.lastIndex; }
    out.push({ t: texte.slice(last) });
    return out;
  }
  function items(exo) { const l = []; (exo.parties || []).forEach((p, pi) => (p.items || []).forEach((it, ii) => l.push({ it, pi, ii }))); return l; }
  function resume(exo) {
    const l = items(exo), types = [...new Set(l.map(x => TYPES[x.it.type] || x.it.type))];
    return l.length + " question" + (l.length > 1 ? "s" : "") + (types.length ? " · " + types.join(", ").toLowerCase() : "") + (exo.duree ? " · ≈ " + exo.duree + " min" : "");
  }
  function verifier(exo) {
    const pb = [];
    if (!exo || typeof exo !== "object") return ["Exercice vide"];
    if (!exo.titre) pb.push("Titre manquant");
    if (!Array.isArray(exo.parties) || !exo.parties.length) pb.push("Aucune partie");
    items(exo).forEach(({ it }, n) => {
      const q = "Question " + (n + 1) + " : ";
      if (!TYPES[it.type]) pb.push(q + "type inconnu « " + it.type + " »");
      else if (it.type === "trous" && !/\[\[[^\]]+\]\]/.test(it.texte || "")) pb.push(q + "aucun trou");
      else if (it.type === "qcm" && (!Array.isArray(it.choix) || it.choix.length < 2 || !(it.bonne >= 0 && it.bonne < it.choix.length))) pb.push(q + "choix ou bonne réponse invalides");
      else if (it.type === "vraifaux" && typeof it.vrai !== "boolean") pb.push(q + "vrai/faux non précisé");
      else if (it.type === "associer" && (!Array.isArray(it.paires) || it.paires.length < 2)) pb.push(q + "pas assez de paires");
      else if (it.type === "ordre" && (!Array.isArray(it.elements) || it.elements.length < 2)) pb.push(q + "pas assez d'éléments");
      else if (it.type === "ouverte" && !it.attendu) pb.push(q + "réponse attendue manquante");
    });
    return pb;
  }

  /* ---------- un item : construit l'interface, renvoie { el, corriger: async () => score 0..1, reponse } ---------- */
  function construireItem(it, opts) {
    const box = h("div", { class: "ex-q" });
    let lire = () => null, noter = async () => 0, montrer = () => {};
    if (it.type === "trous") {
      const parts = trousDe(it.texte || ""), champs = [];
      const p = h("p", { class: "ex-trous" });
      parts.forEach(x => {
        if (x.t != null) { p.append(riche(x.t)); return; }
        const larg = Math.max(4, Math.min(28, Math.max(...x.r.map(s => s.length)) + 2));
        const inp = h("input", { class: "ex-gap", type: "text", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", style: { width: larg + "ch" }, "aria-label": "Trou à compléter" });
        champs.push({ inp, r: x.r }); p.append(inp);
      });
      box.append(p);
      lire = () => champs.map(c => c.inp.value);
      noter = async () => {
        let ok = 0;
        champs.forEach(c => {
          const bon = c.r.some(r => norm(r) === norm(c.inp.value));
          c.inp.classList.add(bon ? "ok" : "ko"); c.inp.readOnly = true; if (bon) ok++;
          if (!bon) c.inp.after(h("span", { class: "ex-fix" }, c.r[0]));
        });
        return champs.length ? ok / champs.length : 0;
      };
      montrer = () => champs.forEach(c => { c.inp.value = c.r[0]; c.inp.classList.add("ok"); c.inp.readOnly = true; });
    } else if (it.type === "qcm" || it.type === "vraifaux") {
      const choix = it.type === "qcm" ? (it.choix || []) : ["Vrai", "Faux"];
      const bonne = it.type === "qcm" ? it.bonne : (it.vrai ? 0 : 1);
      if (it.type === "qcm") box.append(h("p", { class: "ex-enonce" }, riche(it.question)));
      else box.append(h("p", { class: "ex-enonce" }, riche(it.affirmation)));
      let sel = -1;
      const ordre = it.type === "qcm" && it.melanger !== false ? melange(choix.map((c, i) => i)) : choix.map((c, i) => i);
      const btns = ordre.map(i => h("button", { type: "button", class: "ex-choix", "aria-pressed": "false", onclick: e => { if (box.dataset.fini) return; sel = i; btns.forEach(b => b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false")); } }, riche(choix[i])));
      btns.forEach((b, k) => (b.dataset.i = ordre[k]));
      box.append(h("div", { class: "ex-choix-l" + (it.type === "vraifaux" ? " vf" : "") }, btns));
      lire = () => sel;
      noter = async () => { btns.forEach(b => { const i = +b.dataset.i; if (i === bonne) b.classList.add("ok"); else if (i === sel) b.classList.add("ko"); b.disabled = true; }); return sel === bonne ? 1 : 0; };
      montrer = () => btns.forEach(b => { if (+b.dataset.i === bonne) b.classList.add("ok"); b.disabled = true; });
    } else if (it.type === "associer") {
      if (it.consigne) box.append(h("p", { class: "ex-enonce" }, riche(it.consigne)));
      const paires = it.paires || [], droites = melange(paires.map(p => p[1]));
      const sels = paires.map(([g]) => {
        const s = h("select", { class: "ex-sel", "aria-label": "Associer à " + g }, h("option", { value: "" }, "Choisir…"), droites.map(d => h("option", { value: d }, d)));
        return s;
      });
      box.append(h("div", { class: "ex-assoc" }, paires.map(([g], i) => h("div", { class: "ex-assoc-l" }, h("span", { class: "ex-g" }, riche(g)), sels[i]))));
      lire = () => sels.map(s => s.value);
      noter = async () => { let ok = 0; sels.forEach((s, i) => { const bon = s.value === paires[i][1]; s.classList.add(bon ? "ok" : "ko"); s.disabled = true; if (bon) ok++; else s.after(h("span", { class: "ex-fix" }, paires[i][1])); }); return paires.length ? ok / paires.length : 0; };
      montrer = () => sels.forEach((s, i) => { s.value = paires[i][1]; s.classList.add("ok"); s.disabled = true; });
    } else if (it.type === "ordre") {
      if (it.consigne) box.append(h("p", { class: "ex-enonce" }, riche(it.consigne)));
      const bons = it.elements || [];
      let cur = melange(bons.map((e, i) => i)); if (cur.every((v, i) => v === i) && cur.length > 1) cur.reverse();
      const liste = h("ol", { class: "ex-ordre" });
      const peindre = () => liste.replaceChildren(...cur.map((i, pos) => h("li", { "data-i": i },
        h("span", { class: "ex-o-t" }, riche(bons[i])),
        h("span", { class: "ex-o-b" },
          h("button", { type: "button", "aria-label": "Monter", disabled: pos === 0 || box.dataset.fini ? true : null, onclick: () => { [cur[pos - 1], cur[pos]] = [cur[pos], cur[pos - 1]]; peindre(); } }, "↑"),
          h("button", { type: "button", "aria-label": "Descendre", disabled: pos === cur.length - 1 || box.dataset.fini ? true : null, onclick: () => { [cur[pos + 1], cur[pos]] = [cur[pos], cur[pos + 1]]; peindre(); } }, "↓")))));
      peindre(); box.append(liste);
      lire = () => cur.slice();
      noter = async () => { const ok = cur.filter((v, i) => v === i).length; box.dataset.fini = "1"; peindre(); [...liste.children].forEach((li, pos) => li.classList.add(cur[pos] === pos ? "ok" : "ko")); if (ok < bons.length) box.append(h("p", { class: "ex-fix-bloc" }, "Bon ordre : ", bons.join(" → "))); return bons.length ? ok / bons.length : 0; };
      montrer = () => { cur = bons.map((e, i) => i); box.dataset.fini = "1"; peindre(); };
    } else if (it.type === "ouverte") {
      box.append(h("p", { class: "ex-enonce" }, riche(it.question)));
      const ta = h("textarea", { class: "ex-ta", rows: "4", placeholder: "Ta réponse…" });
      box.append(ta);
      lire = () => ta.value;
      noter = async () => {
        ta.readOnly = true;
        const rep = ta.value.trim();
        const fb = h("div", { class: "ex-ia" }, "Correction en cours…");
        box.append(fb);
        let res = null;
        if (rep && opts.corriger) { try { res = await opts.corriger(it, rep); } catch (e) { res = null; } }
        if (res && res.verdict) {
          fb.className = "ex-ia " + res.verdict; fb.replaceChildren(h("strong", null, res.verdict === "ok" ? "Juste" : res.verdict === "mid" ? "Incomplet" : "À revoir"), " · ", res.correction || "", h("span", { class: "ex-ia-src" }, "Correction par une IA"));
          return res.verdict === "ok" ? 1 : res.verdict === "mid" ? .5 : 0;
        }
        // sans IA : l'élève compare lui-même à la réponse attendue
        return await new Promise(resolve => {
          const choisir = v => { fb.querySelectorAll("button").forEach(b => (b.disabled = true)); resolve(v); };
          fb.replaceChildren(h("div", null, h("strong", null, "Réponse attendue : "), riche(it.attendu)), h("div", { class: "small" }, rep ? "Compare avec ta réponse :" : "Pas de réponse. Lis la réponse attendue :"),
            h("div", { class: "ex-auto" }, h("button", { type: "button", onclick: () => choisir(1) }, "J'avais bon"), h("button", { type: "button", onclick: () => choisir(.5) }, "À moitié"), h("button", { type: "button", onclick: () => choisir(0) }, "Pas bon")));
        });
      };
      montrer = () => { ta.value = it.attendu || ""; ta.readOnly = true; };
    }
    return { el: box, lire, noter, montrer };
  }

  function rendre(exo, opts) {
    opts = opts || {};
    const t0 = Date.now(), liste = items(exo), etats = [];
    const racine = h("div", { class: "ex" + (opts.mode === "apercu" ? " ex-apercu" : "") });
    const score = h("div", { class: "ex-score", hidden: true });
    const entete = h("div", { class: "ex-head" },
      h("div", { class: "ex-meta" }, [exo.niveau === "exigeant" ? h("span", { class: "ex-badge" }, "Niveau exigeant") : null, h("span", null, resume(exo))]),
      exo.consigne ? h("p", { class: "ex-consigne" }, riche(exo.consigne)) : null,
      exo.banque && exo.banque.length ? h("div", { class: "ex-banque" }, h("span", null, "Banque de mots : "), exo.banque.map(m => h("span", { class: "ex-mot" }, m))) : null);
    racine.append(entete);
    let n = 0;
    (exo.parties || []).forEach((p, pi) => {
      const sec = h("section", { class: "ex-partie" }, p.titre ? h("h3", null, p.titre) : null, p.consigne ? h("p", { class: "ex-consigne" }, riche(p.consigne)) : null,
        p.banque && p.banque.length ? h("div", { class: "ex-banque" }, h("span", null, "Banque de mots : "), p.banque.map(m => h("span", { class: "ex-mot" }, m))) : null);
      (p.items || []).forEach((it, ii) => {
        n++;
        const ui = construireItem(it, opts);
        const etat = { it, ui, s: null, num: n };
        etats.push(etat);
        const expl = h("div", { class: "ex-expl", hidden: true }, it.explication ? riche(it.explication) : null);
        const btn = h("button", { type: "button", class: "ex-verif", onclick: async () => {
          if (etat.s != null) return;
          btn.disabled = true; btn.textContent = "…";
          etat.s = await ui.noter();
          ui.el.dataset.fini = "1";
          carte.classList.add(etat.s >= .99 ? "ok" : etat.s > 0 ? "mid" : "ko");
          btn.replaceWith(h("span", { class: "ex-res" }, etat.s >= .99 ? "✓ Juste" : etat.s > 0 ? "≈ En partie (" + Math.round(etat.s * 100) + " %)" : "✗ À revoir"));
          if (it.explication) expl.hidden = false;
          maj();
        } }, it.type === "ouverte" ? "Faire corriger" : "Vérifier");
        const carte = h("div", { class: "ex-item" }, h("div", { class: "ex-num" }, h("span", null, n), h("span", { class: "ex-type" }, TYPES[it.type] || "")), ui.el, h("div", { class: "ex-foot" }, btn), expl);
        sec.append(carte);
      });
      racine.append(sec);
    });
    const fin = h("button", { type: "button", class: "btn ex-fin", onclick: async () => {
      // corrige d'un coup ce qui reste
      fin.disabled = true;
      for (const b of racine.querySelectorAll(".ex-verif")) { if (!b.disabled) b.click(); }
      await new Promise(r => { const t = setInterval(() => { if (etats.every(e => e.s != null)) { clearInterval(t); r(); } }, 120); });
      bilan();
    } }, "Terminer et voir ma note");
    racine.append(score, fin);
    function maj() { if (etats.every(e => e.s != null) && !score.dataset.fait) bilan(); }
    function bilan() {
      if (score.dataset.fait) return; score.dataset.fait = "1";
      const total = etats.length, pts = etats.reduce((s, e) => s + (e.s || 0), 0);
      const sur20 = total ? Math.round(pts / total * 200) / 10 : 0;
      fin.hidden = true; score.hidden = false;
      const erreurs = etats.filter(e => e.s < .99).length;
      score.replaceChildren(h("div", { class: "ex-note" }, h("b", null, String(sur20).replace(".", ",")), h("span", null, "/ 20")),
        h("p", null, sur20 >= 16 ? "Excellent travail." : sur20 >= 12 ? "Bien. Relis les explications des questions ratées." : sur20 >= 8 ? "C'est en route. Refais l'exercice après avoir relu ton cours." : "Reprends ton cours, puis refais l'exercice."),
        h("div", { class: "row" }, h("button", { type: "button", class: "btn quiet", onclick: () => opts.refaire ? opts.refaire() : null }, "Refaire l'exercice"),
          erreurs && opts.mode !== "apercu" ? h("span", { class: "small" }, erreurs + " question" + (erreurs > 1 ? "s" : "") + " à revoir") : null));
      score.scrollIntoView({ behavior: "smooth", block: "center" });
      if (opts.onFini) opts.onFini({ score: Math.round(pts * 100) / 100, total, sur20, duree: Math.round((Date.now() - t0) / 1000), details: etats.map(e => ({ n: e.num, t: e.it.type, s: Math.round(e.s * 100) / 100, r: e.ui.lire() })) });
    }
    return racine;
  }

  function solutions(exo) {
    const box = h("div", { class: "ex ex-sol" });
    let n = 0;
    (exo.parties || []).forEach(p => {
      const sec = h("section", { class: "ex-partie" }, p.titre ? h("h3", null, p.titre) : null);
      (p.items || []).forEach(it => {
        n++;
        let rep;
        if (it.type === "trous") { rep = h("p", { class: "ex-trous" }); trousDe(it.texte || "").forEach(x => x.t != null ? rep.append(riche(x.t)) : rep.append(h("mark", null, x.r.join(" / ")))); }
        else if (it.type === "qcm") rep = h("div", null, h("p", null, riche(it.question)), h("ul", null, (it.choix || []).map((c, i) => h("li", { class: i === it.bonne ? "bon" : "" }, riche(c)))));
        else if (it.type === "vraifaux") rep = h("p", null, riche(it.affirmation), " → ", h("mark", null, it.vrai ? "Vrai" : "Faux"));
        else if (it.type === "associer") rep = h("ul", null, (it.paires || []).map(([g, d]) => h("li", null, riche(g), " → ", h("mark", null, d))));
        else if (it.type === "ordre") rep = h("ol", null, (it.elements || []).map(e => h("li", null, riche(e))));
        else if (it.type === "ouverte") rep = h("div", null, h("p", null, riche(it.question)), h("p", null, h("strong", null, "Attendu : "), riche(it.attendu)));
        sec.append(h("div", { class: "ex-item" }, h("div", { class: "ex-num" }, h("span", null, n), h("span", { class: "ex-type" }, TYPES[it.type] || it.type)), rep || "", it.explication ? h("div", { class: "ex-expl" }, riche(it.explication)) : null));
      });
      box.append(sec);
    });
    return box;
  }

  window.Exos = { rendre, solutions, verifier, resume, TYPES };
})();
