// Pièces du greffe (P0, code, gratuit, sans LLM) : le registre des entreprises et la fiche de la commune,
// nettoyés de toute donnée personnelle (G9), mises en cache 24 h. Panne ou limite de débit : `indisponible`,
// le procès continue et le Greffier cherche sur le web. Hors France : `non_applicable`.

import { GUARDRAILS } from "../guardrails/config";
import { PiecesDuGreffe, type Saisie } from "../schemas";
import { CacheTtl } from "./cache";
import type { SourcesRegistre } from "./fr";
import { normaliserCommune } from "./geo-fr";
import { memeCommune, normaliserCorrespondance, normaliserLieu, supprimerChampsPersonnels, type Correspondance } from "./nettoyage";

export { creerSourcesReelles, type SourcesRegistre } from "./fr";
export { creerSourcesMock } from "./mock";
export { CacheTtl } from "./cache";

const INDISPONIBLE: PiecesDuGreffe = { statut: "indisponible", correspondances: [], commune: null };

export const creerCachePieces = (maintenant?: () => number) =>
  new CacheTtl<PiecesDuGreffe>(GUARDRAILS.registry.fr.cacheHeures * 3_600_000, maintenant);

export async function piecesDuGreffe(saisie: Saisie, sources: SourcesRegistre, opts: { cache?: CacheTtl<PiecesDuGreffe> } = {}): Promise<PiecesDuGreffe> {
  if (saisie.pays !== "FR") return { statut: "non_applicable", correspondances: [], commune: null };

  const sansVille = GUARDRAILS.input.zonesSansVille.some((z) => normaliserLieu(z) === normaliserLieu(saisie.ville));
  const cle = `${normaliserLieu(saisie.nom)}|${normaliserLieu(saisie.ville)}`;
  const deja = opts.cache?.get(cle);
  if (deja) return deja;

  try {
    const [rawRegistre, rawCommune] = await Promise.all([sources.registre(saisie.nom), sansVille ? Promise.resolve(null) : sources.commune(saisie.ville)]);
    const registre = supprimerChampsPersonnels(rawRegistre) as { results?: unknown[] } | null;

    const correspondances = (registre?.results ?? [])
      .map(normaliserCorrespondance)
      .filter((c): c is Correspondance => c !== null)
      .filter((c) => sansVille || memeCommune(c.commune, saisie.ville))
      .slice(0, GUARDRAILS.registry.fr.maxCorrespondances);

    const pieces = PiecesDuGreffe.parse({ statut: "ok", correspondances, commune: sansVille ? null : normaliserCommune(rawCommune) });
    opts.cache?.set(cle, pieces);
    return pieces;
  } catch {
    // Panne, délai dépassé, limite de débit, réponse illisible : ni erreur ni donnée inventée.
    return INDISPONIBLE;
  }
}
