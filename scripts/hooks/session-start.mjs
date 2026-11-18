#!/usr/bin/env node
// Hook « SessionStart » : remet dans le contexte la fin du journal et l'état d'avant compaction.
// Ce que ce script écrit sur la sortie standard est ajouté au contexte de Claude.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const sortie = [];

const journal = join(dir, "docs", "JOURNAL.md");
if (existsSync(journal)) {
  const fin = readFileSync(journal, "utf8").split(/\r?\n/).slice(-40).join("\n");
  sortie.push("## Fin de docs/JOURNAL.md (relais entre sessions)", fin);
}
const avant = join(dir, ".run", "precompact.md");
if (existsSync(avant)) sortie.push(readFileSync(avant, "utf8"));

if (sortie.length) console.log(sortie.join("\n\n"));
