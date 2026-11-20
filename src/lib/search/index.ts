import { LlmError } from "../llm/types";
import { fournisseurNatif } from "./native";
import { creerRechercheMock } from "./mock";
import { creerTavily, type TavilyOptions } from "./tavily";
import type { SearchProvider } from "./types";

export type NomFournisseur = "native" | "tavily" | "mock";

/** Choisit l'adaptateur. La clé Tavily est passée par l'appelant : ce module ne lit pas l'environnement. */
export function choisirFournisseur(nom: NomFournisseur, opts: { tavily?: TavilyOptions; racine?: string } = {}): SearchProvider {
  switch (nom) {
    case "native":
      return fournisseurNatif;
    case "mock":
      return creerRechercheMock({ racine: opts.racine });
    case "tavily":
      if (!opts.tavily) throw new LlmError("Tavily : options (clé API) manquantes.");
      return creerTavily(opts.tavily);
    default:
      throw new LlmError(`Fournisseur de recherche inconnu : « ${String(nom)} » (native | tavily | mock).`);
  }
}

export type { SearchProvider, ResultatRecherche, PageLue } from "./types";
export { outilsNatifs } from "./native";
