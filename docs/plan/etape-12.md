<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/09-1-les-2-liens.md`
- `docs/plan/09-2-le-readme-gabarit.md`
- `docs/plan/10-1-tarifs-utilises-verifies-le-16-11-20.md`
- `docs/plan/10-2-estimation-mode-api-hypothese-a-remp.md`
- `docs/plan/10-3-comment-reduire-le-cout.md`
- `docs/plan/11-1-principe-un-conteneur-un-processus-u.md`
- `docs/plan/11-2-dockerfile-multi-stage-3-etapes.md`
- `docs/plan/11-3-variables-d-environnement-env.md`
- `docs/plan/11-4-persistance-volume-docker.md`
- `docs/plan/11-5-reseau-et-reverse-proxy.md`
- `docs/plan/11-6-mise-en-route-5-commandes.md`
- `docs/plan/11-7-garde-fous-de-deploiement-un-test-pi.md`
- `docs/plan/11-8-ce-qui-est-verifie-ce-qui-ne-l-est-p.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 12 — Publication open source, CI et mesure du coût réel

**Objectif :** un dépôt qu'un inconnu installe en 2 liens, et un coût mesuré.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».

1. README.md : exactement la structure de la section 9 (installation en 2 liens, MOCK, coût, limites,
   avertissement, licence MIT, crédits d'inspiration sans copie).
2. CI GitHub Actions : npm ci, lint, typecheck, test, build, build:plugin + vérification "plugin à jour".
   MOCK_MODE=true forcé ; la CI échoue si une variable ANTHROPIC_API_KEY est présente.
3. CONTRIBUTING.md (règles de CLAUDE.md), SECURITY.md (signaler une fuite de clé), CHANGELOG.md.
4. Script npm run cost : lit les usages des procès réels enregistrés et affiche coût moyen,
   min, max, et répartition par phase ; met à jour la section « Coût mesuré » du README.
5. Lance 3 vrais procès (dont le cas restaurants) avec MOCK_MODE=false et enregistre les coûts
   et les taux de rejet par règle. Une règle au-dessus de 20 % : ajuster le prompt ou la tolérance, puis relancer.
6. Déploiement (section 11) : Dockerfile multi-stage (deps, build, runner non-root, Node 24, output "standalone"), .dockerignore,
   docker-compose.yml (un service, port sur 127.0.0.1, volume nommé tribunal-data sur /data, init, cap_drop ALL), .env.example,
   deploy/ (Caddy et nginx, flux SSE sans tampon), src/lib/env.ts (validation Zod, seul endroit qui lit process.env ; config.ts et le client LLM l'importent au lieu de lire process.env),
   route /api/health, page de saisie du jeton d'accès quand MOCK_MODE=false, migrations Drizzle appliquées au démarrage.
   Tests piégés (G13) : tests/guardrails/docker-secrets.test.ts et tests/unit/env.test.ts.
   Fais lire par un sous-agent la doc officielle de Next.js (output standalone) : réponse de 300 mots.
7. Prépare le tag v1.0.0.
```

**Critère de validation :** un clone neuf dans un autre dossier, en suivant uniquement le README, lance un procès MOCK en moins de 5 minutes ; la CI est verte ; `npm run cost` affiche un coût moyen mesuré ; sur la machine de l'utilisateur, les 5 commandes du §11.6 amènent le conteneur à « healthy » (non vérifié à ce jour : Docker Hub était inaccessible lors de la préparation).

---
