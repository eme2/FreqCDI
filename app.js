"use strict";

const STORAGE_KEY = "cdi-frequentation-v1";
const NIVEAUX = ["6e", "5e", "4e", "3e"];
const EXPORT_SCALE = 3;
const COULEURS_NIVEAUX = { "6e": "#2c5f8a", "5e": "#5a9bd5", "4e": "#f0b429", "3e": "#e2725b" };

function configurerCanvasHD(canvas) {
  const baseW = 540;
  const baseH = 280;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(baseW * dpr);
  canvas.height = Math.round(baseH * dpr);
  canvas.style.width = baseW + "px";
  canvas.style.maxWidth = "100%";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { baseW, baseH };
}

const CALENDRIERS = {
  "2024-2025": {
    rentree: "2024-09-02",
    finAnnee: "2025-07-04",
    noel: ["2024-12-21", "2025-01-06"],
    ponts: ["2025-05-30"],
    zones: {
      A: { hiver: ["2025-02-08", "2025-02-24"], printemps: ["2025-04-05", "2025-04-21"] },
      B: { hiver: ["2025-02-15", "2025-03-03"], printemps: ["2025-04-12", "2025-04-28"] },
      C: { hiver: ["2025-02-22", "2025-03-10"], printemps: ["2025-04-19", "2025-05-05"] },
    },
    vacances: [["2024-10-19", "2024-11-04"]],
  },
  "2025-2026": {
    rentree: "2025-09-01",
    finAnnee: "2026-07-03",
    noel: ["2025-12-20", "2026-01-05"],
    ponts: ["2026-05-15"],
    zones: {
      A: { hiver: ["2026-02-07", "2026-02-23"], printemps: ["2026-04-04", "2026-04-20"] },
      B: { hiver: ["2026-02-14", "2026-03-02"], printemps: ["2026-04-11", "2026-04-27"] },
      C: { hiver: ["2026-02-21", "2026-03-09"], printemps: ["2026-04-18", "2026-05-04"] },
    },
    vacances: [["2025-10-18", "2025-11-03"]],
  },
  "2026-2027": {
    rentree: "2026-09-01",
    finAnnee: "2027-07-02",
    noel: ["2026-12-19", "2027-01-04"],
    ponts: ["2027-05-07"],
    zones: {
      A: { hiver: ["2027-02-13", "2027-03-01"], printemps: ["2027-04-10", "2027-04-26"] },
      B: { hiver: ["2027-02-20", "2027-03-08"], printemps: ["2027-04-17", "2027-05-03"] },
      C: { hiver: ["2027-02-06", "2027-02-22"], printemps: ["2027-04-03", "2027-04-19"] },
    },
    vacances: [["2026-10-17", "2026-11-02"]],
  },
};

const state = {
  zone: "C",
  entries: {},
  fermetures: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.zone = ["A", "B", "C"].includes(data.zone) ? data.zone : "C";
      state.entries = data.entries && typeof data.entries === "object" ? data.entries : {};
      state.fermetures = Array.isArray(data.fermetures) ? data.fermetures : [];
    }
  } catch (e) {
    console.error("Lecture des données impossible", e);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function paques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jour));
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function joursFeries(annee) {
  const paquesAn = paques(annee);
  const lundiPaques = toISO(addDays(paquesAn, 1));
  const ascension = toISO(addDays(paquesAn, 39));
  const pentecote = toISO(addDays(paquesAn, 50));
  return [
    `${annee}-01-01`,
    lundiPaques,
    `${annee}-05-01`,
    `${annee}-05-08`,
    ascension,
    pentecote,
    `${annee}-11-01`,
    `${annee}-11-11`,
    `${annee}-12-25`,
  ];
}

function anneeScolaire(iso) {
  const annee = Number(iso.slice(0, 4));
  const mois = Number(iso.slice(5, 7));
  const debut = mois >= 9 ? annee : annee - 1;
  return `${debut}-${debut + 1}`;
}

function calendrierAnnee(anneeSco) {
  return CALENDRIERS[anneeSco] || null;
}

function vacancesZone(anneeSco, zone) {
  const cal = calendrierAnnee(anneeSco);
  if (!cal) return [];
  const ranges = [...cal.vacances, [cal.noel[0], cal.noel[1]]];
  const z = cal.zones[zone];
  if (z) {
    ranges.push([z.hiver[0], z.hiver[1]]);
    ranges.push([z.printemps[0], z.printemps[1]]);
  }
  return ranges;
}

