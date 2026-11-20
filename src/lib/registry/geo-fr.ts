// Fiche de la commune (geo.api.gouv.fr) : nom officiel, code commune, département, population.

import type { PiecesDuGreffe } from "../schemas";

export type Commune = NonNullable<PiecesDuGreffe["commune"]>;
type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => v !== null && typeof v === "object" && !Array.isArray(v);

/** La première commune d'une réponse de geo.api.gouv.fr, ou null. La source est l'URL de la fiche, vérifiée par construction. */
export function normaliserCommune(brut: unknown): Commune | null {
  const c = Array.isArray(brut) ? brut[0] : undefined;
  if (!estObjet(c) || typeof c.nom !== "string" || typeof c.code !== "string") return null;
  const dep = estObjet(c.departement) && typeof c.departement.nom === "string" ? c.departement.nom : typeof c.codeDepartement === "string" ? c.codeDepartement : "";
  return {
    nom: c.nom,
    code_commune: c.code,
    departement: dep,
    population: typeof c.population === "number" ? c.population : null,
    source_url: `https://geo.api.gouv.fr/communes/${c.code}`,
  };
}
