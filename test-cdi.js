"use strict";

const fs = require("fs");
const path = require("path");

const code = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

const ctx2dStub = {
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  font: "",
  textAlign: "",
  clearRect() {},
  fillRect() {},
  strokeRect() {},
  beginPath() {},
  moveTo() {},
  arc() {},
  closePath() {},
  fill() {},
  stroke() {},
  fillText() {},
};

function elementStub() {
  const el = {
    value: "",
    textContent: "",
    innerHTML: "",
    style: {},
    tagName: "DIV",
    width: 300,
    height: 150,
    options: [],
    children: [],
    listeners: {},
    addEventListener(evt, fn) {
      el.listeners[evt] = fn;
    },
    click() {
      el.clicked = true;
    },
    dispatch(evt) {
      if (el.listeners[evt]) el.listeners[evt]();
    },
    appendChild(child) {
      el.children.push(child);
      if (child && child.tagName === "OPTION") el.options.push(child);
    },
    append(...nodes) {
      for (const n of nodes) el.children.push(n);
    },
    querySelector() {
      return elementStub();
    },
    getContext() {
      return ctx2dStub;
    },
    toDataURL() {
      return "data:image/png;base64,STUB";
    },
  };
  return el;
}

const elements = {};
[
  "zone", "date", "date-status", "s6e", "s5e", "s4e", "s3e", "total-jour",
  "btn-save", "btn-delete-day", "filtre-annee", "filtre-trimestre",
  "btn-add-fermeture", "date-fermeture", "liste-fermetures",
  "btn-export-csv", "btn-export-json", "import-json", "btn-reset",
  "jours-info", "cumul-total", "cumul-moyenne", "historique-vide",
  "table-cumuls", "table-historique", "chart-niveaux", "btn-download-png",
].forEach((id) => (elements[id] = elementStub()));

const domReadyHandlers = [];
const documentStub = {
  getElementById: (id) => {
    if (!elements[id]) elements[id] = elementStub();
    return elements[id];
  },
  createElement: (tag) => {
    const el = elementStub();
    el.tagName = tag.toUpperCase();
    return el;
  },
  addEventListener: (evt, fn) => {
    if (evt === "DOMContentLoaded") domReadyHandlers.push(fn);
  },
};

const storage = {};
const sandbox = {
  document: documentStub,
  localStorage: {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => {
      storage[k] = String(v);
    },
    removeItem: (k) => delete storage[k],
  },
  window: { scrollTo: () => {} },
  console,
  URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
  Blob: class {},
  alert: () => {},
  confirm: () => true,
};
sandbox.window.document = documentStub;

