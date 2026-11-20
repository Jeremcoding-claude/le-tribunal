// TOUS les calculs du Comptable : les lignes L1 à L14 (plan v3.0, §3.5). Le code calcule, jamais le LLM.
// Une ligne dont une entrée manque (ou dont le calcul n'a pas de sens) vaut « non calculable » : on n'invente rien.

import type { LedgerLine } from "../schemas";

export interface Hypothese {
  valeur: number | null;
  /** Id de l'affirmation qui la fonde, « CASE-prix » ou « CONFIG ». */
  ref: string;
}

export interface EntreesLedger {
  prix: Hypothese; // P, prix mensuel HT
  coutVariable: Hypothese; // Cv, par client et par mois
  churnPct: Hypothese; // churn mensuel, en %
  cac: Hypothese;
  chargesFixes: Hypothese; // F, par mois
  objectif: Hypothese; // R, rémunération mensuelle visée
  sam: Hypothese; // part atteignable, en unités (vient de l'Investisseur)
}

const arrondi = (v: number) => Math.round(v * 1e6) / 1e6;
// Évite ⌈10,000000000000002⌉ = 11 quand F / marge vaut 10 en théorie.
const plafond = (v: number) => Math.ceil(Math.round(v * 1e9) / 1e9);

function ligne(id: LedgerLine["ligne"], libelle: string, formule: string, valeur: number | null, entrees: Hypothese[]): LedgerLine {
  const ok = valeur !== null && Number.isFinite(valeur);
  return {
    ligne: id,
    libelle,
    formule,
    valeur: ok ? arrondi(valeur) : null,
    statut: ok ? "calcule" : "non_calculable",
    depuis: [...new Set(entrees.map((e) => e.ref))],
  };
}

/** Les 14 lignes, toujours dans cet ordre, avec les mêmes formules. */
export function calculerLedger(e: EntreesLedger): LedgerLine[] {
  const P = e.prix.valeur, Cv = e.coutVariable.valeur, churn = e.churnPct.valeur, CAC = e.cac.valeur;
  const F = e.chargesFixes.valeur, R = e.objectif.valeur, SAM = e.sam.valeur;

  const marge = P !== null && Cv !== null ? P - Cv : null;
  const vie = churn !== null && churn > 0 ? 1 / (churn / 100) : null;
  const ltv = marge !== null && vie !== null ? marge * vie : null;
  const ltvSurCac = ltv !== null && CAC !== null && CAC > 0 ? ltv / CAC : null;
  const payback = marge !== null && marge > 0 && CAC !== null ? CAC / marge : null;
  const pointMort = marge !== null && marge > 0 && F !== null ? plafond(F / marge) : null;
  const clientsObjectif = marge !== null && marge > 0 && F !== null && R !== null ? plafond((F + R) / marge) : null;
  const budgetAcq = pointMort !== null && CAC !== null ? pointMort * CAC : null;
  const partSam = pointMort !== null && SAM !== null && SAM > 0 ? pointMort / SAM : null;
  const plafondRevenu = SAM !== null && P !== null ? SAM * P * 12 : null;

  return [
    ligne("L1", "Prix mensuel HT", "P", P, [e.prix]),
    ligne("L2", "Coût variable par client et par mois", "Cv", Cv, [e.coutVariable]),
    ligne("L3", "Marge unitaire", "P − Cv ; taux de marge = (P − Cv) / P", marge, [e.prix, e.coutVariable]),
    ligne("L4", "Durée de vie moyenne d'un client (mois)", "1 / churn", vie, [e.churnPct]),
    ligne("L5", "LTV", "marge unitaire × durée de vie", ltv, [e.prix, e.coutVariable, e.churnPct]),
    ligne("L6", "CAC", "CAC", CAC, [e.cac]),
    ligne("L7", "Ratio LTV / CAC", "L5 / L6", ltvSurCac, [e.prix, e.coutVariable, e.churnPct, e.cac]),
    ligne("L8", "Payback (mois)", "CAC / marge unitaire", payback, [e.prix, e.coutVariable, e.cac]),
    ligne("L9", "Charges fixes mensuelles", "F", F, [e.chargesFixes]),
    ligne("L10", "Point mort (clients)", "⌈F / marge unitaire⌉", pointMort, [e.prix, e.coutVariable, e.chargesFixes]),
    ligne("L11", "Clients pour se verser l'objectif R", "⌈(F + R) / marge unitaire⌉", clientsObjectif, [e.prix, e.coutVariable, e.chargesFixes, e.objectif]),
    ligne("L12", "Budget d'acquisition pour atteindre le point mort", "L10 × CAC", budgetAcq, [e.prix, e.coutVariable, e.chargesFixes, e.cac]),
    ligne("L13", "Part du SAM nécessaire", "L10 / SAM", partSam, [e.prix, e.coutVariable, e.chargesFixes, e.sam]),
    ligne("L14", "Plafond de revenu annuel", "SAM × P × 12", plafondRevenu, [e.sam, e.prix]),
  ];
}

/** Les entrées du tableau d'après les hypothèses du Comptable, le SAM de l'Investisseur et l'objectif de config. */
export function entreesDepuisHypotheses(
  h: Record<"prix_mensuel_ht" | "cout_variable_mensuel" | "churn_mensuel_pct" | "cac" | "charges_fixes_mensuelles" | "objectif_remuneration_mensuelle", Hypothese>,
  sam: Hypothese,
): EntreesLedger {
  return {
    prix: h.prix_mensuel_ht,
    coutVariable: h.cout_variable_mensuel,
    churnPct: h.churn_mensuel_pct,
    cac: h.cac,
    chargesFixes: h.charges_fixes_mensuelles,
    objectif: h.objectif_remuneration_mensuelle,
    sam,
  };
}
