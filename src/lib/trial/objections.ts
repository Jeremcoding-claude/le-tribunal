// Classement des objections pour le Juge (plan v3.0, §3.9). Une objection = un argument « contre » d'un juré ou une objection de
// la Cliente. Elle est soutenue par son auteur et par tout juré qui y répond « concède » ou « précise » dans le débat.
// Score = Σ poids de chaque soutien, selon son vote 1 : NO-GO 2, PIVOT 1,5, GO 1 [H]. Les 5 premières vont au Juge.

import type { AgentJure, DebateTurn, Vote } from "../schemas";
import { CODES_AGENT } from "../schemas";

export const POIDS_OBJECTION = { "NO-GO": 2, PIVOT: 1.5, GO: 1 } as const;

export interface Objection {
  id: string;
  auteur: AgentJure;
  texte: string;
  soutiens: AgentJure[];
  score: number;
}

interface Source {
  agent: AgentJure;
  arguments: { id: string; sens: string; these: string }[];
  objections?: { id: string; citation: string }[];
}

export function classerObjections(o: {
  dossiers: Source[];
  debats: Pick<DebateTurn, "agent" | "repliques">[];
  votes1: Partial<Record<AgentJure, Pick<Vote, "verdict">>>;
  max?: number;
}): Objection[] {
  const liste: Omit<Objection, "soutiens" | "score">[] = [];
  for (const d of o.dossiers) {
    for (const a of d.arguments) if (a.sens === "contre") liste.push({ id: a.id, auteur: d.agent, texte: a.these });
    for (const ob of d.objections ?? []) liste.push({ id: ob.id, auteur: d.agent, texte: ob.citation });
  }
  const classees = liste.map((ob): Objection => {
    const soutiens = new Set<AgentJure>([ob.auteur]);
    for (const t of o.debats) {
      if (t.repliques.some((r) => r.vise === ob.id && (r.type === "concede" || r.type === "precise"))) soutiens.add(t.agent);
    }
    const score = [...soutiens].reduce((s, a) => s + (o.votes1[a] ? POIDS_OBJECTION[o.votes1[a]!.verdict] : 0), 0);
    return { ...ob, soutiens: [...soutiens], score };
  });
  return classees.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, o.max ?? 5);
}

export const codeDe = (a: AgentJure) => CODES_AGENT[a];
