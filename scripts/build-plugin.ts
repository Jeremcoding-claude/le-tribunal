// Génère plugin/agents/<agent>.md depuis prompts/ (plan v3.0, §2.1). Usage : npm run build:plugin
//   --check : ne change rien ; sort en erreur si un fichier généré n'est pas à jour (CI, étape 12).
// plugin/agents/ est GÉNÉRÉ et COMMITÉ (le marketplace installe le plugin depuis Git) : ne jamais le modifier à la main.
// plugin/bin/tribunal.mjs (moteur + CLI en un fichier) est généré à l'étape 9.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { AGENTS, AGENT_IDS, type AgentId } from "../prompts/agents.config";
import { promptSysteme } from "../src/lib/prompts/loader";

const ENTETE = "<!-- GÉNÉRÉ par scripts/build-plugin.ts depuis prompts/ — ne pas modifier -->";
const MODE_CLAUDE_CODE = `## Mode Claude Code
Lis le fichier d'entrée (message MISSION + DONNÉES). Respecte le budget. Écris ton seul objet JSON
dans le fichier de sortie, nulle part ailleurs, puis réponds « fait ».`;

export function contenuAgent(agent: AgentId, racine = process.cwd()): string {
  const def = AGENTS[agent];
  if (/[:#]\s/.test(def.description)) throw new Error(`${agent} : la description contient « : » ou « # » (YAML).`);
  const entete = [
    "---",
    `name: ${agent}`, // SANS préfixe : Claude Code l'expose sous le nom tribunal:<agent>
    `description: ${def.description}`,
    `tools: ${def.outilsCc.join(", ")}`,
    `model: ${def.cc}`,
    `maxTurns: ${def.maxTurns}`,
    "---",
  ].join("\n");
  return `${entete}\n${ENTETE}\n\n${promptSysteme(agent, "plugin", { racine })}\n${MODE_CLAUDE_CODE}\n`;
}

/** Tous les fichiers générés : chemin relatif à la racine du dépôt → contenu. */
export function genererPlugin(racine = process.cwd()): Record<string, string> {
  return Object.fromEntries(AGENT_IDS.map((a) => [`plugin/agents/${a}.md`, contenuAgent(a, racine)]));
}

function main() {
  const racine = process.cwd();
  const fichiers = genererPlugin(racine);
  if (process.argv.includes("--check")) {
    const perimes = Object.entries(fichiers).filter(([chemin, contenu]) => {
      const f = join(racine, chemin);
      return !existsSync(f) || readFileSync(f, "utf8").replace(/\r\n/g, "\n") !== contenu;
    });
    if (perimes.length) {
      console.error(`Plugin pas à jour : ${perimes.map(([c]) => c).join(", ")}. Lance « npm run build:plugin ».`);
      process.exit(1);
    }
    console.log(`Plugin à jour (${Object.keys(fichiers).length} agents).`);
    return;
  }
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    const f = join(racine, chemin);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, contenu);
  }
  console.log(`${Object.keys(fichiers).length} agents générés dans plugin/agents/.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
