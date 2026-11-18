#!/usr/bin/env node
// Hook « PreCompact » : garde une trace de l'état avant que la conversation soit résumée.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

let entree = {};
try { entree = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* entrée absente */ }
const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = (args) => (spawnSync("git", args, { cwd: dir, encoding: "utf8" }).stdout || "").trim();

mkdirSync(join(dir, ".run"), { recursive: true });
const note = [
  "# État avant compaction",
  `- Date : ${new Date().toISOString()} (déclencheur : ${entree.trigger ?? "inconnu"})`,
  `- Étape : ${process.env.TRIBUNAL_STEP ?? "session manuelle"}`,
  "- Derniers commits :", git(["log", "-3", "--oneline"]) || "(aucun)",
  "- Fichiers modifiés non commités :", git(["status", "--short"]).split(/\r?\n/).slice(0, 30).join("\n") || "(aucun)",
  "",
].join("\n");
writeFileSync(join(dir, ".run", "precompact.md"), note);
process.exit(0);