function estEnVacances(iso) {
  const ranges = vacancesZone(anneeScolaire(iso), state.zone);
  return ranges.some(([debut, reprise]) => iso >= debut && iso < reprise);
}

function estFerie(iso) {
  const annee = Number(iso.slice(0, 4));
  return joursFeries(annee).includes(iso) || joursFeries(annee + 1).includes(iso);
}

function raisonFermeture(iso) {
  const d = parseDate(iso);
  const jour = d.getUTCDay();
  if (jour === 3) return "CDI fermé le mercredi";
  if (jour === 0 || jour === 6) return "Week-end";
  if (estFerie(iso)) return "Jour férié";
  if (estEnVacances(iso)) return "Vacances scolaires";
  if (calendrierAnnee(anneeScolaire(iso))?.ponts.includes(iso)) return "Pont (jour vaqué)";
  if (state.fermetures.includes(iso)) return "Fermeture exceptionnelle";
  return null;
}

function jourOuvert(iso) {
  const d = parseDate(iso);
  const jour = d.getUTCDay();
  if (![1, 2, 4, 5].includes(jour)) return false;
  return raisonFermeture(iso) === null;
}

function trimestreDe(iso) {
  const anneeSco = anneeScolaire(iso);
  const cal = calendrierAnnee(anneeSco);
  if (!cal) {
    const mois = Number(iso.slice(5, 7));
    if (mois >= 9) return 1;
    return mois <= 3 ? 2 : 3;
  }
  const [noelDebut, noelReprise] = cal.noel;
  const hiverDebut = cal.zones[state.zone].hiver[0];
  const hiverReprise = cal.zones[state.zone].hiver[1];
  if (iso < noelDebut) return 1;
  if (iso < noelReprise) return 1;
  if (iso < hiverDebut) return 2;
  if (iso < hiverReprise) return 2;
  return 3;
}

function periodeTrimestre(anneeSco, tri) {
  const cal = calendrierAnnee(anneeSco);
  if (!cal) {
    if (tri === 1) return [`${anneeSco.slice(0, 4)}-09-01`, `${anneeSco.slice(0, 4)}-12-31`];
    if (tri === 2) return [`${anneeSco.slice(5)}-01-01`, `${anneeSco.slice(5)}-03-31`];
    return [`${anneeSco.slice(5)}-04-01`, `${anneeSco.slice(5)}-08-31`];
  }
  if (tri === 1) return [cal.rentree, jourPrecedent(cal.noel[0])];
  if (tri === 2) return [cal.noel[1], jourPrecedent(cal.zones[state.zone].hiver[0])];
  return [cal.zones[state.zone].hiver[1], cal.finAnnee];
}

function jourPrecedent(iso) {
  return toISO(addDays(parseDate(iso), -1));
}

function compterJoursOuverts(debut, fin, limite) {
  const finEffective = limite && limite < fin ? limite : fin;
  let count = 0;
  let cur = parseDate(debut);
  const end = parseDate(finEffective);
  while (cur <= end) {
    if (jourOuvert(toISO(cur))) count++;
    cur = addDays(cur, 1);
  }
  return count;
}

function totalEntree(e) {
  return NIVEAUX.reduce((sum, n) => sum + (e[n] || 0), 0);
}

