<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 11.8 Ce qui est vérifié, ce qui ne l'est pas

**Vérifié (exécuté, le 20/11/2026)**
- Une mini-appli Next.js 16 en `output: "standalone"`, copiée comme dans l'image : écriture et lecture SQLite (`better-sqlite3`) dans un dossier de données séparé, lecture de `prompts/` et `fixtures/`, PDF (`@react-pdf/renderer`), flux SSE reçu paquet par paquet toutes les 0,7 s.
- `docker compose config` accepte le compose. 143 tests verts, TypeScript strict propre, 24 modifications volontaires des fichiers Docker et de `env.ts` toutes détectées par les tests.

**Non vérifié**
- `docker build` et le démarrage du conteneur : Docker Hub est inaccessible depuis l'environnement où j'ai travaillé. Droits du volume, `HEALTHCHECK` et couche `drizzle/` restent à confirmer.
- Le passage par Caddy ou nginx (les deux fichiers d'exemple n'ont pas été testés).
- Le vrai `next build` du dépôt (cette mini-appli n'est pas Le Tribunal).

**Premier réflexe sur votre machine** : lancer les 5 commandes du §11.6. Si `docker compose ps` n'affiche pas « healthy » au bout d'une minute, `docker compose logs` dit pourquoi.

**Ajouts à faire dans l'appli (étape 12, partie Déploiement ; HYPOTHÈSE)** : la route `/api/health` (renvoie `{ ok: true }` si la base répond), la page de saisie du jeton d'accès quand `MOCK_MODE=false`, l'appel à `lireEnv()` au démarrage, l'application des migrations Drizzle au démarrage.

---
