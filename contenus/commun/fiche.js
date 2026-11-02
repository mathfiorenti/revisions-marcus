/* Fiches natives : thème de l'appli, sommaire, apparitions, compteurs, cartes à retourner, impression. */
(function () {
  "use strict";
  const doc = document.documentElement;
  try {
    const t = JSON.parse(localStorage.getItem("rev.theme") || '"dark"');
    const sombre = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    doc.dataset.theme = sombre ? "dark" : "light";
  } catch (e) { doc.dataset.theme = "dark"; }
  const dansAppli = window.self !== window.top;

  function pret() {
    const body = document.body;
    if (dansAppli) body.classList.add("dans-appli");
    const page = document.querySelector(".f-page") || body;
    // barre de progression
    const barre = document.createElement("div"); barre.className = "f-barre"; body.prepend(barre);
    // sommaire à partir des sections titrées
    const sections = [...document.querySelectorAll("section.f-section[id]")].filter(s => s.querySelector("h2"));
    if (sections.length > 1 && !document.querySelector(".f-sommaire")) {
      const nav = document.createElement("nav"); nav.className = "f-sommaire"; nav.setAttribute("aria-label", "Sommaire");
      sections.forEach(s => { const a = document.createElement("a"); a.href = "#" + s.id; a.textContent = s.dataset.court || s.querySelector("h2").textContent.replace(/^\s*\d+\s*/, "").trim(); nav.append(a); });
      const hero = document.querySelector(".f-hero");
      if (hero) hero.after(nav); else page.prepend(nav);
      const liens = [...nav.querySelectorAll("a")];
      const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { liens.forEach(a => a.classList.toggle("actif", a.getAttribute("href") === "#" + e.target.id)); const a = nav.querySelector(".actif"); if (a) nav.scrollTo({ left: a.offsetLeft - 20, behavior: "smooth" }); } }), { rootMargin: "-30% 0px -60% 0px" });
      sections.forEach(s => obs.observe(s));
    }
    // apparitions au défilement
    const animables = document.querySelectorAll(".f-def,.f-retiens,.f-piege,.f-methode,.f-exemple,.f-question,.f-exo,.f-carte,.f-schema,.f-frise,.f-chiffres,.f-table-w,blockquote,.f-texte,.f-grille");
    document.querySelectorAll(".f-frise").forEach(f => [...f.children].forEach((li, i) => li.style.setProperty("--i", i)));
    if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("vu"); io.unobserve(e.target); compter(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
      animables.forEach(el => { if (el.closest(".f-grille") && !el.classList.contains("f-grille")) return; el.classList.add("f-anim"); io.observe(el); });
    }
    // compteurs : <b data-compte="476">476</b>
    function compter(racine) {
      racine.querySelectorAll("[data-compte]").forEach(el => {
        const cible = parseFloat(el.dataset.compte), suffixe = el.dataset.suffixe || "", t0 = performance.now(), dur = 1100;
        const dec = (String(el.dataset.compte).split(".")[1] || "").length;
        const pas = t => { const k = Math.min(1, (t - t0) / dur), v = cible * (1 - Math.pow(1 - k, 3)); el.textContent = v.toFixed(dec).replace(".", ",") + suffixe; if (k < 1) requestAnimationFrame(pas); };
        requestAnimationFrame(pas);
      });
    }
    // cartes à retourner
    document.querySelectorAll(".f-flip").forEach(f => { f.setAttribute("role", "button"); f.tabIndex = 0; const t = () => f.classList.toggle("ouvert"); f.addEventListener("click", t); f.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); t(); } }); });
    // hauteur des cartes à retourner = la plus grande face
    const ajusterFlips = () => document.querySelectorAll(".f-flip > div").forEach(d => { const r = d.querySelector(".recto"), v = d.querySelector(".verso"); if (r && v) { r.style.position = v.style.position = "relative"; const hmax = Math.max(r.offsetHeight, v.offsetHeight); r.style.position = v.style.position = ""; d.style.minHeight = hmax + "px"; } });
    ajusterFlips(); addEventListener("resize", ajusterFlips);
    // boutons : imprimer / PDF, haut de page
    const outils = document.createElement("div"); outils.className = "f-outils";
    const haut = document.createElement("button"); haut.className = "haut"; haut.setAttribute("aria-label", "Revenir en haut"); haut.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    haut.onclick = () => scrollTo({ top: 0, behavior: "smooth" });
    const imp = document.createElement("button"); imp.className = "imprimer"; imp.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="6" rx="1"/></svg><span>Imprimer / PDF</span>';
    imp.onclick = imprimer;
    outils.append(haut, imp); body.append(outils);
    const majDefil = () => { const h = doc.scrollHeight - innerHeight; barre.style.width = (h > 0 ? scrollY / h * 100 : 0) + "%"; haut.classList.toggle("on", scrollY > 600); };
    addEventListener("scroll", majDefil, { passive: true }); majDefil();
  }
  // Impression : tout est déplié (corrections, cartes) le temps de générer le PDF.
  function imprimer() {
    const fermes = [...document.querySelectorAll("details:not([open])")];
    fermes.forEach(d => (d.open = true));
    document.querySelectorAll(".f-anim").forEach(el => el.classList.add("vu"));
    const fin = () => { fermes.forEach(d => (d.open = false)); removeEventListener("afterprint", fin); };
    addEventListener("afterprint", fin);
    setTimeout(() => window.print(), 60);
  }
  addEventListener("beforeprint", () => { document.querySelectorAll("details").forEach(d => { if (!d.open) { d.dataset.ferme = "1"; d.open = true; } }); });
  addEventListener("afterprint", () => { document.querySelectorAll("details[data-ferme]").forEach(d => { d.open = false; delete d.dataset.ferme; }); });
  window.ficheImprimer = imprimer;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pret); else pret();
})();
