// Taux de rejet par règle (plan, étape 9 : `npm run smoke`). Compte, dans les événements d'un procès réel, ce que les garde-fous
// ont écarté : source introuvable, nombre libre, cohérence note/verdict, appuis insuffisants, format. Une règle au-dessus de
// GUARDRAILS.rejets.alerteParRegle (20 %) est signalée : il faut alors ajuster le prompt ou la tolérance, puis relancer.

import { GUARDRAILS } from "../guardrails/config";
import type { TrialEvent } from "../schemas";

export const REGLES = ["source introuvable", "nombre libre", "cohérence note/verdict", "appuis insuffisants", "format"] as const;
export type Regle = (typeof REGLES)[number];

export interface TauxRegle {
  regle: Regle;
  rejets: number;
  total: number;
  taux: number;
  alerte: boolean;
}

const CODES_REFUS = ["juré absent", "juré muet", "revote absent", "proposition rejetée"];

function regleDe(texte: string): Regle {
  const t = texte.toLowerCase();
  if (/url absente|extrait absent|pas dans l'extrait|hors des domaines|sans source|citation|page illisible/.test(t)) return "source introuvable";
  if (/nombre\(s\) sans appui|ligne l\d+|≠ la valeur/.test(t)) return "nombre libre";
  if (/incompatible avec la note|exige une note/.test(t)) return "cohérence note/verdict";
  if (/appui/.test(t)) return "appuis insuffisants";
  return "format";
}

/** Le taux = rejets de la règle / éléments contrôlés (sources vérifiées et rejetées, plus les sorties d'agents refusées). */
export function tauxDeRejet(evenements: TrialEvent[], cfg = GUARDRAILS.rejets): TauxRegle[] {
  const sources = evenements.filter((e) => e.type === "source_verified" || e.type === "source_rejected").length;
  const refus = evenements.filter((e) => e.type === "error" && CODES_REFUS.includes(e.code)).length;
  const total = sources + refus;
  const rejets = new Map<Regle, number>(REGLES.map((r) => [r, 0]));
  for (const e of evenements) {
    if (e.type === "source_rejected") rejets.set("source introuvable", (rejets.get("source introuvable") ?? 0) + 1);
    else if (e.type === "error" && CODES_REFUS.includes(e.code)) {
      const r = regleDe(e.message);
      rejets.set(r, (rejets.get(r) ?? 0) + 1);
    }
  }
  return REGLES.map((regle) => {
    const n = rejets.get(regle) ?? 0;
    const taux = total === 0 ? 0 : n / total;
    return { regle, rejets: n, total, taux: Math.round(taux * 1000) / 1000, alerte: taux > cfg.alerteParRegle };
  });
}
