// Plafond de coût (plan v3.0, G6). usage.ts additionne ; ici on décide : alerte au-delà de warnUsdPerTrial,
// arrêt propre (statut budget_depasse, rapport partiel) au-delà de maxUsdPerTrial.

import { GUARDRAILS } from "./config";

export type EtatBudget = "ok" | "alerte" | "depasse";

export function etatBudget(coutUsd: number, cfg: typeof GUARDRAILS.budget = GUARDRAILS.budget): EtatBudget {
  if (coutUsd > cfg.maxUsdPerTrial) return "depasse";
  if (coutUsd > cfg.warnUsdPerTrial) return "alerte";
  return "ok";
}

/** Suit le budget d'un procès : l'alerte n'est donnée qu'une fois. */
export class SuiviBudget {
  private alerte = false;
  constructor(private readonly cfg: typeof GUARDRAILS.budget = GUARDRAILS.budget) {}

  verifier(coutUsd: number): { etat: EtatBudget; nouvelleAlerte: boolean } {
    const etat = etatBudget(coutUsd, this.cfg);
    const nouvelleAlerte = etat === "alerte" && !this.alerte;
    if (etat !== "ok") this.alerte = true;
    return { etat, nouvelleAlerte };
  }
}