function fmtDate(iso) {
  return parseDate(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const $ = (id) => document.getElementById(id);

function init() {
  loadState();
  configurerCanvasHD($("chart-niveaux"));
  $("zone").value = state.zone;
  const aujourdhui = todayISO();
  $("date").value = aujourdhui;
  initFiltreAnnee();
  $("zone").addEventListener("change", onZoneChange);
  $("date").addEventListener("change", onDateChange);
  for (const n of NIVEAUX) {
    $("s" + n).addEventListener("input", majTotalJour);
  }
  $("btn-save").addEventListener("click", enregistrerJour);
  $("btn-delete-day").addEventListener("click", supprimerJour);
  $("filtre-annee").addEventListener("change", majCumuls);
  $("filtre-trimestre").addEventListener("change", majCumuls);
  $("btn-add-fermeture").addEventListener("click", ajouterFermeture);
  $("btn-download-png").addEventListener("click", telechargerPNG);
  $("btn-export-csv").addEventListener("click", exporterCSV);
  $("btn-export-json").addEventListener("click", exporterJSON);
  $("import-json").addEventListener("change", importerJSON);
  $("btn-reset").addEventListener("click", toutEffacer);
  onDateChange();
  majCumuls();
  majHistorique();
  majFermetures();
}

function cumulParNiveau(anneeSco) {
  const cumuls = { "6e": 0, "5e": 0, "4e": 0, "3e": 0 };
  for (const iso of Object.keys(state.entries)) {
    if (anneeScolaire(iso) !== anneeSco) continue;
    for (const n of NIVEAUX) cumuls[n] += state.entries[iso][n] || 0;
  }
  return cumuls;
}

function telechargerPNG() {
  const canvas = $("chart-niveaux");
  const anneeSco = $("filtre-annee").value;
  const exportCanvas = document.createElement("canvas");
  const scale = EXPORT_SCALE;
  exportCanvas.width = canvas.width * scale;
  exportCanvas.height = canvas.height * scale;
  const ctx = exportCanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
  const link = document.createElement("a");
  link.download = `repartition-niveaux-${anneeSco}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

function dessinerCamembert() {
  const canvas = $("chart-niveaux");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const anneeSco = $("filtre-annee").value;
  const cumuls = cumulParNiveau(anneeSco);
  const total = NIVEAUX.reduce((s, n) => s + cumuls[n], 0);

  const W = 540;
  const H = 280;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#232a33";
  ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Répartition des fréquentations par niveau — ${anneeSco}`, W / 2, 26);

  if (!total) {
    ctx.fillStyle = "#6b7684";
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("Aucune saisie pour cette année scolaire", W / 2, H / 2);
    return;
  }

  const cx = 130;
  const cy = H / 2 + 10;
  const r = 95;
  const COULEURS = COULEURS_NIVEAUX;

  let angle = -Math.PI / 2;
  for (const n of NIVEAUX) {
    const part = cumuls[n] / total;
    if (part <= 0) continue;
    const delta = part * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + delta);
    ctx.closePath();
    ctx.fillStyle = COULEURS[n];
    ctx.fill();
    if (part >= 0.05) {
      const mid = angle + delta / 2;
      const tx = cx + (r * 0.6) * Math.cos(mid);
      const ty = cy + (r * 0.6) * Math.sin(mid);
      ctx.fillStyle = part >= 0.33 ? "#fff" : "#232a33";
      ctx.font = "600 13px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(part * 100)}%`, tx, ty);
    }
    angle += delta;
  }

  ctx.strokeStyle = "#d8dee6";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.stroke();

  const legendeX = 250;
  let legendeY = 70;
  for (const n of NIVEAUX) {
    ctx.fillStyle = COULEURS[n];
    ctx.fillRect(legendeX, legendeY - 12, 14, 14);
    ctx.strokeStyle = "#d8dee6";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendeX, legendeY - 12, 14, 14);
    ctx.fillStyle = "#232a33";
    ctx.font = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "left";
    const libelle = n.replace("e", "e");
    ctx.fillText(`${libelle} — ${cumuls[n]} élèves (${((cumuls[n] / total) * 100).toFixed(1)}%)`, legendeX + 22, legendeY);
    legendeY += 34;
  }

  ctx.fillStyle = "#6b7684";
  ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Total : ${total} passages`, legendeX + 22, legendeY + 6);
}

function initFiltreAnnee() {
  const select = $("filtre-annee");
  select.innerHTML = "";
  const annees = new Set();
  for (const iso of Object.keys(state.entries)) annees.add(anneeScolaire(iso));
  annees.add(anneeScolaire(todayISO()));
  for (const y of Object.keys(CALENDRIERS)) annees.add(y);
  const liste = [...annees].sort();
  for (const y of liste) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    select.appendChild(opt);
  }
  select.value = anneeScolaire(todayISO());
}

function onZoneChange() {
  state.zone = $("zone").value;
  saveState();
  onDateChange();
  majCumuls();
}

function onDateChange() {
  const iso = $("date").value;
  const status = $("date-status");
  const saisie = state.entries[iso];
  for (const n of NIVEAUX) {
    $("s" + n).value = saisie && saisie[n] ? saisie[n] : "";
  }
  majTotalJour();
  if (!iso) return;
  const raison = raisonFermeture(iso);
  if (raison) {
    status.textContent = `${fmtDate(iso)} — ${raison}`;
    status.className = "status ko";
  } else {
    status.textContent = `${fmtDate(iso)} — CDI ouvert`;
    status.className = "status ok";
  }
}

function majTotalJour() {
  let total = 0;
  for (const n of NIVEAUX) {
    total += Number($("s" + n).value) || 0;
  }
  $("total-jour").textContent = total;
}

function enregistrerJour() {
  const iso = $("date").value;
  if (!iso) {
    alert("Choisissez une date.");
    return;
  }
  const raison = raisonFermeture(iso);
  if (raison) {
    alert(`Impossible d'enregistrer : ${raison} (${fmtDate(iso)}).`);
    return;
  }
  const valeurs = {};
  let rempli = false;
  for (const n of NIVEAUX) {
    const raw = $("s" + n).value;
    if (raw !== "") {
      const v = Number(raw);
      if (!Number.isInteger(v) || v < 0) {
        alert(`Valeur invalide pour le niveau ${n.replace("e", "e")}.`);
        return;
      }
      valeurs[n] = v;
      if (v > 0) rempli = true;
    }
  }
  if (!rempli) {
    alert("Saisis au moins un nombre d'élèves (0 possible si le niveau n'a pas fréquenté).");
    return;
  }
  state.entries[iso] = valeurs;
  saveState();
  initFiltreAnnee();
  majCumuls();
  majHistorique();
}

