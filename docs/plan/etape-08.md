<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/08-la-structure-du-rapport-pdf.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 8 — Le rapport PDF

**Objectif :** un PDF lisible qui donne une réponse franche et prouve chaque chiffre.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».

1. src/lib/pdf/Report.tsx avec @react-pdf/renderer : la structure exacte de la section 8.
2. buildReportModel(trial) : construit les données du rapport SANS appeler de LLM
   (tout vient des sorties validées et de tally).
3. Les sources sont numérotées [1], [2]… ; chaque chiffre du rapport porte son numéro de source
   ou la mention de la ligne du Comptable.
4. renderReport(trial, chemin) écrit le PDF. Polices embarquées (accents français).
5. Tests : en MOCK, le PDF est généré ; un test parcourt le modèle du rapport et échoue si un nombre
   n'a ni source ni ligne de calcul ; l'avertissement « ni conseil financier, ni conseil juridique »
   est présent.
```

**Critère de validation :** `npm run trial -- --mock "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon"` produit `rapport.pdf` qui s'ouvre, avec la note avant/après et la phrase finale en première page.

---
