<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 12.4 Règles de l'interface

1. **La 3D est décorative.** Tout ce que la scène montre existe aussi en texte dans le journal d'audience : lecteur d'écran, clavier et mobile fonctionnent sans la scène.
2. **Repli sans 3D** (HYPOTHÈSE) : sans WebGL, avec `prefers-reduced-motion`, ou sur un appareil faible, on affiche une scène 2D fixe et le même panneau.
3. **Aucun accessoire, couleur ni décor dans un prompt.** Accessoires et couleurs vivent dans `src/components/salle/personnages.ts`. Les prénoms des 5 agents fixes viennent de `agents.config.ts` ; celui de la Cliente vient des événements du procès.
4. **Vote 1 scellé à l'écran** (HYPOTHÈSE). Jusqu'à l'événement `vote1_ouvert` (début de P4), le flux d'événements, en direct comme en rejeu, ne contient que « a voté », jamais la note. Test piégé : `tests/guardrails/vote-scelle-affichage.test.ts`.
5. **Rien de tiers au chargement** : ni police, ni texture, ni script d'un domaine externe. Tout est servi par le conteneur.
6. **Jeton d'accès** (HYPOTHÈSE) : saisi une fois, gardé dans un cookie `HttpOnly`, jamais dans l'adresse ni dans un log.
7. **Textes en français, tutoiement**, mots courts (« Juger mon idée », « Mes audiences »).