function supprimerJour() {
  const iso = $("date").value;
  if (!iso || !state.entries[iso]) {
    alert("Aucune saisie à supprimer pour cette date.");
    return;
  }
  if (confirm(`Supprimer la saisie du ${fmtDate(iso)} ?`)) {
    delete state.entries[iso];
    saveState();
    onDateChange();
    initFiltreAnnee();
    majCumuls();
    majHistorique();
  }
}

function filtrePeriode() {
  const anneeSco = $("filtre-annee").value;
  const tri = $("filtre-trimestre").value;
  return Object.keys(state.entries)
    .filter((iso) => anneeScolaire(iso) === anneeSco)
    .filter((iso) => tri === "all" || String(trimestreDe(iso)) === tri)
    .sort();
}

function majCumuls() {
  const dates = filtrePeriode();
  const cumuls = { "6e": 0, "5e": 0, "4e": 0, "3e": 0 };
  for (const iso of dates) {
    for (const n of NIVEAUX) cumuls[n] += state.entries[iso][n] || 0;
  }
  const total = NIVEAUX.reduce((s, n) => s + cumuls[n], 0);
  const tbody = $("table-cumuls").querySelector("tbody");
  tbody.innerHTML = "";
  const nbJours = dates.length;
  for (const n of NIVEAUX) {
    const tr = document.createElement("tr");
    const tdN = document.createElement("td");
    tdN.innerHTML = n.replace("e", "<sup>e</sup>");
    const tdC = document.createElement("td");
    tdC.textContent = cumuls[n];
    const tdM = document.createElement("td");
    tdM.textContent = nbJours ? (cumuls[n] / nbJours).toFixed(1) : "0";
    tr.append(tdN, tdC, tdM);
    tbody.appendChild(tr);
  }
  $("cumul-total").textContent = total;
  $("cumul-moyenne").textContent = nbJours ? (total / nbJours).toFixed(1) : "0";

  const anneeSco = $("filtre-annee").value;
  const tri = $("filtre-trimestre").value;
  const aujourdhui = todayISO();
  let ouverts = 0;
  let info = "";
  if (tri === "all") {
    ouverts = compterJoursOuverts(`${anneeSco.slice(0, 4)}-09-01`, `${anneeSco.slice(5)}-08-31`, aujourdhui);
    info = `Jours comptabilisés : ${nbJours} — Jours d'ouverture (à ce jour dans l'année) : ${ouverts}`;
  } else {
    const [debut, fin] = periodeTrimestre(anneeSco, Number(tri));
    ouverts = compterJoursOuverts(debut, fin, aujourdhui);
    const libelle = `Trimestre ${tri} : du ${fmtDate(debut)} au ${fmtDate(fin)}`;
    info = `${libelle} — Jours comptabilisés : ${nbJours} — Jours d'ouverture (à ce jour) : ${ouverts}`;
  }
  $("jours-info").textContent = info;
  dessinerCamembert();
}

