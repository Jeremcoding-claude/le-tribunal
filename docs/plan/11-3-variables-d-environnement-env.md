<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 11.3 Variables d'environnement (`.env`)

Elles sont lues à **un seul endroit** : `src/lib/env.ts` (validation Zod). Le fichier `.env` n'est jamais commité ni copié dans l'image ; `.env.example` est le modèle, sans secret.

| Variable | Défaut | Rôle |
|---|---|---|
| `MOCK_MODE` | `true` | `true` : aucun appel payant. `false` : vrais procès. Seules les valeurs `true` et `false` sont acceptées |
| `ANTHROPIC_API_KEY` | vide | Clé de l'API Claude. Exigée seulement si `MOCK_MODE=false`. Ignorée en mode MOCK |
| `TRIBUNAL_ACCESS_TOKEN` | vide | Mot de passe d'accès (16 caractères minimum), exigé si `MOCK_MODE=false` (HYPOTHÈSE) |
| `PORT` | `3000` | Port interne du conteneur. Fixé dans le compose |
| `DATA_DIR` | `./data` (hors Docker), `/data` (image) | Dossier de la base et des fichiers |
| `HOST_PORT` | `3000` | Port publié sur la machine (compose seulement) |

Règles : une valeur douteuse **arrête le démarrage** (`MOCK_MODE=flase` est une erreur, jamais « faux »). Sans clé **et** sans jeton, le mode réel refuse de démarrer : sinon toute personne qui atteint l'appli dépenserait votre clé. Les plafonds de coût de `config.ts` restent actifs. Le journal de démarrage affiche « clé_api=présente », jamais la clé.
