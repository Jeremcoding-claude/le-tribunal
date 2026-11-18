<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 10. Estimation du coût d'un procès, et comment le réduire

### 10.1 Tarifs utilisés (vérifiés le 16/11/2026) [S1]

| Élément | Prix |
|---|---|
| Sonnet 5.5 | 2 $ par million de tokens en entrée, 10 $ en sortie ; lecture du cache : 0,05 × le prix d'entrée |
| Opus 5.5 | 4 $ / 20 $ ; lecture du cache : 0,05 × |
| Haiku 5.5 (prompts ≤ 100 k tokens) | 0,10 $ / 0,50 $ |
| Recherche web | 10 $ pour 1 000 recherches (0,01 $ l'une), + les tokens des résultats |
| Web fetch | Gratuit, hors tokens du contenu récupéré |
| Batch API | −50 % (mais réponse différée : inadapté au direct) |

Un **token** est un petit morceau de texte (souvent une partie de mot) : c'est l'unité de facturation. Les résultats de recherche comptent comme des tokens d'entrée, et s'accumulent au fil d'un même appel.
