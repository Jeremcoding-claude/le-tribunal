// Pièces du greffe, France : API Recherche d'entreprises et API Découpage administratif (geo.api.gouv.fr).
// Ouvertes, sans clé, gratuites. Champs vérifiés le 20/11/2026 par un appel réel : results[].{siren, nom_complet,
// activite_principale, date_creation, etat_administratif (A/C), nature_juridique, siege.libelle_commune, dirigeants},
// et pour geo : [{nom, code, codeDepartement, departement.nom, population}]. Limite de débit annoncée : 7 appels par seconde.
// // HYPOTHÈSE: la recherche se fait par nom (q) ; le filtre par commune est fait côté code (le paramètre exact de filtre
// par commune de l'API n'est pas confirmé dans la doc lue).

import { GUARDRAILS } from "../guardrails/config";
import type { FetchLike } from "../search/lecture";

/** Les deux sources brutes. Le vrai adaptateur appelle les API ; l'adaptateur MOCK lit une fixture. */
export interface SourcesRegistre {
  /** Réponse brute de l'API Recherche d'entreprises (objet avec `results`). */
  registre(nom: string): Promise<unknown>;
  /** Réponse brute de geo.api.gouv.fr (tableau de communes). */
  commune(nom: string): Promise<unknown>;
}

export const URL_REGISTRE = "https://recherche-entreprises.api.gouv.fr/search";
export const URL_COMMUNE = "https://geo.api.gouv.fr/communes";

export function creerSourcesReelles(fetchImpl: FetchLike = (u, i) => fetch(u, i)): SourcesRegistre {
  const lire = async (url: string): Promise<unknown> => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(GUARDRAILS.registry.fr.timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  return {
    registre: (nom) => lire(`${URL_REGISTRE}?q=${encodeURIComponent(nom)}&per_page=10`),
    commune: (nom) =>
      lire(`${URL_COMMUNE}?nom=${encodeURIComponent(nom)}&fields=nom,code,codeDepartement,departement,population&boost=population&limit=1`),
  };
}
