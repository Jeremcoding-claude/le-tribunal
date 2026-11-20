// Relecture d'une page par le code (mode Tavily et mode abonnement : verifyByFetch, étape 5).
// 8 s au plus (config.ts) ; le HTML est retiré et le texte passe par sanitize.ts.

import { GUARDRAILS } from "../guardrails/config";
import { nettoyerContenuWeb } from "../guardrails/sanitize";
import { LlmError } from "../llm/types";
import type { PageLue } from "./types";

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;

export async function lirePageHttp(url: string, fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<PageLue> {
  if (!/^https?:\/\//i.test(url)) throw new LlmError(`Lecture refusée : seule une adresse http(s) peut être relue (« ${url.slice(0, 60)} »).`);
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(GUARDRAILS.timeouts.verifierFetchMs) });
  if (!res.ok) throw new LlmError(`Lecture de ${url} : HTTP ${res.status}.`);
  const { texte, alertes } = nettoyerContenuWeb(await res.text());
  return { url, texte, alertes };
}
