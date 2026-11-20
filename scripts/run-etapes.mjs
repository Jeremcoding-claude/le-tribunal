#!/usr/bin/env node
// Enchaîne des étapes du plan, UNE ÉTAPE = UN CONTEXTE NEUF (claude -p), avec contrôle par le code.
// Usage : node scripts/run-etapes.mjs 1 2 3 [--dry] [--turns 80] [--budget 8]
// Les noms d'options de `claude` sont à valider avec `claude --help` (voir docs/PROCESSUS.md).
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const dry = argv.includes("--dry");
let tours = "80";
let budget = "8";
const etapes = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--turns") tours = argv[++i];
  else if (a === "--budget") budget = argv[++i];
  else if (/^\d+$/.test(a)) etapes.push(Number(a));
}

if (etapes.length === 0 || etapes.some((n) => n < 1 || n > 12)) {
  console.error("Usage : node scripts/run-etapes.mjs <étape 1-12> [...] [--dry] [--turns 80] [--budget 8]");
  process.exit(1);
}

const win = process.platform === "win32";
const run = (cmd, args, extra = {}) => spawnSync(cmd, args, { encoding: "utf8", shell: win, maxBuffer: 256 * 1024 * 1024, ...extra });
const git = (...a) => (run("git", a).stdout || "").trim();
// Arbre git « sale » hors dossier .run/ (sorties du script, jamais commitées).
const sale = () => git("status", "--porcelain").split(/\r?\n/).filter((l) => l.trim() && !/^\?\? \.run\/?$/.test(l.trim())).join("\n");
const pad = (n) => String(n).padStart(2, "0");

// Étapes dont une partie est payante ou interactive : le script ne les fait pas.
const MANUEL = {
  9: "Installe le plugin dans Claude Code, lance /tribunal:juger (saisie complète, à 3 éléments, sans prix), puis MOCK_MODE=false npm run smoke.",
  12: "Lance 3 vrais procès (MOCK_MODE=false), puis npm run cost ; clone neuf + README ; CI verte.",
};
const WEB = new Set([1, 4, 9, 10, 11, 12]); // étapes qui lisent des documentations externes
const OUTILS_BASE = ["Read", "Edit", "Write", "Glob", "Grep", "Agent", "Bash(npm:*)", "Bash(npx:*)", "Bash(node:*)", "Bash(git:*)", "Bash(mkdir:*)", "Bash(ls:*)"];

if (!dry) {
  if (git("rev-parse", "--is-inside-work-tree") !== "true") {
    console.error("Pas de dépôt git. Fais : git init && git add -A && git commit -m \"chore: kit de processus\"");
    process.exit(1);
  }
  if (sale()) {
    console.error("L'arbre git n'est pas propre : commite ou range tes modifications avant de lancer une étape.");
    process.exit(1);
  }
}
mkdirSync(".run", { recursive: true });

const bilan = [];
for (const n of etapes) {
  const base = dry ? "(dry)" : git("rev-parse", "HEAD");
  const prompt =
    `Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-${pad(n)}.md et uniquement les fichiers de sa section « À lire ». ` +
    `Exécute l'étape ${n} du plan, rien d'autre. Tests verts, un commit, puis ajoute 5 lignes à docs/JOURNAL.md et commite-les.` +
    (MANUEL[n]
      ? ` Ne lance ni npm run smoke ni aucun vrai procès (payants) : écris dans docs/JOURNAL.md ce qu'il reste à vérifier à la main.`
      : "");
  const outils = [...OUTILS_BASE, ...(WEB.has(n) ? ["WebFetch", "WebSearch"] : [])].join(",");
  const args = ["-p", "--permission-mode", "acceptEdits", "--allowedTools", outils, "--max-turns", tours, "--max-budget-usd", budget, "--output-format", "json"];
  const argsShell = win ? args.map((a) => (/[\s()*:,]/.test(a) ? `"${a}"` : a)) : args;
  const env = { ...process.env, TRIBUNAL_STEP: String(n), TRIBUNAL_BASE_SHA: base, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "60" };

  console.log(`\n=== Étape ${n} ===`);
  if (dry) {
    console.log(`claude ${argsShell.join(" ")}\n[prompt envoyé sur l'entrée standard]\n${prompt}\n`);
    if (MANUEL[n]) console.log(`À FAIRE À LA MAIN ensuite : ${MANUEL[n]}`);
    continue;
  }

  const t0 = Date.now();
  const r = run("claude", argsShell, { input: prompt, env });
  writeFileSync(join(".run", `etape-${pad(n)}.json`), r.stdout || "");
  let json = {};
  try { json = JSON.parse(r.stdout); } catch { /* sortie non JSON */ }

  const echecs = [];
  if (r.status !== 0) echecs.push(`claude a quitté avec le code ${r.status}. ${(r.stderr || "").trim().split("\n").slice(-5).join(" ")}`);
  if (json.is_error) echecs.push("claude signale une erreur (voir .run/etape-" + pad(n) + ".json).");
  if (git("rev-parse", "HEAD") === base) echecs.push("aucun commit n'a été fait.");
  if (sale()) echecs.push("des modifications ne sont pas commitées.");
  if (!echecs.length) {
    for (const s of ["test", "typecheck"]) {
      const t = run("npm", ["run", s, "--silent"]);
      if (t.status !== 0) echecs.push(`npm run ${s} est rouge.`);
    }
  }
  const minutes = ((Date.now() - t0) / 60000).toFixed(1);
  const cout = json.total_cost_usd != null ? `${Number(json.total_cost_usd).toFixed(2)} $ (estimation)` : "coût inconnu";
  bilan.push({ n, ok: !echecs.length, tours: json.num_turns ?? "?", cout, minutes });
  console.log(`Étape ${n} : ${echecs.length ? "ÉCHEC" : "OK"} — ${json.num_turns ?? "?"} tours, ${cout}, ${minutes} min`);
  if (MANUEL[n]) console.log(`À FAIRE À LA MAIN : ${MANUEL[n]}`);
  if (echecs.length) {
    console.error(`Arrêt : ${echecs.join(" ")}`);
    process.exit(1);
  }
}
if (bilan.length) console.table(bilan);
