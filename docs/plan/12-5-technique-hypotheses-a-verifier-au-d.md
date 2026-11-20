<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 12.5 Technique (HYPOTHÈSES, à vérifier au début de l'étape)

- **Scène** : Three.js avec `@react-three/fiber` en version 9 et `three`. La doc officielle de React Three Fiber indique que la v9 se marie avec React 19 et la v8 avec React 18 ; Next.js 16 s'appuie sur React 19 (à confirmer dans le `package.json` du dépôt). Chargée **côté client seulement**, par import dynamique sans rendu serveur, pour ne pas alourdir l'accueil.
- **Formes** : boîtes et cylindres générés en code (robots à écran-visage), ou glTF légers dans `public/salle/`. Poids visé : moins de 5 Mo pour toute la scène.
- **Données** : la salle ne lit que les événements SSE, jamais le moteur. `src/lib/` n'importe ni Next.js ni Three.js. Le schéma des événements vit dans `schemas.ts`.
- **Logique testable sans navigateur** : `salle/etat.ts` est une fonction pure (liste d'événements → état de la salle). Elle est testée dans Vitest, sans WebGL.
- **Direct et rejeu partagent le même code** : « Voir la démo » et « Mes audiences » relisent les événements enregistrés dans SQLite avec le même affichage que le direct.
