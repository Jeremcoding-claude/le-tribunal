# Journal de construction

Relais entre sessions : 5 lignes à la fin de chaque étape, les plus récentes en bas.
Un hook (SessionStart) en remet la fin dans le contexte au démarrage.

Format d'une entrée :

    ### Étape N — AAAA-MM-JJ
    - Fait :
    - Décisions :
    - // HYPOTHÈSE: ouvertes :
    - Tests :
    - Suivant :

## Entrées

### Étape 1 — 2026-11-20
- Fait : squelette Next.js 16.4.6 (App Router, TS strict, Tailwind 4, shadcn/ui base-nova), dépendances du plan (zod 4, SDK Anthropic, drizzle, better-sqlite3, react-pdf, p-limit, vitest, tsx, tsup, drizzle-kit), arborescence vide de §2.2 (.gitkeep), CLAUDE.md (§7 v3.0), `config.ts` (§5.1, tally v1 : 6 / 4,5 / 1,5 / 0,5), scripts npm, `.env.example`, LICENSE MIT, `.gitignore` (+ `.run/`, `.tribunal/`, `*.db`, `!.env.example` ; `plugin/bin/` non ignoré).
- Décisions : `@types/node` ^22 (vitest 5 l'exige) et `engines` node ≥ 22 ; `vitest.config.mts` ; `typecheck` = `next typegen && tsc --noEmit` (le type global `LayoutProps` vient de `next typegen`) ; `AGENTS.md` de create-next-app non repris ; `next.config.ts` garde `cacheComponents` et `partialPrefetching` activés par create-next-app ; grep `sk-ant` : seules les pages de `docs/` (texte des garde-fous G8 et §11.7) le contiennent, aucun code.
- // HYPOTHÈSE: ouvertes : `config.ts` lit `process.env.MOCK_MODE` jusqu'à l'étape 12 (alors `src/lib/env.ts`) ; `cacheComponents` peut gêner le flux SSE (étape 10) et `output: "standalone"` (étape 12) : à tester, sinon le désactiver ; `better-sqlite3` 13.2 se charge sur Node 24/Windows mais npm signale ses scripts d'installation non approuvés (`allowScripts`) : à surveiller en CI.
- Tests : `npm test` 4/4 verts (MOCK_MODE : défaut, true, false ; seuils du tally) ; `npm run typecheck` propre ; `npm run lint` 0 erreur (1 avertissement : `existsSync` inutilisé dans `scripts/run-etapes.mjs`, fichier du kit non touché) ; `npm run build` OK.
- Suivant : étape 2 (schémas Zod et fixtures du cas de référence), avec `Proposition`, la règle du prénom de la Cliente (§3.0) et les valeurs du plan v3.0.
