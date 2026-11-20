<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 12.7 Étape « Interface » (= étape 11 de ce plan, avant le déploiement de l'étape 12)

- Pages : accueil, `audience/[id]` (la salle, en direct ou en rejeu), `audiences` (la liste), `demo`.
- Composants : `src/components/salle/` (scène 3D, repli 2D, personnages, état) et `src/components/audience/` (journal, bulles et sources, enveloppes scellées, plan corrigé, verdict).
- Tests : `tests/unit/salle-etat.test.ts` (événements du procès MOCK → état attendu) et `tests/guardrails/vote-scelle-affichage.test.ts`.
- Un commit pour cette étape, tests verts avant.
