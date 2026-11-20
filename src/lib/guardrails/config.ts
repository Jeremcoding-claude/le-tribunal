// TOUTES les limites du Tribunal vivent ici (plan v3.0, section 5.1).
// Un seuil ou une limite ne s'écrit nulle part ailleurs : on change cette valeur, le plan et les tests ensemble.
//
// // HYPOTHÈSE: `mock` lit process.env ici jusqu'à l'étape 12. À partir de l'étape 12, src/lib/env.ts
// (validation Zod) est le seul endroit qui lit process.env, et ce fichier l'importe.

export const GUARDRAILS = {
  mock: process.env.MOCK_MODE !== "false", // true par défaut : zéro appel payant
  models: {
    greffier: "claude-sonnet-5-5",
    jure: "claude-sonnet-5-5",
    juge: "claude-opus-5-5",
    miseEnForme: "claude-sonnet-5-5", // 2ᵉ appel du mode API ; Haiku 5.5 en mode rapide
  },
  rejets: { alerteParRegle: 0.2 }, // smoke : alerte si une règle rejette plus de 20 % des éléments
  search: {
    greffier: { maxSearches: 3, maxFetches: 2 },
    greffierComplement: { maxSearches: 2, maxFetches: 1 }, // après choix d'un homonyme
    instruction: { maxSearches: 5, maxFetches: 3 },
    debat: { maxSearches: 1, maxFetches: 1 },
    revote: { maxSearches: 0, maxFetches: 0 },
    fetchMaxContentTokens: 8000,
    juristeDomains: {
      FR: [
        "legifrance.gouv.fr",
        "cnil.fr",
        "eur-lex.europa.eu",
        "service-public.fr",
        "economie.gouv.fr",
        "entreprendre.service-public.fr",
      ],
    },
  },
  tokens: { greffier: 1500, jure: 4000, comptableLecture: 1500, debat: 1500, juge: 6000, revote: 800 },
  timeouts: { agentMs: 180_000, phaseMs: 420_000, verifierFetchMs: 8_000 },
  concurrency: 5,
  retries: { max: 2, baseDelayMs: 2_000 }, // 429, 529, 5xx
  budget: { maxUsdPerTrial: 6.0, warnUsdPerTrial: 3.5 }, // scénario haut ≈ 4,95 $ (section 10)
  input: {
    maxChars: 500,
    minParts: 4,
    zonesSansVille: ["en ligne", "France entière"],
    marqueursCible: ["à ", "aux ", "pour ", "auprès de "],
    marqueursProbleme: ["car ", "parce que ", "problème :"],
  },
  questions: { max: 2, autorisees: ["prix_absent", "homonymes"], relancesSiIllisible: 1 },
  registry: {
    fr: { maxCorrespondances: 5, timeoutMs: 6_000, cacheHeures: 24 },
    champsSupprimes: ["dirigeants", "elus", "adresse_personne", "telephone", "email"],
  },
  // Règle de verdict v1 (v3.0, section 4.2) : GO si la moyenne ≥ goMin, NO-GO si ≤ nogoMax, PIVOT sinon ;
  // « jury divisé » si l'écart-type ≥ divise ; « consensus suspect » s'il est ≤ consensusSuspect.
  tally: {
    quorum: 4,
    goMin: 6,
    nogoMax: 4.5,
    divise: 1.5,
    consensusSuspect: 0.5,
    coherence: { GO: [6, 10], PIVOT: [3, 7.5], "NO-GO": [0, 4.5] },
  },
  // // HYPOTHÈSE: objectif de rémunération mensuelle du fondateur pour la ligne L11 (ref « CONFIG » du Comptable).
  ledger: { objectifRemunerationMensuelle: 2500 },
  numbers: { tolerancePct: 1 },
} as const;

export type Guardrails = typeof GUARDRAILS;

/** La clé API est-elle définie ? (jamais sa valeur : le SDK la lit lui-même). Étape 12 : déplacé dans src/lib/env.ts. */
export const cleAnthropicPresente = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

/** Dossier des données (base SQLite, fichiers). Étape 12 : déplacé dans src/lib/env.ts (DATA_DIR). */
export const dossierDonnees = (): string => process.env.DATA_DIR ?? "./data";
