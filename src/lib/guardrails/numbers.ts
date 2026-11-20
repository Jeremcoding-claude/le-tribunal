// Extraction et comparaison des nombres d'un texte français (plan v3.0, G1 et G4).
// Utilisé dès l'étape 4 par intake.ts (lecture du prix) ; l'étape 5 l'étend au vérificateur de sources.

import { GUARDRAILS } from "./config";

export interface NombreLu {
  /** Valeur numérique, multiplicateur appliqué (« 1,2 Md€ » → 1 200 000 000). */
  valeur: number;
  /** Le texte tel qu'il apparaît (« 1,2 Md€ »). */
  texte: string;
  /** « % », « € », « $ », « £ » ou null. */
  unite: string | null;
  debut: number;
}

const ESPACES = "[ \\u00a0\\u202f]";
const NOMBRE = `(?:\\d{1,3}(?:${ESPACES}\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)`;
const MULTIPLICATEUR = `(?:${ESPACES}?(Mds?|milliards?|M|millions?|k|K|mille)(?![\\p{L}]))`;
const UNITE = `(?:${ESPACES}?(%|€|\\$|£|euros?|EUR|USD)(?![\\p{L}]))`;
const RE_NOMBRE = new RegExp(`(?<![\\p{L}\\d.,])(${NOMBRE})${MULTIPLICATEUR}?${UNITE}?`, "gu");

const FACTEURS: Record<string, number> = { k: 1e3, K: 1e3, mille: 1e3, M: 1e6, million: 1e6, millions: 1e6, Md: 1e9, Mds: 1e9, milliard: 1e9, milliards: 1e9 };

function unite(u: string | undefined): string | null {
  if (!u) return null;
  if (u === "%") return "%";
  if (/^(€|euros?|EUR)$/i.test(u)) return "€";
  if (/^(\$|USD)$/i.test(u)) return "$";
  if (u === "£") return "£";
  return null;
}

/** Tous les nombres d'un texte, dans l'ordre : « 1 234,5 », « 12 % », « 1,2 Md€ », « 3 k », « 149 €/mois ». */
export function extraireNombres(texte: string): NombreLu[] {
  const trouves: NombreLu[] = [];
  for (const m of texte.matchAll(RE_NOMBRE)) {
    const brut = m[1].replace(/[   ]/g, "").replace(",", ".");
    let valeur = Number(brut);
    if (!Number.isFinite(valeur)) continue;
    if (m[2]) valeur *= FACTEURS[m[2]] ?? 1;
    trouves.push({ valeur, texte: m[0].trim(), unite: unite(m[3]), debut: m.index ?? 0 });
  }
  return trouves;
}

/** Deux nombres sont égaux à `tolerancePct` % près (±1 % par défaut, config.ts). */
export function comparer(a: number, b: number, tolerancePct: number = GUARDRAILS.numbers.tolerancePct): boolean {
  if (a === b) return true;
  const ecart = Math.abs(a - b);
  return ecart <= (Math.max(Math.abs(a), Math.abs(b)) * tolerancePct) / 100;
}

/** Le texte contient-il ce nombre (à la tolérance près) ? */
export function contientValeur(texte: string, valeur: number, tolerancePct?: number): boolean {
  return extraireNombres(texte).some((n) => comparer(n.valeur, valeur, tolerancePct));
}

// ───────────── Prix ─────────────

export type PeriodePrix = "mois" | "an" | "commande" | "unique" | "inconnue";
export interface PrixLu {
  montant: number;
  devise: "EUR" | "USD" | "GBP";
  periode: PeriodePrix;
  htOuTtc: "ht" | "ttc" | "inconnu";
  /** Le passage du texte qui exprime le prix (« 149 € par mois »). */
  texte: string;
}

const DEVISE = "(?:€|euros?|EUR|\\$|USD|£)";
const PERIODE = "(?:par|/)\\s*\\p{L}+";
const TAXE = "(?:HT|TTC)";
// Un prix isolé : « 149 € par mois », « à 30 €/commande », « 49 € HT par mois ».
const PRIX = `\\d[\\d \\u00a0\\u202f.,]*\\s*${DEVISE}(?:\\s*${TAXE})?(?:\\s*${PERIODE})?(?:\\s*${TAXE})?`;
const RE_PRIX_SEUL = new RegExp(`^(?:à\\s+|pour\\s+)?${PRIX}$|^gratuit$`, "iu");
const RE_PRIX_DANS_TEXTE = new RegExp(`(?:\\s+(?:à|pour))?\\s*${PRIX}`, "iu");

function periodeDe(texte: string): PeriodePrix {
  if (/(par|\/)\s*(mois|mensuel)|mensuel/i.test(texte)) return "mois";
  if (/(par|\/)\s*(an|ans|année)|annuel/i.test(texte)) return "an";
  if (/(par|\/)\s*commande/i.test(texte)) return "commande";
  if (/une seule fois|paiement unique|achat unique/i.test(texte)) return "unique";
  return "inconnue";
}

/** Lit un prix dans un texte (le premier). Renvoie null s'il n'y en a pas. « gratuit » vaut 0. */
export function lirePrix(texte: string): PrixLu | null {
  if (/^\s*gratuit\s*$/i.test(texte)) return { montant: 0, devise: "EUR", periode: "inconnue", htOuTtc: "inconnu", texte: "gratuit" };
  const m = texte.match(new RegExp(PRIX, "iu"));
  if (!m) return null;
  const n = extraireNombres(m[0])[0];
  if (!n) return null;
  const devise = /\$|USD/i.test(m[0]) ? "USD" : /£/.test(m[0]) ? "GBP" : "EUR";
  const htOuTtc = /\bTTC\b/i.test(m[0]) ? "ttc" : /\bHT\b/i.test(m[0]) ? "ht" : "inconnu";
  return { montant: n.valeur, devise, periode: periodeDe(m[0]), htOuTtc, texte: m[0].trim() };
}

/** L'élément entier n'est-il qu'un prix ? (« 149 € par mois », « à 30 €/commande », « gratuit ») */
export function estUnPrix(element: string): boolean {
  return RE_PRIX_SEUL.test(element.trim());
}

/** Retire de l'élément le prix qu'il contient (« agents IA à 149 € par mois » → « agents IA »). */
export function retirerPrix(element: string): string {
  return element.replace(RE_PRIX_DANS_TEXTE, "").replace(/\s{2,}/g, " ").trim();
}
