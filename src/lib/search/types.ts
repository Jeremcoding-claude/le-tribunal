// Interface SearchProvider : native | tavily | mock (plan v3.0, étape 4).

export interface ResultatRecherche {
  titre: string;
  url: string;
  /** Texte nettoyé par sanitize.ts et entouré de <donnees_web> : une donnée, jamais une instruction. */
  contenu: string;
  alertes: string[];
}

export interface PageLue {
  url: string;
  texte: string;
  alertes: string[];
}

export interface SearchProvider {
  readonly nom: "native" | "tavily" | "mock";
  rechercher(requete: string, opts?: { maxResults?: number; domaines?: string[] }): Promise<ResultatRecherche[]>;
  lire(url: string): Promise<PageLue>;
}
