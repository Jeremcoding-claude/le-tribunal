<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/02-2-arborescence.md`
- `docs/plan/05-1-limites-par-defaut-src-lib-guardrail.md`
- `docs/plan/07-le-fichier-claude-md-du-projet.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 1 — Initialiser le dépôt

**Objectif :** un squelette propre, testable, sans aucun appel payant.

```text
Lis les fichiers de docs/plan/ listés dans « À lire » puis crée CLAUDE.md avec le contenu exact de la section 7 du plan.

Initialise le projet dans le dossier courant :
1. Next.js (App Router, TypeScript strict, Tailwind, ESLint, dossier src/), avec npm.
2. Dépendances : zod (version 4, requise par z.toJSONSchema), @anthropic-ai/sdk, drizzle-orm, better-sqlite3, @react-pdf/renderer, p-limit (limite de concurrence).
   Dev : vitest, tsx, tsup, drizzle-kit, @types/better-sqlite3.
   Initialise shadcn/ui (vérifie la commande dans la doc officielle).
3. Crée l'arborescence vide de la section 2.2 (prompts/, plugin/, src/lib/..., src/cli/, scripts/, fixtures/restaurants/, tests/{unit,guardrails,e2e}).
4. Crée src/lib/guardrails/config.ts avec exactement les valeurs de la section 5.1.
5. Scripts npm : dev, build, test, lint, typecheck, smoke (affiche "à venir"), build:plugin (affiche "à venir"), trial (tsx src/cli/tribunal.ts).
6. .env.example : ANTHROPIC_API_KEY=, MOCK_MODE=true, SEARCH_PROVIDER=native (native | tavily) et TAVILY_API_KEY= (facultative).
   .gitignore : .env*, .tribunal/, .run/, *.db. NE PAS ignorer plugin/bin/ : le marketplace installe le plugin depuis Git,
   le fichier généré plugin/bin/tribunal.mjs doit être commité.
7. LICENSE : MIT.
8. Un test Vitest qui vérifie que GUARDRAILS.mock vaut true quand MOCK_MODE n'est pas défini.

N'appelle aucune API. Termine en affichant l'arbre des dossiers et la sortie de npm test.
```

**Critère de validation :** `npm test`, `npm run typecheck` et `npm run lint` passent. `grep -r "sk-ant" .` ne trouve rien.

---
