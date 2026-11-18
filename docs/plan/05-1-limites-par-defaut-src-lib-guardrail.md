<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 5. Les garde-fous

Principe : **chaque garde-fou est appliqué par le code**, et **chaque garde-fou a un test piégé** dans `tests/guardrails/`. Un test piégé fournit une entrée « tricheuse » (fixture MOCK) et vérifie que le code la bloque.

### 5.1 Limites par défaut (`src/lib/guardrails/config.ts`)

```ts
export const GUARDRAILS = {
  mock: process.env.MOCK_MODE !== "false",          // true par défaut
  models: { greffier: "claude-sonnet-5-5", jure: "claude-sonnet-5-5", juge: "claude-opus-5-5",
            miseEnForme: "claude-sonnet-5-5" },   // 2ᵉ appel du mode API ; Haiku 5.5 en mode rapide
  rejets: { alerteParRegle: 0.2 },   // smoke : alerte si une règle rejette plus de 20 % des éléments
  search: {
    greffier:    { maxSearches: 3, maxFetches: 2 },
    greffierComplement: { maxSearches: 2, maxFetches: 1 },   // après choix d'un homonyme
    instruction: { maxSearches: 5, maxFetches: 3 },
    debat:       { maxSearches: 1, maxFetches: 1 },
    revote:      { maxSearches: 0, maxFetches: 0 },
    fetchMaxContentTokens: 8000,
    juristeDomains: { FR: ["legifrance.gouv.fr", "cnil.fr", "eur-lex.europa.eu",
      "service-public.fr", "economie.gouv.fr", "entreprendre.service-public.fr"] },
  },
  tokens: { greffier: 1500, jure: 4000, comptableLecture: 1500, debat: 1500, juge: 6000, revote: 800 },
  timeouts: { agentMs: 180_000, phaseMs: 420_000, verifierFetchMs: 8_000 },
  concurrency: 5,
  retries: { max: 2, baseDelayMs: 2_000 },          // 429, 529, 5xx
  budget: { maxUsdPerTrial: 6.0, warnUsdPerTrial: 3.5 },   // scénario haut ≈ 4,95 $ (section 10)
  input: { maxChars: 500, minParts: 4,
           zonesSansVille: ["en ligne", "France entière"],
           marqueursCible: ["à ", "aux ", "pour ", "auprès de "],
           marqueursProbleme: ["car ", "parce que ", "problème :"] },
  questions: { max: 2, autorisees: ["prix_absent", "homonymes"], relancesSiIllisible: 1 },
  registry: { fr: { maxCorrespondances: 5, timeoutMs: 6_000, cacheHeures: 24 },
              champsSupprimes: ["dirigeants", "elus", "adresse_personne", "telephone", "email"] },
  tally: { quorum: 4, goMin: 6.5, nogoBelow: 4.0, divise: 2.5,
           coherence: { GO: [6, 10], PIVOT: [3, 7.5], "NO-GO": [0, 4.5] } },
  numbers: { tolerancePct: 1 },
};
```
