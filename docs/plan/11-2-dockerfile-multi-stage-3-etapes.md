<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 11.2 Dockerfile multi-stage (3 étapes)

| Étape | Rôle | Ce qu'elle emporte à l'étape suivante |
|---|---|---|
| `deps` | `npm ci` : installe les dépendances (couche mise en cache tant que `package-lock.json` ne change pas) | `node_modules` |
| `build` | `npm run build` avec `output: "standalone"` | `.next/standalone`, `.next/static`, `public`, `prompts`, `fixtures`, `drizzle` |
| `runner` | Image finale : copie ces seuls dossiers, tourne en utilisateur `node` (pas root) | Rien après |

Ce que ça apporte : l'image finale n'a ni sources, ni devDependencies, ni tests, ni `.env`. Le build ne reçoit aucun secret (pas d'`ARG` pour la clé). `HEALTHCHECK` sur `/api/health`. `VOLUME /data`. `MOCK_MODE=true` par défaut dans l'image.

Hypothèses : Node 24 (voir encadré), `debian-slim` plutôt qu'`alpine` (les binaires précompilés de `better-sqlite3` y sont fournis), migrations Drizzle appliquées au démarrage par l'appli avant d'écouter ; un échec de migration arrête le conteneur.

> **Node 20 n'est plus maintenu depuis le 30/04/2026.** La pile du projet disait « Node 20+ » : elle devient « Node 22+ », et l'image utilise Node 24 (changeable avec `--build-arg NODE_VERSION=22`).
