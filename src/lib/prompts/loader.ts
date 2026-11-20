// Assemble les prompts système et les messages MISSION (plan v3.0 ; prompts v3 §1).
// Règles : le prompt système est IDENTIQUE d'un procès à l'autre (donc mis en cache) ; les données arrivent
// toujours dans le message MISSION ; une donnée manquante est refusée ; aucun marqueur ne survit à l'assemblage.
// Aucun import de Next.js. Lit prompts/*.md depuis le dossier courant, ou depuis `racine`.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGENTS,
  BUDGET_PAR_PHASE,
  PHASES_AVEC_PRENOM_CLIENTE,
  PHASES_PAR_AGENT,
  RAPPELS,
  type AgentId,
  type Mode,
  type Phase,
} from "../../../prompts/agents.config";
import { texteSalle } from "../../../prompts/salle";
import { INITIALES_INTERDITES, verifierPrenomCliente } from "../trial/persona-prenom";
import { formatsPourAgent } from "./format";
import { PROMPTS_EMBARQUES } from "./embarques.generated";

export class PromptError extends Error {}

let sourcePrompts: "disque" | "embarques" = "disque";
/** Le CLI empaqueté du plugin lit les prompts embarqués au build : le dossier courant est celui de l'utilisateur, pas le nôtre. */
export function utiliserPromptsEmbarques(): void {
  sourcePrompts = "embarques";
}

export function lirePrompt(fichier: string, racine?: string): string {
  if (racine === undefined && sourcePrompts === "embarques") {
    const t = PROMPTS_EMBARQUES[fichier];
    if (t === undefined) throw new PromptError(`Prompt embarqué introuvable : ${fichier}`);
    return t;
  }
  return readFileSync(join(racine ?? process.cwd(), "prompts", fichier), "utf8").replace(/\r\n/g, "\n");
}

/**
 * Traite les marqueurs d'un prompt :
 * - `<!-- MODE:API --> … <!-- /MODE -->` gardé en mode API, retiré en mode plugin (et inversement pour PLUGIN) ;
 * - `<!-- FORMAT -->` remplacé par `format` (mode plugin seulement) ;
 * - `<!-- PRENOMS -->` remplacé par la salle (tous les modes).
 */
export function traiterMarqueurs(texte: string, opts: { mode: Mode; format?: string }): string {
  const garde = opts.mode === "api" ? "API" : "PLUGIN";
  let t = texte.replace(/<!-- MODE:(API|PLUGIN) -->\n([\s\S]*?)<!-- \/MODE -->\n?/g, (_m, mode: string, corps: string) =>
    mode === garde ? corps : "",
  );
  t = t.replace(/<!-- PRENOMS -->/g, () => texteSalle(INITIALES_INTERDITES));
  if (t.includes("<!-- FORMAT -->")) {
    if (opts.mode === "api") throw new PromptError("<!-- FORMAT --> hors d'un bloc MODE:PLUGIN : en mode API, le format est imposé par l'API.");
    if (!opts.format) throw new PromptError("Format manquant pour <!-- FORMAT -->.");
    t = t.replace(/<!-- FORMAT -->/g, () => opts.format!);
  }
  const reste = t.match(/<!--[^>]*-->/);
  if (reste) throw new PromptError(`Marqueur non traité : ${reste[0]}`);
  return t.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Prompt système d'un agent : règles communes (jurés) + fiche. Identique d'un procès à l'autre. */
export function promptSysteme(agent: AgentId, mode: Mode, opts: { racine?: string } = {}): string {
  const def = AGENTS[agent];
  const format = mode === "plugin" ? formatsPourAgent(agent) : undefined;
  const parties = [def.commun ? lirePrompt("_commun.md", opts.racine) : null, lirePrompt(def.prompt, opts.racine)]
    .filter((p): p is string => p !== null)
    .map((p) => traiterMarqueurs(p, { mode, format }));
  return parties.join("\n");
}

/** Prompt du second appel du mode API (mise en forme JSON, sans outil). */
export function promptMiseEnForme(opts: { racine?: string } = {}): string {
  return traiterMarqueurs(lirePrompt("mise-en-forme.md", opts.racine), { mode: "api" });
}

export interface MissionOptions {
  agent: AgentId;
  phase: Phase;
  mode: Mode;
  /** DEBAT uniquement : 1 ou 2. */
  tour?: 1 | 2;
  pays?: string;
  langue?: string;
  /** Mode API : les données en JSON. */
  donnees?: unknown;
  /** Mode plugin : les fichiers que le sous-agent lit et écrit. */
  fichierEntree?: string;
  fichierSortie?: string;
  /** Prénom de la Cliente, donné dans la MISSION (jamais dans le prompt système). */
  prenomCliente?: string;
}

/** Message utilisateur de chaque appel. Refuse une donnée manquante ou incohérente. */
export function construireMission(o: MissionOptions): string {
  if (!PHASES_PAR_AGENT[o.agent].includes(o.phase)) throw new PromptError(`${o.agent} ne joue pas la phase ${o.phase}.`);
  if (o.phase === "DEBAT" && o.tour === undefined) throw new PromptError("Donnée manquante : tour (phase DEBAT).");
  if (o.phase !== "DEBAT" && o.tour !== undefined) throw new PromptError("Le tour n'existe qu'en phase DEBAT.");

  const avecPrenom = PHASES_AVEC_PRENOM_CLIENTE.includes(o.phase);
  if (avecPrenom && !o.prenomCliente) throw new PromptError(`Donnée manquante : prenomCliente (phase ${o.phase}).`);
  if (!avecPrenom && o.prenomCliente) throw new PromptError(`La Cliente n'existe pas encore en phase ${o.phase} : pas de prénom.`);
  if (o.prenomCliente) {
    const r = verifierPrenomCliente(o.prenomCliente);
    if (!r.ok) throw new PromptError(`Prénom de la Cliente invalide : ${r.raison}`);
  }

  const budget = BUDGET_PAR_PHASE[o.phase];
  const lignes = ["MISSION", `phase: ${o.phase}`, `agent: ${o.agent}`];
  if (o.tour !== undefined) lignes.push(`tour: ${o.tour}`);
  lignes.push(`budget: recherches=${budget.maxSearches} lectures=${budget.maxFetches}`);
  lignes.push(`pays: ${o.pays ?? "FR"} · langue: ${o.langue ?? "fr"}`);
  if (o.prenomCliente) lignes.push(`prenom_cliente: ${o.prenomCliente}`);

  lignes.push("", "DONNÉES");
  if (o.mode === "api") {
    if (o.donnees === undefined || o.donnees === null) throw new PromptError("Donnée manquante : donnees (mode API).");
    lignes.push(JSON.stringify(o.donnees, null, 2));
  } else {
    if (!o.fichierEntree) throw new PromptError("Donnée manquante : fichierEntree (mode plugin).");
    if (!o.fichierSortie) throw new PromptError("Donnée manquante : fichierSortie (mode plugin).");
    lignes.push(`fichier_entree: ${o.fichierEntree}`, `fichier_sortie: ${o.fichierSortie}`);
  }

  lignes.push("", "RAPPEL — ce qui fait rejeter ta réponse");
  RAPPELS[o.phase].forEach((r, i) => lignes.push(`${i + 1}. ${r}`));
  return lignes.join("\n") + "\n";
}
