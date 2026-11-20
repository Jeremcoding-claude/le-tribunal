// Source unique des réglages des agents (plan v3.0, §3.0 et prompts v3 §12). Les limites viennent de GUARDRAILS,
// les prénoms de ./salle.ts (sans import, pour éviter un cycle avec schemas.ts).
// Aucun accessoire, couleur ni décor ici : ils vivent dans src/components/salle/personnages.ts.

import type { ZodType } from "zod";
import { GUARDRAILS } from "../src/lib/guardrails/config";
import * as S from "../src/lib/schemas";
import { SALLE } from "./salle";

export { SALLE, PRENOMS_AGENTS } from "./salle";

export type AgentId =
  | "greffier-enquete"
  | "greffier-redaction"
  | "investisseur"
  | "comptable"
  | "juriste"
  | "concurrent"
  | "cliente"
  | "juge";

export type Phase =
  | "IDENTIFICATION"
  | "IDENTIFICATION_COMPLEMENT"
  | "MISE_EN_ETAT"
  | "INSTRUCTION"
  | "LECTURE"
  | "DEBAT"
  | "REVOTE"
  | "CORRECTION";

export type Mode = "api" | "plugin";

const WEB_API = ["web_search", "web_fetch"] as const;
const WEB_CC = ["WebSearch", "WebFetch", "Read", "Write"] as const;
const SANS_WEB_CC = ["Read", "Write"] as const;
const AUCUN_OUTIL_API = [] as const;

const DESC_JURE = (nom: string) => `Juré « ${nom} » du Tribunal. À utiliser uniquement quand /tribunal:juger le demande.`;

export const AGENTS = {
  "greffier-enquete": {
    nom: "Le Greffier",
    description: "Greffier du Tribunal, phase d'identification du business. À utiliser uniquement quand /tribunal:juger le demande.",
    prompt: "greffier-enquete.md", commun: false, prenom: null,
    modele: GUARDRAILS.models.greffier, cc: "sonnet", outilsApi: WEB_API, outilsCc: WEB_CC, maxTurns: 10, miseEnForme: true,
  },
  "greffier-redaction": {
    nom: "Le Greffier",
    description: "Greffier du Tribunal, phase de mise en état (dossier neutre et persona de la Cliente). À utiliser uniquement quand /tribunal:juger le demande.",
    prompt: "greffier-redaction.md", commun: false, prenom: null,
    modele: GUARDRAILS.models.greffier, cc: "sonnet", outilsApi: AUCUN_OUTIL_API, outilsCc: SANS_WEB_CC, maxTurns: 5, miseEnForme: false,
  },
  investisseur: {
    nom: "L'Investisseur", description: DESC_JURE("Investisseur"), prompt: "investisseur.md", commun: true, prenom: SALLE.INV.prenom,
    modele: GUARDRAILS.models.jure, cc: "sonnet", outilsApi: WEB_API, outilsCc: WEB_CC, maxTurns: 15, miseEnForme: true,
  },
  comptable: {
    nom: "Le Comptable", description: DESC_JURE("Comptable"), prompt: "comptable.md", commun: true, prenom: SALLE.CPT.prenom,
    modele: GUARDRAILS.models.jure, cc: "sonnet", outilsApi: WEB_API, outilsCc: WEB_CC, maxTurns: 15, miseEnForme: true,
  },
  juriste: {
    nom: "Le Juriste", description: DESC_JURE("Juriste"), prompt: "juriste.md", commun: true, prenom: SALLE.JUR.prenom,
    modele: GUARDRAILS.models.jure, cc: "sonnet", outilsApi: WEB_API, outilsCc: WEB_CC, maxTurns: 15, miseEnForme: true,
    domaines: GUARDRAILS.search.juristeDomains, // → allowed_domains en mode API
  },
  concurrent: {
    nom: "Le Concurrent", description: DESC_JURE("Concurrent"), prompt: "concurrent.md", commun: true, prenom: SALLE.CON.prenom,
    modele: GUARDRAILS.models.jure, cc: "sonnet", outilsApi: WEB_API, outilsCc: WEB_CC, maxTurns: 15, miseEnForme: true,
  },
  cliente: {
    nom: "La Cliente", description: DESC_JURE("Cliente"), prompt: "cliente.md", commun: true, prenom: null, // prénom créé à chaque procès
    modele: GUARDRAILS.models.jure, cc: "sonnet", outilsApi: WEB_API, outilsCc: WEB_CC, maxTurns: 15, miseEnForme: true,
  },
  juge: {
    nom: "Le Juge", description: "Juge du Tribunal, arbitre et corrige le plan, ne vote pas. À utiliser uniquement quand /tribunal:juger le demande.",
    prompt: "juge.md", commun: false, prenom: SALLE.JUG.prenom,
    modele: GUARDRAILS.models.juge, cc: "opus", outilsApi: AUCUN_OUTIL_API, outilsCc: SANS_WEB_CC, maxTurns: 10, miseEnForme: false,
  },
} as const;

