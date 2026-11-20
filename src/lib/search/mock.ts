// Recherche MOCK : lit les pages de fixtures/<cas>/pages/ (aucun réseau). Sert aussi à verifyByFetch en test.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detecterInstructions, entourerDonneesWeb } from "../guardrails/sanitize";
import { LlmError } from "../llm/types";
import type { PageLue, ResultatRecherche, SearchProvider } from "./types";

export function creerRechercheMock(opts: { racine?: string; cas?: string } = {}): SearchProvider {
  const dossier = join(opts.racine ?? process.cwd(), "fixtures", opts.cas ?? "restaurants", "pages");
  const index = JSON.parse(readFileSync(join(dossier, "index.json"), "utf8")) as Record<string, string>;
  const texte = (url: string): string => {
    const f = index[url];
    if (!f) throw new LlmError(`Page MOCK introuvable : ${url}`);
    return readFileSync(join(dossier, f), "utf8");
  };
  return {
    nom: "mock",
    async rechercher(requete, o = {}) {
      const mots = requete.toLowerCase().split(/[^\p{L}\d]+/u).filter((m) => m.length >= 4);
      const urls = Object.keys(index).filter((u) => {
        const t = texte(u).toLowerCase();
        return mots.length === 0 || mots.some((m) => t.includes(m));
      });
      return urls.slice(0, o.maxResults ?? 5).map((url): ResultatRecherche => {
        const t = texte(url);
        return { titre: url, url, contenu: entourerDonneesWeb(t, url), alertes: detecterInstructions(t) };
      });
    },
    async lire(url): Promise<PageLue> {
      const t = texte(url);
      return { url, texte: t, alertes: detecterInstructions(t) };
    },
  };
}
