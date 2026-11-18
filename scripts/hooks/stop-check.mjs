#!/usr/bin/env node
// Hook « Stop » : empêche de terminer une étape tant que les tests ou le typecheck sont rouges,
// que des modifications ne sont pas commitées, ou que docs/JOURNAL.md n'a pas été mis à jour.
// Actif seulement si TRIBUNAL_STEP est défini (posé par scripts/run-etapes.mjs) : en session normale, il ne fait rien.
// Sortie 2 = Claude Code renvoie le message (stderr) à Claude, qui reprend le travail.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const etape = process.env.TRIBUNAL_STEP;
if (!etape) process.exit(0);

let entree = {};
try { entree = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* entrée absente */ }
if (entree.stop_hook_active) process.exit(0); // déjà relancé une fois : on laisse finir (évite la boucle)

const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const sh = (cmd) => spawnSync(cmd, { cwd: dir, shell: true, encoding: "utf8", timeout: 540_000 });
const queue = (r) => `${r.stdout || ""}${r.stderr || ""}`.trim().split(/\r?\n/).slice(-40).join("\n");

const problemes = [];
if (!existsSync(join(dir, "package.json"))) {
  problemes.push("package.json absent.");
} else {
  for (const script of ["test", "typecheck"]) {
    const r = sh(`npm run ${script} --silent`);
    if (r.status !== 0) problemes.push(`npm run ${script} est rouge :\n${queue(r)}`);
  }
}

const statut = (sh("git status --porcelain").stdout || "").split(/\r?\n/).filter((l) => l.trim() && !/^\?\? \.run\/?$/.test(l.trim())).join("\n");
if (statut) problemes.push(`Modifications non commitées :\n${statut.split(/\r?\n/).slice(0, 15).join("\n")}`);

const base = process.env.TRIBUNAL_BASE_SHA;
if (base) {
  const n = (sh(`git rev-list --count ${base}..HEAD`).stdout || "").trim();
  if (n === "0") problemes.push("Aucun commit depuis le début de l'étape.");
  const fichiers = (sh(`git diff --name-only ${base} HEAD`).stdout || "").split(/\r?\n/);
  if (!fichiers.includes("docs/JOURNAL.md")) problemes.push("docs/JOURNAL.md n'a pas reçu ses 5 lignes (ou n'est pas commité).");
}

if (problemes.length) {
  process.stderr.write(`Étape ${etape} non terminée :\n- ${problemes.join("\n- ")}\n`);
  process.exit(2);
}
process.exit(0);
