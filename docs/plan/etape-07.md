<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/05-1-limites-par-defaut-src-lib-guardrail.md`
- `docs/plan/05-2-tableau-des-garde-fous.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 7 — Tous les garde-fous et leurs tests piégés

**Objectif :** les 14 garde-fous de la section 5 sont actifs et prouvés (les tests de G13 et G14 s'écrivent aux étapes 12 et 11, avec le code qu'ils gardent).

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».

Implémente ce qui manque parmi G1 à G12 : sanitize.ts, neutrality.ts, consensus.ts, budget.ts, redact.ts, privacy.ts,
reprise après panne (resume), relances. Pour CHAQUE garde-fou, écris dans tests/guardrails/ les tests
piégés listés dans le tableau 5.2, avec les fixtures de fixtures/pieges/.
Ajoute un test "inventaire" qui échoue si un fichier de src/lib/guardrails/ n'a pas de test associé (config.ts est exempté ; numbers.ts a son test unitaire de l'étape 5).
Ne modifie pas les règles de calcul de tally.ts.
```

**Critère de validation :** `npm test -- guardrails` passe ; au moins 18 tests piégés ; le test « inventaire » passe.

---
