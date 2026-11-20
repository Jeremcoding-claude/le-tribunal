// Génère plugin/agents/<agent>.md depuis prompts/ (plan v3.0, §2.1). Usage : npm run build:plugin
//   --check : ne change rien ; sort en erreur si un fichier généré n'est pas à jour (CI, étape 12).
// plugin/agents/ est GÉNÉRÉ et COMMITÉ (le marketplace installe le plugin depuis Git) : ne jamais le modifier à la main.
// plugin/bin/tribunal.mjs (moteur + CLI en un fichier) est généré à l'étape 9.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

/** Les prompts embarqués : le CLI du plugin ne peut pas lire `prompts/` (le dossier courant est celui de l'utilisateur). */
export function contenuEmbarques(racine = process.cwd()): string {
  const dossier = join(racine, "prompts");
  const prompts = Object.fromEntries(
    readdirSync(dossier).filter((f) => f.endsWith(".md")).sort().map((f) => [f, readFileSync(join(dossier, f), "utf8").replace(/\r\n/g, "\n")]),
  );
  return `// GÉNÉRÉ par scripts/build-plugin.ts depuis prompts/ — ne pas modifier\nexport const PROMPTS_EMBARQUES: Record<string, string> = ${JSON.stringify(prompts, null, 2)};\n`;
}

/** Empaquette le CLI en un seul fichier (dépendances incluses) : plugin/bin/tribunal.mjs. */
export async function empaqueter(sortie: string, racine = process.cwd()): Promise<string> {
  const { build } = await import("tsup");
  await build({
    entry: { tribunal: join(racine, "src/cli/tribunal.ts") },
    outDir: sortie,
    format: ["esm"],
    platform: "node",
    target: "node22",
    noExternal: [/.*/],
    splitting: false,
    sourcemap: false,
    minify: true,
    clean: false,
    silent: true,
    dts: false,
    outExtension: () => ({ js: ".mjs" }),
    // Certaines dépendances CommonJS (PDF) appellent require() : on le fournit dans le fichier ESM.
    banner: { js: "import { createRequire as __cr } from \"node:module\"; const require = __cr(import.meta.url);" },
    esbuildOptions(o) {
      o.legalComments = "none";
    },
    esbuildPlugins: [
      {
        // pdfkit charge ses polices standard par require('#standard-fonts/…') dynamique : on le remplace par un require
        // statique du même fichier, que l'empaqueteur peut inclure dans le fichier unique.
        name: "pdfkit-polices-standard",
        setup(b) {
          b.onLoad({ filter: /pdfkit[\\/]js[\\/]pdfkit\.[\w.]*js$/ }, (args) => {
            const dossierPolices = join(dirname(args.path), "standard-fonts");
            const source = readFileSync(args.path, "utf8").replace(/require\$1\(['"]#standard-fonts\/([A-Za-z-]+)['"]\)/g, (_m, nom: string) => `require(${JSON.stringify(join(dossierPolices, `${nom}.cjs`))})`);
            return { contents: source, loader: "js" };
          });
        },
      },
    ],
  });
  return join(sortie, "tribunal.mjs");
}

/** Tous les fichiers générés : chemin relatif à la racine du dépôt → contenu. */
export function genererPlugin(racine = process.cwd()): Record<string, string> {
  return {
    ...Object.fromEntries(AGENT_IDS.map((a) => [`plugin/agents/${a}.md`, contenuAgent(a, racine)])),
    "src/lib/prompts/embarques.generated.ts": contenuEmbarques(racine),
  };
}

async function main() {
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
    if (process.argv.includes("--bundle")) {
      const tmp = mkdtempSync(join(tmpdir(), "bundle-"));
      const neuf = readFileSync(await empaqueter(tmp, racine));
      const f = join(racine, "plugin/bin/tribunal.mjs");
      if (!existsSync(f) || !readFileSync(f).equals(neuf)) {
        console.error("plugin/bin/tribunal.mjs pas à jour. Lance « npm run build:plugin ».");
        process.exit(1);
      }
    }
    console.log(`Plugin à jour (${Object.keys(fichiers).length} fichiers générés).`);
    return;
  }
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    const f = join(racine, chemin);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, contenu);
  }
  console.log(`${Object.keys(fichiers).length} fichiers générés (agents et prompts embarqués).`);
  if (!process.argv.includes("--sans-bundle")) {
    mkdirSync(join(racine, "plugin/bin"), { recursive: true });
    const f = await empaqueter(join(racine, "plugin/bin"), racine);
    console.log(`CLI empaqueté : ${f} (${Math.round(readFileSync(f).length / 1024)} Ko).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
