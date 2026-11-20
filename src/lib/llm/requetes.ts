// Construction des requêtes à l'API Messages : fonctions PURES, testables sans réseau (garde-fou G6).
// Chaque requête porte `max_tokens` ; chaque outil web porte `max_uses` ; le prompt système est mis en cache.
//
// Trois formes :
// - requeteRecherche : appel 1 des agents qui cherchent sur le web. Outils web + citations, TEXTE ; jamais de format JSON
//   (sorties structurées et citations sont incompatibles : erreur 400 [S27]).
// - requeteMiseEnForme : appel 2. Aucun outil ; le JSON est imposé par output_config.format (zodOutputFormat).
// - requeteDirecte : agents sans recherche (rédacteur, Comptable en lecture, revote, Juge) : un seul appel, JSON imposé.

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";
import { AGENTS, type AgentId, type Phase } from "../../../prompts/agents.config";
import { GUARDRAILS } from "../guardrails/config";
import { outilsNatifs, type OutilNatif } from "../search/native";
import { listeCitationsPourPrompt } from "./citations";
import type { Citation } from "./types";

export interface BlocSysteme {
  type: "text";
  text: string;
  cache_control: { type: "ephemeral" };
}
export interface RequeteMessages {
  model: string;
  max_tokens: number;
  system: BlocSysteme[];
  messages: { role: "user" | "assistant"; content: unknown }[];
  tools?: OutilNatif[];
  output_config?: { format: unknown };
}

/** max_tokens par phase, lu dans config.ts (tokens.*). */
export function maxTokensPourPhase(phase: Phase): number {
  const t = GUARDRAILS.tokens;
  switch (phase) {
    case "IDENTIFICATION":
    case "IDENTIFICATION_COMPLEMENT":
    case "MISE_EN_ETAT":
      return t.greffier;
    case "INSTRUCTION":
      return t.jure;
    case "LECTURE":
      return t.comptableLecture;
    case "DEBAT":
      return t.debat;
    case "REVOTE":
      return t.revote;
    case "CORRECTION":
      return t.juge;
  }
}

/** Le prompt système est identique d'un procès à l'autre : on le met en cache (lecture à 0,05 × le prix d'entrée). */
export const systemEnCache = (texte: string): BlocSysteme[] => [{ type: "text", text: texte, cache_control: { type: "ephemeral" } }];

export function requeteRecherche(o: { agent: AgentId; phase: Phase; system: string; mission: string; pays?: string }): RequeteMessages {
  const tools = outilsNatifs(o.agent, o.phase, o.pays);
  return {
    model: AGENTS[o.agent].modele,
    max_tokens: maxTokensPourPhase(o.phase),
    system: systemEnCache(o.system),
    messages: [{ role: "user", content: o.mission }],
    tools,
  };
}

export function requeteMiseEnForme(o: {
  agent: AgentId;
  phase: Phase;
  system: string;
  dossier: string;
  citations: Citation[];
  schema: ZodType;
}): RequeteMessages {
  return {
    model: GUARDRAILS.models.miseEnForme,
    max_tokens: maxTokensPourPhase(o.phase),
    system: systemEnCache(o.system),
    messages: [
      {
        role: "user",
        content: `DOSSIER DE TRAVAIL\n${o.dossier}\n\nCITATIONS\n${listeCitationsPourPrompt(o.citations)}`,
      },
    ],
    output_config: { format: zodOutputFormat(o.schema) },
  };
}

export function requeteDirecte(o: { agent: AgentId; phase: Phase; system: string; mission: string; schema: ZodType }): RequeteMessages {
  return {
    model: AGENTS[o.agent].modele,
    max_tokens: maxTokensPourPhase(o.phase),
    system: systemEnCache(o.system),
    messages: [{ role: "user", content: o.mission }],
    output_config: { format: zodOutputFormat(o.schema) },
  };
}
