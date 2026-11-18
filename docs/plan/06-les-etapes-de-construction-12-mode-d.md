<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 6. Les étapes de construction (12)

Mode d'emploi : ouvrez Claude Code dans le dossier du projet, collez le prompt de l'étape, puis vérifiez le critère de validation. **Un commit par étape, tests verts avant commit.** Les étapes 1 à 9 livrent le plugin ; les étapes 10 à 12 livrent l'appli web et la publication. Chaque étape se lance dans une **session neuve** (`/clear`, ou `node scripts/run-etapes.mjs <étape>`) : voir `docs/PROCESSUS.md`.

**Étape 0** (avant l'étape 1) : copiez ce plan dans `docs/PLAN.md`, « Prompts système v3 (allégés) » dans `docs/prompts-v3.md`, puis le kit de processus (`scripts/`, `.claude/settings.json`, `docs/JOURNAL.md`, `docs/PROCESSUS.md`) et lancez `node scripts/split-plan.mjs`. **Ne lisez jamais `docs/PLAN.md` en entier** : chaque étape a son fichier `docs/plan/etape-NN.md` avec la liste « À lire ». Les prompts ci-dessous citent encore `docs/PLAN.md` : le script remplace ces mentions dans les fichiers générés.

---
