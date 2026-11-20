// TOUS les calculs de note (plan v3.0, §4.2 : règle v1). Le code compte, jamais un agent.
// Les comparaisons se font en DEMI-POINTS ENTIERS : aucune erreur d'arrondi aux bornes (6, 4,5, 1,5, 0,5).
// Les constantes viennent de config.ts (GUARDRAILS.tally).

import { GUARDRAILS } from "../guardrails/config";
import type { Vote } from "../schemas";

export type VerdictJure = Vote["verdict"];
export type VerdictJury = VerdictJure | "AJOURNE";
export type Phrase =
  | "Lance."
  | "Modifie ton plan : la version corrigée peut être lancée."
  | "Modifie ton plan."
  | "Ne lance pas."
  | "Procès ajourné.";

type Cfg = typeof GUARDRAILS.tally;

export interface StatsVote {
  n: number;
  /** Moyenne arrondie à 0,1 (0,05 vers le haut) ; null si aucun vote. */
  moyenne: number | null;
  /** Écart-type de la population, arrondi à 0,01. */
  ecartType: number | null;
  repartition: Record<VerdictJure, number>;
  juryDivise: boolean;
  consensusSuspect: boolean;
  /** Verdict de la moyenne : GO si ≥ goMin, NO-GO si ≤ nogoMax, PIVOT sinon. */
  verdictMoyenne: VerdictJure | null;
  /** Verdict d'une majorité stricte (plus de la moitié des votes), sinon null. */
  verdictMajorite: VerdictJure | null;
}

const demi = (note: number) => Math.round(note * 2);

/** Statistiques d'un tour de vote. Toutes les décisions sont prises sur des entiers (demi-points). */
export function statsVote(votes: Pick<Vote, "note" | "verdict">[], cfg: Cfg = GUARDRAILS.tally): StatsVote {
  const n = votes.length;
  const repartition: Record<VerdictJure, number> = { GO: 0, PIVOT: 0, "NO-GO": 0 };
  for (const v of votes) repartition[v.verdict]++;
  if (n === 0) {
    return { n, moyenne: null, ecartType: null, repartition, juryDivise: false, consensusSuspect: false, verdictMoyenne: null, verdictMajorite: null };
  }
  const h = votes.map((v) => demi(v.note));
  const S = h.reduce((a, b) => a + b, 0);
  const Q = h.reduce((a, b) => a + b * b, 0);

  // moyenne = S / (2n) ; en dixièmes arrondis au plus proche, la moitié vers le haut : ⌊(10·S + n) / 2n⌋
  const moyenne = Math.floor((10 * S + n) / (2 * n)) / 10;
  // variance (en notes²) = (n·Q − S²) / (4·n²)
  const num = n * Q - S * S;
  const ecartType = Math.round(Math.sqrt(num / (4 * n * n)) * 100) / 100;
  const juryDivise = num >= 4 * cfg.divise * cfg.divise * n * n;
  const consensusSuspect = num <= 4 * cfg.consensusSuspect * cfg.consensusSuspect * n * n;

  const verdictMoyenne: VerdictJure = S >= 2 * cfg.goMin * n ? "GO" : S <= 2 * cfg.nogoMax * n ? "NO-GO" : "PIVOT";
  const verdictMajorite = (Object.keys(repartition) as VerdictJure[]).find((k) => 2 * repartition[k] > n) ?? null;
  return { n, moyenne, ecartType, repartition, juryDivise, consensusSuspect, verdictMoyenne, verdictMajorite };
}

export interface ResultatTally {
  noteAvant: number | null;
  noteApres: number | null;
  ecartTypeAvant: number | null;
  ecartTypeApres: number | null;
  quorumAvant: boolean;
  quorumApres: boolean;
  /** Répartition des verdicts du revote (ou du vote 1 si le revote n'a pas de quorum). */
  repartition: Record<VerdictJure, number>;
  verdictAvant: VerdictJury;
  verdictJury: VerdictJury;
  regleAppliquee: "majorite" | "egalite_moyenne" | "ajourne";
  /** Majorité et moyenne donnent deux verdicts différents : le verdict reste celui de la majorité. */
  divergence: boolean;
  juryDivise: boolean;
  consensusSuspect: boolean;
  revoteSansQuorum: boolean;
  phrase: Phrase;
}

/** Verdict d'un tour : majorité stricte, sinon la moyenne ; sans quorum, aucun verdict. */
export function verdictDuTour(s: StatsVote, cfg: Cfg = GUARDRAILS.tally): { verdict: VerdictJury; regle: ResultatTally["regleAppliquee"]; divergence: boolean } {
  if (s.n < cfg.quorum) return { verdict: "AJOURNE", regle: "ajourne", divergence: false };
  if (s.verdictMajorite) return { verdict: s.verdictMajorite, regle: "majorite", divergence: s.verdictMajorite !== s.verdictMoyenne };
  return { verdict: s.verdictMoyenne!, regle: "egalite_moyenne", divergence: false };
}

function phraseFinale(avant: VerdictJury, apres: VerdictJury): Phrase {
  if (apres === "AJOURNE" || avant === "AJOURNE") return "Procès ajourné.";
  if (apres === "NO-GO") return "Ne lance pas.";
  if (apres === "PIVOT") return "Modifie ton plan.";
  return avant === "GO" ? "Lance." : "Modifie ton plan : la version corrigée peut être lancée.";
}

/**
 * Notes avant (vote 1) et après (revote), verdict du jury sur le revote, phrase finale.
 * `round1` et `round2` ne contiennent que des votes VALIDES (schéma, cohérence, 2 appuis vérifiés, à l'heure).
 */
export function tally(round1: Pick<Vote, "note" | "verdict">[], round2: Pick<Vote, "note" | "verdict">[], cfg: Cfg = GUARDRAILS.tally): ResultatTally {
  const a = statsVote(round1, cfg);
  const b = statsVote(round2, cfg);
  const quorumAvant = a.n >= cfg.quorum;
  const quorumApres = b.n >= cfg.quorum;
  const va = verdictDuTour(a, cfg);

  const base = {
    noteAvant: quorumAvant ? a.moyenne : null,
    noteApres: quorumApres ? b.moyenne : null,
    ecartTypeAvant: quorumAvant ? a.ecartType : null,
    ecartTypeApres: quorumApres ? b.ecartType : null,
    quorumAvant,
    quorumApres,
  };

  if (!quorumAvant) {
    return { ...base, repartition: a.repartition, verdictAvant: "AJOURNE", verdictJury: "AJOURNE", regleAppliquee: "ajourne", divergence: false, juryDivise: false, consensusSuspect: false, revoteSansQuorum: false, phrase: "Procès ajourné." };
  }
  if (!quorumApres) {
    // Revote sans quorum : le verdict se fonde sur le vote 1, avec la mention « revote sans quorum ».
    return { ...base, repartition: a.repartition, verdictAvant: va.verdict, verdictJury: va.verdict, regleAppliquee: va.regle, divergence: va.divergence, juryDivise: a.juryDivise, consensusSuspect: a.consensusSuspect, revoteSansQuorum: true, phrase: phraseFinale(va.verdict, va.verdict) };
  }
  const vb = verdictDuTour(b, cfg);
  return { ...base, repartition: b.repartition, verdictAvant: va.verdict, verdictJury: vb.verdict, regleAppliquee: vb.regle, divergence: vb.divergence, juryDivise: b.juryDivise, consensusSuspect: b.consensusSuspect, revoteSansQuorum: false, phrase: phraseFinale(va.verdict, vb.verdict) };
}
