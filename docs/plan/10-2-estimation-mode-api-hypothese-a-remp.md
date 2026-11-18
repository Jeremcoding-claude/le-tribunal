<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 10.2 Estimation (mode API) — **hypothèse, à remplacer par la mesure de l'étape 12**

| Phase | Appels | Hypothèse par appel | Coût médian | Coût haut |
|---|---|---|---|---|
| Pièces du greffe (registre, commune) | 0 appel LLM | API publiques gratuites | 0 $ | 0 $ |
| Identification (Greffier-enquêteur, Sonnet + web) | 1 | 25 k entrée (60 k haut), 1,5 k sortie, 3 recherches | 0,08 $ | 0,17 $ |
| Mise en état (Greffier-rédacteur, Sonnet, sans web) | 1 | 5 k entrée, 1,5 k sortie | 0,03 $ | 0,03 $ |
| Mise en forme JSON (mode API, Sonnet, sans outil) | 6 (+ jusqu'à 10 au débat si recherche) | 6 k entrée, 2,5 k sortie | 0,22 $ | 0,60 $ |
| Instruction (Sonnet + web) | 5 (+1 lecture Comptable) | 80 k entrée (200 k haut), 3 k sortie, 4 recherches | 1,15 $ | 2,35 $ |
| Débat, 2 tours (Sonnet) | 10 | 20 k entrée, 1,5 k sortie, 0,5 recherche | 0,70 $ | 1,00 $ |
| Correction (Opus) | 1 | 50 k entrée, 5 k sortie | 0,30 $ | 0,40 $ |
| Revote (Sonnet) | 5 | 25 k entrée, 1 k sortie | 0,30 $ | 0,35 $ |
| Complément du Greffier (si un homonyme est choisi) | 0 ou 1 | 10 k entrée, 1 k sortie, 2 recherches | 0 $ | 0,05 $ |
| **Total** | **≈ 30 appels** en mode API (24 en mode plugin), ≈ 28 recherches | | **≈ 2,80 $** | **≈ 4,95 $** |

Détail du médian pour l'instruction, par juré : 80 000 × 2 $ / 1 M = 0,16 $ ; 3 000 × 10 $ / 1 M = 0,03 $ ; 4 recherches × 0,01 $ = 0,04 $ ; soit 0,23 $ × 5 = 1,15 $.

**Mode abonnement (plugin)** : 0 $ facturé à l'acte, mais environ **24 appels de sous-agents** décomptés de votre forfait Claude (25 avec le complément du Greffier, 19 en mode rapide). Pas d'appel de mise en forme : en mode plugin, chaque agent écrit directement son JSON.
