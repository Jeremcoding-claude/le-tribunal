<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 11.7 Garde-fous de déploiement (un test piégé chacun)

| Garde-fou | Test (`tests/guardrails/docker-secrets.test.ts`, `tests/unit/env.test.ts`) |
|---|---|
| Aucune clé, jeton ou mot de passe en `ARG` ou `ENV` ; aucun texte `sk-ant-` dans les fichiers de déploiement | Dockerfile, `.dockerignore`, `.env.example`, compose |
| `.env*`, `.tribunal`, `*.db`, `node_modules` exclus du contexte de build ; `prompts/`, `fixtures/`, `drizzle/` jamais exclus | `.dockerignore` |
| Étape finale : pas de `COPY . .`, pas root, `MOCK_MODE=true`, `HEALTHCHECK`, `VOLUME /data`, Node ≥ 22, jamais `latest` | Dockerfile |
| `.env.example` : clé et jeton vides, `MOCK_MODE=true`, pas de `PORT` | `.env.example` |
| Un seul service, port sur `127.0.0.1`, volume nommé sur `/data`, aucune clé en dur, `init`, `cap_drop: ALL` | `docker-compose.yml` |
| `output: "standalone"` présent | `next.config.ts` |
| Valeur douteuse = arrêt ; mode réel sans clé ou sans jeton = arrêt ; la clé n'apparaît ni dans le résumé ni dans les erreurs | `src/lib/env.ts` |