function majHistorique() {
  const tbody = $("table-historique").querySelector("tbody");
  tbody.innerHTML = "";
  const dates = Object.keys(state.entries).sort().reverse();
  $("historique-vide").style.display = dates.length ? "none" : "block";
  for (const iso of dates) {
    const e = state.entries[iso];
    const tr = document.createElement("tr");
    tr.title = "Cliquer pour modifier cette saisie";
    tr.style.cursor = "pointer";
    tr.addEventListener("click", () => {
      $("date").value = iso;
      onDateChange();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    const tdDate = document.createElement("td");
    tdDate.textContent = fmtDate(iso);
    tr.appendChild(tdDate);
    for (const n of NIVEAUX) {
      const td = document.createElement("td");
      td.textContent = e[n] || 0;
      tr.appendChild(td);
    }
    const tdTotal = document.createElement("td");
    tdTotal.textContent = totalEntree(e);
    const tdTri = document.createElement("td");
    tdTri.textContent = `T${trimestreDe(iso)}`;
    tr.append(tdTotal, tdTri);
    tbody.appendChild(tr);
  }
}

function majFermetures() {
  const ul = $("liste-fermetures");
  ul.innerHTML = "";
  const dates = [...state.fermetures].sort();
  if (!dates.length) {
    const li = document.createElement("li");
    li.textContent = "Aucune fermeture exceptionnelle.";
    li.className = "muted";
    ul.appendChild(li);
    return;
  }
  for (const iso of dates) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = fmtDate(iso);
    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.title = "Supprimer cette fermeture";
    btn.addEventListener("click", () => {
      state.fermetures = state.fermetures.filter((d) => d !== iso);
      saveState();
      majFermetures();
      onDateChange();
      majCumuls();
    });
    li.append(span, btn);
    ul.appendChild(li);
  }
}

function ajouterFermeture() {
  const iso = $("date-fermeture").value;
  if (!iso) {
    alert("Choisissez une date de fermeture.");
    return;
  }
  if (!state.fermetures.includes(iso)) {
    state.fermetures.push(iso);
    state.fermetures.sort();
    saveState();
  }
  $("date-fermeture").value = "";
  majFermetures();
  onDateChange();
  majCumuls();
}

function telecharger(nomFichier, contenu, type) {
  const blob = new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

function exporterCSV() {
  const lignes = ["Date;Trimestre;6e;5e;4e;3e;Total"];
  for (const iso of Object.keys(state.entries).sort()) {
    const e = state.entries[iso];
    lignes.push(
      [iso, `T${trimestreDe(iso)}`, ...NIVEAUX.map((n) => e[n] || 0), totalEntree(e)].join(";")
    );
  }
  telecharger("frequentation-cdi.csv", "\uFEFF" + lignes.join("\r\n"), "text/csv;charset=utf-8");
}

function exporterJSON() {
  telecharger(
    "frequentation-cdi.json",
    JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2),
    "application/json"
  );
}

function importerJSON(event) {
  const fichier = event.target.files[0];
  if (!fichier) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data.entries !== "object") {
        alert("Fichier invalide : données de saisie introuvables.");
        return;
      }
      if (!confirm("Restaurer cette sauvegarde remplacera les données actuelles. Continuer ?")) return;
      state.zone = ["A", "B", "C"].includes(data.zone) ? data.zone : "C";
      state.entries = data.entries;
      state.fermetures = Array.isArray(data.fermetures) ? data.fermetures : [];
      saveState();
      $("zone").value = state.zone;
      initFiltreAnnee();
      onDateChange();
      majCumuls();
      majHistorique();
      majFermetures();
      alert("Sauvegarde restaurée.");
    } catch (e) {
      alert("Fichier illisible.");
    }
  };
  reader.readAsText(fichier);
  event.target.value = "";
}

function toutEffacer() {
  if (confirm("Effacer TOUTES les saisies, fermetures et réglages ? Cette action est définitive.")) {
    localStorage.removeItem(STORAGE_KEY);
    state.zone = "C";
    state.entries = {};
    state.fermetures = [];
    $("zone").value = "C";
    initFiltreAnnee();
    onDateChange();
    majCumuls();
    majHistorique();
    majFermetures();
  }
}

document.addEventListener("DOMContentLoaded", init);
