// L'ordre des phases et les transitions autorisées (plan v3.0, §3). Le CODE enchaîne les phases, jamais le LLM.
// Seule la phase suivante est permise ; l'échec ou l'ajournement sont des états finaux accessibles depuis toute phase.

export const PHASES_PROCES = ["P0", "P1a", "P1b", "P1c", "P2", "P3", "P4", "P5", "P6"] as const;
export type PhaseProces = (typeof PHASES_PROCES)[number];
export type EtatFinal = "TERMINE" | "AJOURNE" | "ECHEC" | "BUDGET_DEPASSE";
export type EtatProces = "DEBUT" | PhaseProces | EtatFinal;

const ORDRE: EtatProces[] = ["DEBUT", ...PHASES_PROCES, "TERMINE"];
export const estFinal = (e: EtatProces): e is EtatFinal => ["TERMINE", "AJOURNE", "ECHEC", "BUDGET_DEPASSE"].includes(e);

export class TransitionInterdite extends Error {}

/** `depuis` est l'état courant ; l'état « P2 » signifie « P2 terminée ». */
export function transitionAutorisee(depuis: EtatProces, vers: EtatProces): boolean {
  if (estFinal(depuis)) return false;
  if (vers === "AJOURNE" || vers === "ECHEC" || vers === "BUDGET_DEPASSE") return depuis !== "DEBUT";
  const i = ORDRE.indexOf(depuis);
  return i >= 0 && ORDRE[i + 1] === vers;
}

export function transition(depuis: EtatProces, vers: EtatProces): EtatProces {
  if (!transitionAutorisee(depuis, vers)) throw new TransitionInterdite(`Transition interdite : ${depuis} → ${vers}.`);
  return vers;
}

/** La phase à jouer après un point de sauvegarde (reprise après coupure). */
export function phaseSuivante(derniere: EtatProces): PhaseProces | null {
  const i = ORDRE.indexOf(derniere);
  const s = ORDRE[i + 1];
  return s && s !== "TERMINE" ? (s as PhaseProces) : null;
}
