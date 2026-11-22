# Contribuer au Tribunal

Merci. Les règles complètes sont dans `CLAUDE.md` ; le plan de référence est `docs/PLAN.md` (les fichiers de `docs/plan/` en sont générés par `node scripts/split-plan.mjs` : ne les modifiez pas à la main).

## Règles
- Une étape (ou un changement) à la fois ; **tests verts avant tout commit** : `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- `MOCK_MODE=true` par défaut. Les tests ne touchent jamais le réseau et la CI n'a aucune clé.
- Aucune clé API nulle part : ni client, ni journaux, ni événements, ni `.tribunal/`, ni PDF.
- Un garde-fou ajouté = un test piégé dans `tests/guardrails/` qui échoue si on le retire.
- Toutes les limites vivent dans `src/lib/guardrails/config.ts` ; `process.env` n'est lu que dans `src/lib/env.ts`.
- Le verdict est calculé par le code (`tally.ts`), jamais par un modèle. Aucun chiffre sans source.
- Si vous changez un prompt, un agent ou un schéma : `npm run build:plugin` puis commitez les fichiers générés.

## Proposer un changement
1. Ouvrez une issue qui décrit le besoin. 2. Faites une branche. 3. Un commit clair, tests inclus. 4. Pull request.
