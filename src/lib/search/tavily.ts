// Adaptateur Tavily (plan v3.0, §1) : recherche par HTTP, contenu passé par sanitize.ts (G5).
// Doc lue le 20/11/2026 (docs.tavily.com) : POST https://api.tavily.com/search, en-tête `Authorization: Bearer <clé>`,
// corps { query, search_depth, max_results, include_domains }, réponse { results: [{ title, url, content, score }] } ;
// 1 crédit (basic) ou 2 (advanced) par recherche ; erreurs 401, 429, 432, 433…
// La clé n'est jamais écrite dans un message d'erreur (G8).

import { GUARDRAILS } from "../guardrails/config";
import { entourerDonneesWeb, nettoyerContenuWeb } from "../guardrails/sanitize";
import { LlmError } from "../llm/types";
import { lirePageHttp, type FetchLike } from "./lecture";
import type { ResultatRecherche, SearchProvider } from "./types";

export const URL_TAVILY = "https://api.tavily.com/search";

export interface TavilyOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
  profondeur?: "basic" | "advanced";
}

interface ReponseTavily {
  results?: { title?: string; url?: string; content?: string }[];
}

export function creerTavily(opts: TavilyOptions): SearchProvider {
  if (!opts.apiKey) throw new LlmError("Tavily : clé API manquante.");
  const fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
  return {
    nom: "tavily",
    async rechercher(requete, o = {}) {
      const corps = {
        query: requete,
        search_depth: opts.profondeur ?? "basic",
        max_results: o.maxResults ?? 5,
        ...(o.domaines && o.domaines.length > 0 && { include_domains: o.domaines }),
      };
      const res = await fetchImpl(URL_TAVILY, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(GUARDRAILS.timeouts.agentMs),
      });
      if (!res.ok) throw new LlmError(`Tavily : HTTP ${res.status}${res.status === 429 ? " (trop de requêtes)" : ""}.`);
      const json = (await res.json()) as ReponseTavily;
      return (json.results ?? []).flatMap((r): ResultatRecherche[] => {
        if (!r.url) return [];
        const { texte, alertes } = nettoyerContenuWeb(r.content ?? "");
        return [{ titre: r.title ?? r.url, url: r.url, contenu: entourerDonneesWeb(texte, r.url), alertes }];
      });
    },
    lire: (url) => lirePageHttp(url, fetchImpl),
  };
}
