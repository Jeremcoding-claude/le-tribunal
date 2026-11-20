// Les personnages fixes de la salle : prénom, rôle, id. SANS AUCUN IMPORT, pour que schemas.ts puisse l'utiliser
// sans cycle. `agents.config.ts` relit ce fichier : c'est ainsi la source unique des prénoms (plan v3.0, §3.0).
// Ni accessoire, ni couleur, ni décor ici : ils vivent dans src/components/salle/personnages.ts (§12.4).

export const SALLE = {
  JUG: { prenom: "Nadia", agent: "juge", role: "le Juge, qui préside et ne vote pas" },
  INV: { prenom: "Victor", agent: "investisseur", role: "l'Investisseur" },
  CPT: { prenom: "Léa", agent: "comptable", role: "la Comptable" },
  JUR: { prenom: "Claire", agent: "juriste", role: "la Juriste" },
  CON: { prenom: "Marco", agent: "concurrent", role: "le Concurrent" },
} as const;

export type CodeSalle = keyof typeof SALLE;

export const PRENOMS_AGENTS = {
  JUG: SALLE.JUG.prenom,
  INV: SALLE.INV.prenom,
  CPT: SALLE.CPT.prenom,
  JUR: SALLE.JUR.prenom,
  CON: SALLE.CON.prenom,
} as const;

/** Texte injecté à la place de <!-- PRENOMS --> dans les prompts système. Identique d'un procès à l'autre. */
export function texteSalle(initialesInterdites: readonly string[]): string {
  const lignes = (Object.keys(SALLE) as CodeSalle[]).map((c) => `- ${SALLE[c].prenom}, ${SALLE[c].role}`);
  return [
    "Les prénoms de la salle servent à tes phrases libres. Dans `vise`, `appuis` et `cite`, n'écris que",
    "des identifiants : un prénom n'est jamais une preuve.",
    ...lignes,
    `- La Cliente : un prénom fictif, donné dans le message MISSION (ni l'un de ces prénoms, ni une initiale ${initialesInterdites.join(", ")}).`,
  ].join("\n");
}
