// Logique de la salle SANS navigateur ni WebGL : une fonction pure « liste d'événements → état de la salle » (plan v3.0, §12.5).
// Le direct et le rejeu partagent ce code. Règle G14 : une note n'entre dans l'état qu'à l'événement vote1_ouvert (ou revote_ouvert).

import type { DebateTurn, Question, Ruling, TrialEvent } from "../../lib/schemas";
import { PERSONNAGES, type Acteur } from "./personnages";

export type StatutActeur = "attente" | "recherche" | "verification" | "vote_scelle" | "parle" | "termine" | "absent";
export type Verdict = "GO" | "PIVOT" | "NO-GO";
export type Enveloppe = "aucune" | "scellee" | "ouverte";

export interface EtatActeur {
  acteur: Acteur;
  statut: StatutActeur;
  recherches: number;
  requetes: string[];
  sourcesVerifiees: number;
  sourcesRejetees: number;
  vote1: Enveloppe;
  note1: number | null;
  verdict1: Verdict | null;
  vote2: Enveloppe;
  note2: number | null;
  verdict2: Verdict | null;
}

export interface EtatSalle {
  phase: string | null;
  acteurs: Record<Acteur, EtatActeur>;
  greffier: StatutActeur;
  prenomCliente: string | null;
  identification: Extract<TrialEvent, { type: "identification" }> | null;
  questions: Question[] | null;
  sources: Record<string, { url: string; domaine: string }>;
  debat: DebateTurn[];
  vote1: { moyenne: number; ecartType: number } | null;
  vote2: { moyenne: number; ecartType: number } | null;
  ruling: Ruling | null;
  verdict: Extract<TrialEvent, { type: "verdict" }> | null;
  coutUsd: number;
  alertes: string[];
  erreurFinale: string | null;
  termine: boolean;
  /** Nombre d'événements appliqués : la salle ne montre rien d'autre. */
  evenements: number;
}

export const LIBELLE_PHASE: Record<string, string> = {
  P0: "Dépôt de l'idée",
  P1a: "Le greffier identifie le business",
  P1b: "Questions de mise en état",
  P1c: "Le greffier prépare le dossier neutre",
  P2: "Instruction : les jurés cherchent des chiffres sourcés",
  P3: "Débat en deux tours",
  P4: "Correction du plan par Nadia",
  P5: "Revote",
  P6: "Verdict",
};

const vide = (acteur: Acteur): EtatActeur => ({
  acteur,
  statut: "attente",
  recherches: 0,
  requetes: [],
  sourcesVerifiees: 0,
  sourcesRejetees: 0,
  vote1: "aucune",
  note1: null,
  verdict1: null,
  vote2: "aucune",
  note2: null,
  verdict2: null,
});

export function etatInitial(): EtatSalle {
  return {
    phase: null,
    acteurs: Object.fromEntries(PERSONNAGES.map((p) => [p.acteur, vide(p.acteur)])) as Record<Acteur, EtatActeur>,
    greffier: "attente",
    prenomCliente: null,
    identification: null,
    questions: null,
    sources: {},
    debat: [],
    vote1: null,
    vote2: null,
    ruling: null,
    verdict: null,
    coutUsd: 0,
    alertes: [],
    erreurFinale: null,
    termine: false,
    evenements: 0,
  };
}

/** Applique UN événement, sans modifier l'état reçu. */
export function appliquer(s: EtatSalle, e: TrialEvent): EtatSalle {
  const n: EtatSalle = { ...s, acteurs: { ...s.acteurs }, evenements: s.evenements + 1 };
  const maj = (a: Acteur, p: Partial<EtatActeur>) => {
    n.acteurs[a] = { ...n.acteurs[a], ...p };
  };
  const estActeur = (a: string): a is Acteur => a in n.acteurs;

  switch (e.type) {
    case "phase_started":
      n.phase = e.phase;
      break;
    case "agent_status":
      if (e.agent === "greffier") n.greffier = e.statut;
      else if (estActeur(e.agent)) maj(e.agent, { statut: e.statut });
      break;
    case "search_performed":
      if (estActeur(e.agent)) maj(e.agent, { recherches: n.acteurs[e.agent].recherches + 1, requetes: [...n.acteurs[e.agent].requetes, e.requete].slice(-3) });
      break;
    case "source_verified":
      if (estActeur(e.agent)) maj(e.agent, { sourcesVerifiees: n.acteurs[e.agent].sourcesVerifiees + 1 });
      n.sources = { ...n.sources, [e.id]: { url: e.url, domaine: e.domaine } };
      break;
    case "source_rejected":
      if (estActeur(e.agent)) maj(e.agent, { sourcesRejetees: n.acteurs[e.agent].sourcesRejetees + 1 });
      break;
    case "identification":
      n.identification = e;
      break;
    case "cliente_creee":
      n.prenomCliente = e.prenom;
      break;
    case "questions":
      n.questions = e.questions;
      break;
    case "answers_received":
      n.questions = null;
      break;
    case "vote_sealed":
      maj(e.agent, { vote1: "scellee", statut: "vote_scelle" });
      break;
    case "vote1_ouvert":
      for (const v of e.notes) maj(v.agent, { vote1: "ouverte", note1: v.note, verdict1: v.verdict });
      n.vote1 = { moyenne: e.moyenne, ecartType: e.ecart_type };
      break;
    case "debate_reply":
      n.debat = [...n.debat, e.tour];
      maj(e.tour.agent, { statut: "parle" });
      break;
    case "ruling":
      n.ruling = e.ruling;
      break;
    case "revote":
      maj(e.agent, { vote2: "scellee" });
      break;
    case "revote_ouvert":
      for (const v of e.notes) maj(v.agent, { vote2: "ouverte", note2: v.note, verdict2: v.verdict });
      n.vote2 = { moyenne: e.moyenne, ecartType: e.ecart_type };
      break;
    case "verdict":
      n.verdict = e;
      n.termine = true;
      break;
    case "cost_update":
      n.coutUsd = e.usd;
      break;
    case "error":
      if (e.code === "echec" || e.code === "budget_depasse") {
        n.erreurFinale = e.message;
        n.termine = true;
      } else n.alertes = [...n.alertes, `${e.code} : ${e.message}`];
      break;
    default:
      break;
  }
  return n;
}

export function etatSalle(evenements: TrialEvent[]): EtatSalle {
  return evenements.reduce(appliquer, etatInitial());
}
