// Recherche « native » : les outils serveur web_search et web_fetch de l'API Claude (plan v3.0, §1 et §5.1).
// Ils s'exécutent chez Anthropic : on ne fait que les déclarer, avec leurs limites (max_uses) à chaque appel.
//
// // HYPOTHÈSE: types d'outils pris dans la doc du 20/11/2026 et dans le SDK 1.12 : web_search_20250305 (version de base) et
// web_fetch_20250910. Une version plus récente existe (…20260209, …20260318) : à confirmer au premier smoke test (étape 12).
// L'outil web_search n'a pas de champ `citations` (toujours activées) ni de `max_content_tokens` ; web_fetch les a.

import { AGENTS, BUDGET_PAR_PHASE, type AgentId, type Phase } from "../../../prompts/agents.config";
import { GUARDRAILS } from "../guardrails/config";
import { LlmError } from "../llm/types";
import type { PageLue, ResultatRecherche, SearchProvider } from "./types";

export const TYPE_WEB_SEARCH = "web_search_20250305";
export const TYPE_WEB_FETCH = "web_fetch_20250910";

export interface OutilWebSearch {
  type: typeof TYPE_WEB_SEARCH;
  name: "web_search";
  max_uses: number;
  allowed_domains?: string[];
}
export interface OutilWebFetch {
  type: typeof TYPE_WEB_FETCH;
  name: "web_fetch";
  max_uses: number;
  max_content_tokens: number;
  citations: { enabled: true };
  allowed_domains?: string[];
}
export type OutilNatif = OutilWebSearch | OutilWebFetch;

/** Les outils web d'un agent dans une phase. Vide si l'agent n'a pas d'outil ou si le budget est nul. */
export function outilsNatifs(agent: AgentId, phase: Phase, pays = "FR"): OutilNatif[] {
  const def = AGENTS[agent];
  if (def.outilsApi.length === 0) return [];
  const budget = BUDGET_PAR_PHASE[phase];

  let domaines: string[] | undefined;
  if ("domaines" in def) {
    // Le Juriste ne cherche que sur des domaines officiels (G1). Sans liste pour le pays : on refuse, on ne devine pas.
    const liste = (def.domaines as Record<string, readonly string[]>)[pays];
    if (!liste) throw new LlmError(`Aucune liste de domaines officiels pour le pays « ${pays} » (config.ts, search.juristeDomains).`);
    domaines = [...liste];
  }

  const outils: OutilNatif[] = [];
  if (budget.maxSearches > 0) {
    outils.push({ type: TYPE_WEB_SEARCH, name: "web_search", max_uses: budget.maxSearches, ...(domaines && { allowed_domains: domaines }) });
  }
  if (budget.maxFetches > 0) {
    outils.push({
      type: TYPE_WEB_FETCH,
      name: "web_fetch",
      max_uses: budget.maxFetches,
      max_content_tokens: GUARDRAILS.search.fetchMaxContentTokens,
      citations: { enabled: true },
      ...(domaines && { allowed_domains: domaines }),
    });
  }
  return outils;
}

/** Fournisseur « native » : il n'y a rien à appeler côté client, la recherche se fait pendant l'appel au modèle. */
export const fournisseurNatif: SearchProvider = {
  nom: "native",
  async rechercher(): Promise<ResultatRecherche[]> {
    throw new LlmError("Recherche native : l'outil web_search s'exécute côté API, pendant l'appel au modèle.");
  },
  async lire(): Promise<PageLue> {
    throw new LlmError("Recherche native : pour relire une page, utiliser lirePageHttp (verifyByFetch).");
  },
};
