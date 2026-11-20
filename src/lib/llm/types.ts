// Types communs du vrai client et du client MOCK : même signature (plan v3.0, étape 4).

import type { AgentId, Phase } from "../../../prompts/agents.config";
import type { Usage } from "./usage";

/** Une clé API n'apparaît jamais dans une erreur (G8) : masquée ici, redact.ts la masque partout à l'étape 7. */
export const masquerCle = (texte: string): string => texte.replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-…masquée");

export class LlmError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(masquerCle(message));
  }
}

/** Une citation numérotée C1…Cn par le code, à partir des blocs de la réponse de recherche. */
export interface Citation {
  id: string;
  type: "recherche" | "lecture";
  url: string;
  titre: string | null;
  /** Le passage cité renvoyé par l'API (`cited_text`) : c'est LUI qui sert de preuve, pas ce que l'agent écrit. */
  passage: string;
}

/** Ce que les outils web ont réellement renvoyé : la matière du vérificateur de sources (étape 5). */
export interface ToolEvidence {
  urlsRenvoyees: string[];
  citations: Citation[];
  recherches: { requete: string }[];
  lectures: { url: string }[];
}

export const evidenceVide = (): ToolEvidence => ({ urlsRenvoyees: [], citations: [], recherches: [], lectures: [] });

/** Événements émis pendant l'appel (le moteur les habille en TrialEvent). */
export type LlmEvent =
  | { type: "agent_status"; agent: AgentId; statut: "recherche" | "mise_en_forme" | "termine" }
  | { type: "search_performed"; agent: AgentId; requete: string; domaines: string[] }
  | { type: "fetch_performed"; agent: AgentId; url: string };

export interface CallAgentParams {
  agent: AgentId;
  phase: Phase;
  /** Le message MISSION, construit par construireMission (mode API). */
  mission: string;
  tour?: 1 | 2;
  pays?: string;
  onEvent?: (e: LlmEvent) => void;
}

export interface CallAgentResult {
  /**
   * La sortie de l'agent, citations déjà résolues en `source_url` + `extrait` (mode API). Elle a passé le schéma
   * « mise en forme » ; la validation complète (source obligatoire pour un fait, etc.) et le vérificateur
   * de sources relèvent de la phase (étapes 5 et 6).
   */
  sortie: unknown;
  usage: Usage;
  coutUsd: number;
  modele: string;
  evidence: ToolEvidence;
  /** Citations citées par l'agent mais absentes de la réponse de recherche (« id:Cx ») : à rejeter (G1). */
  citationsInconnues: string[];
  /** 1 appel, ou 2 quand l'agent a cherché sur le web (recherche puis mise en forme). */
  appels: number;
}

/**
 * Mode abonnement : la tâche d'un agent est écrite dans un fichier, Claude Code lance le sous-agent, le CLI reprend ensuite.
 * Ce n'est pas une erreur : le moteur se suspend et rend la liste des tâches à lancer.
 */
export class TacheEnAttente extends Error {
  constructor(
    readonly tache: { agent: string; phase: string; tour: number | null; tentative: number; input: string; output: string },
  ) {
    super(`Tâche en attente : ${tache.agent} (${tache.phase})`);
  }
}

export interface LlmClient {
  readonly mode: "mock" | "reel" | "plugin";
  callAgent(p: CallAgentParams): Promise<CallAgentResult>;
}