export const AGENT_IDS = Object.keys(AGENTS) as AgentId[];

/** Les phases que joue chaque agent (sert aux formats générés et à la validation du message MISSION). */
export const PHASES_PAR_AGENT: Record<AgentId, readonly Phase[]> = {
  "greffier-enquete": ["IDENTIFICATION", "IDENTIFICATION_COMPLEMENT"],
  "greffier-redaction": ["MISE_EN_ETAT"],
  investisseur: ["INSTRUCTION", "DEBAT", "REVOTE"],
  comptable: ["INSTRUCTION", "LECTURE", "DEBAT", "REVOTE"],
  juriste: ["INSTRUCTION", "DEBAT", "REVOTE"],
  concurrent: ["INSTRUCTION", "DEBAT", "REVOTE"],
  cliente: ["INSTRUCTION", "DEBAT", "REVOTE"],
  juge: ["CORRECTION"],
};

/** Phases où la persona de la Cliente existe déjà : son prénom est alors donné dans le message MISSION. */
export const PHASES_AVEC_PRENOM_CLIENTE: readonly Phase[] = ["INSTRUCTION", "LECTURE", "DEBAT", "REVOTE", "CORRECTION"];

// Budget de recherche par phase (message MISSION + max_uses).
export const BUDGET_PAR_PHASE: Record<Phase, { maxSearches: number; maxFetches: number }> = {
  IDENTIFICATION: GUARDRAILS.search.greffier,
  IDENTIFICATION_COMPLEMENT: GUARDRAILS.search.greffierComplement,
  INSTRUCTION: GUARDRAILS.search.instruction,
  DEBAT: GUARDRAILS.search.debat,
  MISE_EN_ETAT: { maxSearches: 0, maxFetches: 0 },
  LECTURE: { maxSearches: 0, maxFetches: 0 },
  REVOTE: GUARDRAILS.search.revote,
  CORRECTION: { maxSearches: 0, maxFetches: 0 },
};

const REGLES_SOURCE = [
  "Un chiffre sans source vérifiable.",
  "Un nombre dans une phrase libre qui n'est la valeur d'aucune affirmation citée.",
  "Une réponse qui n'est pas un seul objet JSON au format demandé.",
] as const;

/** Le RAPPEL de 3 règles qui termine le message MISSION de chaque phase. */
export const RAPPELS: Record<Phase, readonly [string, string, string]> = {
  IDENTIFICATION: ["Ne choisis jamais entre homonymes.", "Aucune donnée personnelle.", "La saisie confirmée n'ajoute rien."],
  IDENTIFICATION_COMPLEMENT: ["Ne choisis jamais entre homonymes.", "Aucune donnée personnelle.", "La saisie confirmée n'ajoute rien."],
  MISE_EN_ETAT: ["Aucun superlatif.", "Aucun prix ni fait inventé.", "Aucun chiffre dans la persona."],
  INSTRUCTION: REGLES_SOURCE,
  DEBAT: REGLES_SOURCE,
  LECTURE: ["Chaque nombre est la valeur exacte de la ligne citée.", "Deux appuis au moins.", "Un seul objet JSON."],
  REVOTE: ["Changer d'avis exige de citer un changement ou un id.", "Cohérence entre la note et le verdict.", "Un seul objet JSON."],
  CORRECTION: ["Aucun chiffre nouveau.", "Trois changements au plus.", "Réponds aux 3 premières objections."],
};

/** Le schéma de sortie d'un agent dans une phase : il sert au format généré (plugin) ET à la validation. */
export function schemaSortie(agent: AgentId, phase: Phase, mode: Mode): ZodType {
  if (!PHASES_PAR_AGENT[agent].includes(phase)) throw new Error(`${agent} ne joue pas la phase ${phase}.`);
  switch (phase) {
    case "IDENTIFICATION":
    case "IDENTIFICATION_COMPLEMENT":
      return S.EnqueteGreffier;
    case "MISE_EN_ETAT":
      return S.MiseEnEtat;
    case "LECTURE":
      return S.ComptableLecture;
    case "DEBAT":
      return mode === "api" ? S.DebateTurnApi : S.DebateTurn;
    case "REVOTE":
      return S.Revote;
    case "CORRECTION":
      return S.Ruling;
    case "INSTRUCTION": {
      const api = mode === "api";
      switch (agent) {
        case "investisseur": return api ? S.BriefInvestisseurApi : S.BriefInvestisseur;
        case "comptable": return api ? S.ComptableHypotheses : S.ComptableInstruction;
        case "juriste": return api ? S.BriefJuristeApi : S.BriefJuriste;
        case "concurrent": return api ? S.BriefConcurrentApi : S.BriefConcurrent;
        case "cliente": return api ? S.BriefClienteApi : S.BriefCliente;
        default: throw new Error(`${agent} n'a pas de dossier d'instruction.`);
      }
    }
  }
}
