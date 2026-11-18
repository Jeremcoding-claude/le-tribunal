<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/09-1-les-2-liens.md`
- `docs/plan/09-2-le-readme-gabarit.md`
- `docs/plan/10-1-tarifs-utilises-verifies-le-16-11-20.md`
- `docs/plan/10-2-estimation-mode-api-hypothese-a-remp.md`
- `docs/plan/10-3-comment-reduire-le-cout.md`

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
6. Prépare le tag v1.0.0.
```

**Critère de validation :** un clone neuf dans un autre dossier, en suivant uniquement le README, lance un procès MOCK en moins de 5 minutes ; la CI est verte ; `npm run cost` affiche un coût moyen mesuré.

---
