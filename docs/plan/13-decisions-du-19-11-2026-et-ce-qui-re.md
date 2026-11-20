<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 13. Décisions du 19/11/2026 et ce qui reste à valider

| # | Point | Décision | Vérifié |
|---|---|---|---|
| 1 | Seuils de `tally.ts` | Règle v1 du §4.2 (quorum 4/5, majorité stricte, égalité par la moyenne, divergence signalée) | Oui : 9 072 cas exhaustifs + cas aux bornes, code exécuté |
| 2 | Prénom de la Cliente | « Nadine » devient « Sandrine » ; règle d'initiale (ni V, L, C, M, N) vérifiée par le code | Oui : tests exécutés |
| 3 | Propositions au tour 2 | Adoptées : au plus une par juré, au tour 2 seulement ; Nadia part d'elles | Oui : schéma et contrôles testés |
| 4 | Prénoms dans les prompts | Source unique `agents.config.ts` ; salle injectée par `<!-- PRENOMS -->` ; prénom de la Cliente donné dans la MISSION ; aucun accessoire | Partiellement : règles testées, injection à tester dans le dépôt |

**Statut (v3.0)** : le point 1 est désormais la règle du §4.2 de ce plan (vérifiée par exécution). Les points marqués HYPOTHÈSE restent à valider à l'étape concernée. Le point 4 reste « Partiellement » : l'injection de `<!-- PRENOMS -->` est testée à l'étape 3 (G12).

### Contexte produit ajouté le 19/11/2026 : écarts avec les fiches

| Ce que tu as décrit | Ce que disent les fiches | Ce que j'ai fait |
|---|---|---|
| « Une note de /10 pour savoir si le business est viable » | Seuls le verdict et les notes de chaque juré étaient prévus | **Ajouté** : note finale /10 = moyenne du revote (§4.2). Testé |
| « Selon le juriste, le plan peut être corrigé » | Nadia corrige le plan ; Claire signale les risques, elle ne conseille pas | **Gardé Nadia** : les risques de Claire nourrissent le débat et la correction. **Vérifié sur le cas de référence** : seul le Juge agit en P4 ; la proposition de Claire (contrat de sous-traitance) arrive dans le plan corrigé. À confirmer |
| « Le juge prend une décision selon les votes » | Nadia n'annonce ni note ni verdict : le code les calcule | **Gardé** : le code décide, Nadia prononce avec un texte fixe (hypothèse, §4.2). **Vérifié** : seul le code agit en P6 ; aucun nombre du texte ne vient d'ailleurs que du tally |
| La Cliente dit « en 10 minutes le dimanche » | Un chiffre n'est permis que s'il vient d'une affirmation sourcée | **Règle gardée** : sans source, elle dit « Je peux le faire moi-même le dimanche ». **Vérifié** : rejeté sans source, accepté avec une affirmation sourcée (valeur et unité) ou une estimation fondée sur des faits |

---
