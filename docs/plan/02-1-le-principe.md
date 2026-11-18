<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 2. L'architecture : un moteur, deux portes d'entrée

### 2.1 Le principe

1. **Les personnages sont écrits une seule fois**, dans `prompts/*.md` (texte) et `prompts/agents.config.ts` (modèle, outils, limites).
2. **Le moteur** (`src/lib/`) est du TypeScript pur, sans dépendance à Next.js. Il contient les schémas, les phases, les calculs, le vérificateur, les garde-fous et le PDF.
3. **Deux portes d'entrée** utilisent ce moteur :
   - le **CLI** `tribunal` (empaqueté dans le plugin) ;
   - l'**appli web** Next.js (routes `/api/...`).
4. Un script `scripts/build-plugin.ts` **génère** les fichiers du plugin à partir de `prompts/` : sous-agents `plugin/agents/*.md` et CLI empaqueté `plugin/bin/tribunal.mjs`. On ne modifie jamais ces fichiers générés à la main. Ils sont **commités** (le marketplace installe le plugin depuis Git) et un test vérifie qu'ils sont à jour.
