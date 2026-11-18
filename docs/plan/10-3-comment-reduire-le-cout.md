<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 10.3 Comment réduire le coût

| Levier | Effet attendu [H] | Où |
|---|---|---|
| **Mise en cache du prompt** (*prompt caching* : la partie commune du prompt est relue à 0,05 × le prix) pour `_commun.md` + CaseFile + dossiers partagés au débat et au revote | −20 à −35 % | `client.ts` |
| **Par défaut depuis la v2.5** : au débat, envoyer des **fiches résumées** construites par le code (affirmations vérifiées + arguments), pas les dossiers complets | −30 % sur le débat | `phases/debat.ts` |
| `max_uses` à 3 au lieu de 5 en instruction ; `max_content_tokens` du fetch à 5 000 | −25 % sur l'instruction | `config.ts` |
| **Mode rapide** : 1 seul tour de débat, Haiku 5.5 pour le greffier | ≈ −35 % | option `--rapide` |
| Fournisseur de recherche **Tavily** (0,008 $ par recherche simple) avec contenu nettoyé et tronqué avant envoi | moins de tokens de résultats | `search/tavily.ts` |
| Cache local des recherches par requête normalisée (24 h) | gros gain si l'on rejoue un même cas | `search/` |
| Plafond `maxUsdPerTrial` + arrêt propre | coût maximum garanti | `budget.ts` |
| MOCK pour tout le développement | 0 $ hors smoke tests | `config.ts` |

Objectif réaliste après optimisation [H] : **1,20 à 1,80 $ par procès** en mode API standard (mise en forme comprise), environ 1 $ en mode rapide (Haiku 5.5 pour la mise en forme).

---