const vm = require("vm");
const context = vm.createContext(sandbox);
vm.runInContext(code, context);

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL: ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok: ${label}`);
  }
}

// 0. init() complet — régression « CALENDRIERS is not iterable » (app.js:271)
let initError = null;
try {
  domReadyHandlers.forEach((fn) => fn());
} catch (e) {
  initError = e;
}
check("init() s'exécute sans erreur", initError === null, true);
if (initError) console.error("  → " + initError.message);
check("init() remplit le filtre année (≥ 3 années)", elements["filtre-annee"].options.length >= 3, true);

// 1. Trimestres 2025-2026 (zone C par défaut)
check("T1 rentrée", context.trimestreDe("2025-09-01"), 1);
check("T1 veille Noël", context.trimestreDe("2025-12-19"), 1);
check("T2 pendant vacances Noël (fermé mais tri)", context.trimestreDe("2025-12-25"), 1);
check("T2 reprise janvier", context.trimestreDe("2026-01-05"), 2);
check("T2 veille hiver C", context.trimestreDe("2026-02-20"), 2);
check("T3 reprise hiver C", context.trimestreDe("2026-03-09"), 3);
check("T3 fin d'année", context.trimestreDe("2026-07-03"), 3);

// 2. Jours ouverts / fermés
check("lundi normal ouvert", context.jourOuvert("2026-03-09"), true);
check("mercredi fermé", context.jourOuvert("2026-03-11"), false);
check("samedi fermé", context.jourOuvert("2026-03-14"), false);
check("pendant vacances hiver C (lundi)", context.jourOuvert("2026-02-23"), false);
check("jour férié 11 novembre", context.jourOuvert("2026-11-11"), false);
check("ascension 2026 (14 mai, jeudi)", context.jourOuvert("2026-05-14"), false);
check("pont 15 mai 2026 (vendredi)", context.jourOuvert("2026-05-15"), false);
check("lundi de Pâques 2026 (6 avril)", context.jourOuvert("2026-04-06"), false);

// 3. Année scolaire
check("année sco sept", context.anneeScolaire("2025-09-15"), "2025-2026");
check("année sco janv", context.anneeScolaire("2026-01-10"), "2025-2026");

// 4. Périodes de trimestres
check("T1 période", context.periodeTrimestre("2025-2026", 1), ["2025-09-01", "2025-12-19"]);
check("T2 période", context.periodeTrimestre("2025-2026", 2), ["2026-01-05", "2026-02-20"]);
check("T3 période", context.periodeTrimestre("2025-2026", 3), ["2026-03-09", "2026-07-03"]);

// 5. Comptage jours ouverts T1 2025-2026 complet
const nT1 = context.compterJoursOuverts("2025-09-01", "2025-12-19", null);
console.log(`Jours ouverts T1 2025-2026 : ${nT1}`);
check("T1 a un nombre raisonnable de jours", nT1 > 50 && nT1 < 80, true);

// 6. Cumuls via le filtre
vm.runInContext(`state.zone = "C";
state.entries = {
  "2025-09-01": { "6e": 10, "5e": 5, "4e": 3, "3e": 2 },
  "2025-09-02": { "6e": 8, "5e": 4, "4e": 6, "3e": 1 },
  "2026-01-05": { "6e": 1, "5e": 1, "4e": 1, "3e": 1 },
};`, context);
elements["filtre-annee"].value = "2025-2026";
elements["filtre-trimestre"].value = "1";
context.majCumuls();
check("cumul total T1", String(elements["cumul-total"].textContent), "39");
check("cumul moyenne T1", elements["cumul-moyenne"].textContent, "19.5");
elements["filtre-trimestre"].value = "2";
context.majCumuls();
check("cumul total T2", String(elements["cumul-total"].textContent), "4");

// 7. Pâques (vérification externe : Pâques 2026 = 5 avril)
check("lundi de Pâques 2026", context.toISO(context.addDays(context.paques(2026), 1)), "2026-04-06");
check("ascension 2026", context.toISO(context.addDays(context.paques(2026), 39)), "2026-05-14");
check("lundi de Pâques 2025", context.toISO(context.addDays(context.paques(2025), 1)), "2025-04-21");

// 8. Camembert annuel : cumuls et rendu sans erreur
check("cumulParNiveau 2025-2026 (6e)", vm.runInContext('cumulParNiveau("2025-2026")["6e"]', context), 19);
let dessinErreur = null;
try {
  context.dessinerCamembert();
} catch (e) {
  dessinErreur = e;
}
check("dessinerCamembert() sans erreur", dessinErreur === null, true);
if (dessinErreur) console.error("  → " + dessinErreur.message);
let exportErreur = null;
try {
  context.telechargerPNG();
} catch (e) {
  exportErreur = e;
}
check("telechargerPNG() sans erreur", exportErreur === null, true);
if (exportErreur) console.error("  → " + exportErreur.message);

// 9. Changement de zone : hiver zone A vs C
vm.runInContext('state.zone = "A"', context);
check("T3 reprise hiver A", context.trimestreDe("2026-02-23"), 3);
vm.runInContext('state.zone = "C"', context);

if (failures) {
  console.error(`\n${failures} test(s) en échec`);
  process.exit(1);
} else {
  console.log("\nTous les tests passent");
}
