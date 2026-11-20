// Client « abonnement » (plan v3.0, §2.3 B) : le CLI est la machine à états, Claude Code n'est qu'un exécutant.
// callAgent n'appelle aucun modèle. Il lit la sortie d'un sous-agent si son fichier existe ; sinon il écrit le fichier d'entrée
// (le message MISSION) et lève TacheEnAttente. Le moteur se suspend, le CLI rend les tâches, Claude Code lance les sous-agents
// en parallèle, puis `submit` rejoue le moteur : les sorties déjà là sont relues, seule la suite avance (reprise déterministe).
// Une relance (sortie refusée par le code) devient une NOUVELLE tâche (tentative 2), jamais la même sortie rejouée.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AGENTS } from "../../../prompts/agents.config";
import { evidenceVide, LlmError, TacheEnAttente, type CallAgentParams, type CallAgentResult, type LlmClient } from "./types";
import { usageVide } from "./usage";

export interface TachePlugin {
  /** Nom préfixé du sous-agent : « tribunal:investisseur ». */
  agent: string;
  phase: string;
  tour: number | null;
  tentative: number;
  input: string;
  output: string;
}

export function creerClientPlugin(opts: { dossier: string }): LlmClient & { tachesEnAttente(): TachePlugin[]; reinitialiser(): void } {
  const dossierTaches = join(opts.dossier, "tasks");
  let tentatives = new Map<string, number>();
  let attente = new Map<string, TachePlugin>();

  return {
    mode: "plugin",
    tachesEnAttente: () => [...attente.values()],
    /** À appeler avant chaque rejeu du moteur : les compteurs de tentatives repartent de 1. */
    reinitialiser() {
      tentatives = new Map();
      attente = new Map();
    },
    async callAgent(p: CallAgentParams): Promise<CallAgentResult> {
      const base = `${p.phase}-${p.agent}-${p.tour ?? 0}`;
      const tentative = (tentatives.get(base) ?? 0) + 1;
      tentatives.set(base, tentative);
      const nom = `${base}-${tentative}`;
      const input = join(dossierTaches, `${nom}.input.md`);
      const output = join(dossierTaches, `${nom}.output.json`);

      if (!existsSync(output)) {
        mkdirSync(dossierTaches, { recursive: true });
        // Le sous-agent lit ce fichier (MISSION + DONNÉES + RAPPEL) et écrit UNIQUEMENT son JSON dans le fichier de sortie.
        writeFileSync(input, `${p.mission}\nfichier_sortie: ${output}\n`);
        const tache: TachePlugin = { agent: `tribunal:${p.agent}`, phase: p.phase, tour: p.tour ?? null, tentative, input, output };
        attente.set(nom, tache);
        throw new TacheEnAttente(tache);
      }

      let sortie: unknown;
      try {
        sortie = JSON.parse(readFileSync(output, "utf8"));
      } catch (e) {
        throw new LlmError(`Sortie de ${p.agent} illisible (${nom}) : le JSON est invalide.`, e);
      }
      const modele = AGENTS[p.agent].modele;
      // Les sous-agents tournent dans l'abonnement de l'utilisateur : aucun coût en dollars n'est mesuré ici.
      return { sortie, usage: usageVide(), coutUsd: 0, modele, evidence: evidenceVide(), citationsInconnues: [], appels: 1 };
    },
  };
}
