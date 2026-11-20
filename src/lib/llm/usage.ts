// Tokens, recherches et coût en dollars de chaque appel (plan v3.0, G6 ; section 10.1).
// Constantes DATÉES : tarifs vérifiés le 16/11/2026 [S1]. À remettre à jour avec la mesure de l'étape 12.
// L'application du plafond (avertissement, arrêt propre) est dans budget.ts (étape 7) ; ici, on additionne.

export const TARIFS_DATES = "2026-11-16";

/** Dollars par million de tokens. */
export const TARIFS: Record<string, { entree: number; sortie: number }> = {
  "claude-sonnet-5-5": { entree: 2, sortie: 10 },
  "claude-opus-5-5": { entree: 4, sortie: 20 },
  "claude-haiku-5-5": { entree: 0.1, sortie: 0.5 },
};
/** Lecture du cache : 0,05 × le prix d'entrée (§10.1). */
export const FACTEUR_CACHE_LECTURE = 0.05;
// // HYPOTHÈSE: l'écriture du cache coûte 1,25 × le prix d'entrée (cache de 5 minutes) : valeur non listée au §10.1.
export const FACTEUR_CACHE_ECRITURE = 1.25;
/** 10 $ pour 1 000 recherches. Web fetch : gratuit, hors tokens du contenu. */
export const PRIX_RECHERCHE_USD = 0.01;

export interface Usage {
  entree: number;
  sortie: number;
  cacheLecture: number;
  cacheEcriture: number;
  recherches: number;
  lectures: number;
}

export const usageVide = (): Usage => ({ entree: 0, sortie: 0, cacheLecture: 0, cacheEcriture: 0, recherches: 0, lectures: 0 });

export function additionner(a: Usage, b: Usage): Usage {
  return {
    entree: a.entree + b.entree,
    sortie: a.sortie + b.sortie,
    cacheLecture: a.cacheLecture + b.cacheLecture,
    cacheEcriture: a.cacheEcriture + b.cacheEcriture,
    recherches: a.recherches + b.recherches,
    lectures: a.lectures + b.lectures,
  };
}

/** Le champ `usage` d'une réponse de l'API (noms vérifiés dans la doc, 20/11/2026). */
export interface UsageApi {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null; web_fetch_requests?: number | null } | null;
}

export function usageDepuisReponse(u: UsageApi | null | undefined): Usage {
  return {
    entree: u?.input_tokens ?? 0,
    sortie: u?.output_tokens ?? 0,
    cacheLecture: u?.cache_read_input_tokens ?? 0,
    cacheEcriture: u?.cache_creation_input_tokens ?? 0,
    recherches: u?.server_tool_use?.web_search_requests ?? 0,
    lectures: u?.server_tool_use?.web_fetch_requests ?? 0,
  };
}

export class ModeleInconnu extends Error {}

/** Coût en dollars, arrondi au millionième. Un modèle sans tarif est une erreur : jamais un coût à 0 en silence. */
export function coutUsd(usage: Usage, modele: string): number {
  const t = TARIFS[modele];
  if (!t) throw new ModeleInconnu(`Pas de tarif pour le modèle « ${modele} » (voir usage.ts, tarifs du ${TARIFS_DATES}).`);
  const m = 1e6;
  const usd =
    (usage.entree * t.entree) / m +
    (usage.cacheLecture * t.entree * FACTEUR_CACHE_LECTURE) / m +
    (usage.cacheEcriture * t.entree * FACTEUR_CACHE_ECRITURE) / m +
    (usage.sortie * t.sortie) / m +
    usage.recherches * PRIX_RECHERCHE_USD;
  return Math.round(usd * 1e6) / 1e6;
}

export interface LigneUsage {
  agent: string;
  phase: string;
  modele: string;
  usage: Usage;
  coutUsd: number;
}

/** Additionne les usages de tout un procès, par agent et par phase (affichage en direct, npm run cost). */
export class SuiviUsage {
  readonly lignes: LigneUsage[] = [];

  ajouter(agent: string, phase: string, modele: string, usage: Usage): LigneUsage {
    const ligne = { agent, phase, modele, usage, coutUsd: coutUsd(usage, modele) };
    this.lignes.push(ligne);
    return ligne;
  }

  total(): { usage: Usage; coutUsd: number } {
    const usage = this.lignes.reduce((s, l) => additionner(s, l.usage), usageVide());
    return { usage, coutUsd: Math.round(this.lignes.reduce((s, l) => s + l.coutUsd, 0) * 1e6) / 1e6 };
  }

  parPhase(): Record<string, number> {
    const r: Record<string, number> = {};
    for (const l of this.lignes) r[l.phase] = Math.round(((r[l.phase] ?? 0) + l.coutUsd) * 1e6) / 1e6;
    return r;
  }
}
