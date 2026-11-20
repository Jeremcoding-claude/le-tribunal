// Règles sur le prénom et le texte de la persona de la Cliente (plan v3.0, §3.0 et §3.3.4, garde-fou G12).
// Fonctions pures : le code, pas le LLM, décide si une persona est valide.
// Les cinq prénoms fixes viennent de prompts/salle.ts, relu par prompts/agents.config.ts (source unique).

import { PRENOMS_AGENTS } from "../../../prompts/salle";

export { PRENOMS_AGENTS };

/** Minuscules, sans accents, sans espaces autour : « Léa » et « lea » sont le même prénom. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Initiales (majuscules, sans accent) des prénoms fixes : V, L, C, M, N. */
export const INITIALES_INTERDITES: readonly string[] = Object.values(PRENOMS_AGENTS).map((p) =>
  normaliser(p).charAt(0).toUpperCase(),
);

export type ResultatPrenom = { ok: true } | { ok: false; raison: string };

/** Le prénom de la Cliente n'est ni l'un des cinq prénoms fixes, ni un prénom dont l'initiale est déjà prise. */
export function verifierPrenomCliente(prenom: string): ResultatPrenom {
  const p = prenom.trim();
  if (!/^\p{L}[\p{L}'’ -]{1,29}$/u.test(p)) {
    return { ok: false, raison: `« ${prenom} » n'est pas un prénom valide (lettres seulement, 2 à 30 caractères).` };
  }
  const n = normaliser(p);
  for (const pris of Object.values(PRENOMS_AGENTS)) {
    if (normaliser(pris) === n) {
      return { ok: false, raison: `« ${p} » est déjà le prénom d'un agent de la salle.` };
    }
  }
  const initiale = n.charAt(0).toUpperCase();
  if (INITIALES_INTERDITES.includes(initiale)) {
    return {
      ok: false,
      raison: `L'initiale ${initiale} de « ${p} » est déjà prise (${INITIALES_INTERDITES.join(", ")}) : choisir un autre prénom.`,
    };
  }
  return { ok: true };
}

const HEURES = /\b\d{1,2}\s?h(?:\s?\d{2})?\b/gi;

/** Vrai si le texte ne contient aucun chiffre, hors heures de la journée type (« 9 h », « 12h30 »). */
export function sansChiffresHorsHeures(texte: string): boolean {
  return !/\d/.test(texte.replace(HEURES, ""));
}
