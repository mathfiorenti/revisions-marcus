/* Prochains DST (devoirs sur table) : semaine en cours et semaine suivante, d'après dst.json.
   Partagé entre l'appli de Marcus et l'espace parents. window.DST.charger(url) puis window.DST.prochains(classe). */
(function () {
  "use strict";
  let data = null;
  const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const plus = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  function lundiDe(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return ymd(x); }

  async function charger(url) {
    try { const r = await fetch(url || "dst.json", { cache: "no-cache" }); data = await r.json(); try { localStorage.setItem("rev.dst", JSON.stringify(data)); } catch (e) {} }
    catch (e) { try { data = JSON.parse(localStorage.getItem("rev.dst") || "null"); } catch (er) { data = null; } }
    return data;
  }

  // Renvoie [{ quand: "Cette semaine" | "Semaine prochaine", lundi, vacances, epreuves: [{ code, nom, id, heures, date, heure, passe, dans }] }]
  function prochains(classe, maintenant) {
    if (!data) return [];
    const now = maintenant || new Date(), auj = ymd(now), l0 = lundiDe(now);
    const cl = classe && data.classes[classe];
    return [[l0, "Cette semaine"], [plus(l0, 7), "Semaine prochaine"]].map(([lundi, quand]) => {
      const sem = data.semaines.find(s => s.lundi === lundi);
      const vac = (data.vacances || []).find(v => v.lundi === lundi);
      const epreuves = (sem ? sem.epreuves : []).map(([code, heures]) => {
        const m = data.matieres[code] || { nom: code, id: null };
        const date = cl ? plus(lundi, cl.jour) : null;
        const ref = date || plus(lundi, 4);
        const dans = Math.round((parse(ref) - parse(auj)) / 864e5);
        return { code, nom: m.nom, id: m.id, heures, date, heure: cl ? cl.heure : null, passe: date ? date < auj : false, dans };
      });
      return { quand, lundi, vacances: vac ? vac.nom : null, epreuves };
    });
  }
  function classes() { return data ? Object.entries(data.classes).map(([id, c]) => ({ id, ...c })) : []; }
  function infos() { return data ? { lieu: data.lieu, arrivee: data.arrivee, source: data.source } : {}; }
  window.DST = { charger, prochains, classes, infos };
})();
