<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/03-5-le-comptable.md`
- `docs/plan/05-1-limites-par-defaut-src-lib-guardrail.md`
- `docs/plan/05-2-tableau-des-garde-fous.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 5 — Le vérificateur de sources et les calculs du Comptable

**Objectif :** aucun chiffre ne passe sans preuve ; les comptes sont faits par le code.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».

1. src/lib/guardrails/numbers.ts : extraire les nombres d'un texte français
   ("1 234,5", "12 %", "1,2 Md€", "3 k", "149 €/mois") et comparer deux nombres avec tolérance.
2. src/lib/trial/verifier.ts :
   - verifyApi(brief, toolEvidence) : URL ∈ résultats de l'appel, extrait ∈ passage cité, valeur ∈ extrait.
   - verifyByFetch(brief) : relit la page (timeout config), nettoie le HTML, vérifie extrait puis valeur.
     En MOCK, lit fixtures/<cas>/pages/.
   - Le Juriste : domaine ∈ GUARDRAILS.search.juristeDomains[pays].
   - Propagation : une estimation dont la base contient un fait rejeté est rejetée ;
     un argument ou un vote sans 2 appuis vérifiés est invalide.
   - Retourne {acceptees, rejetees: [{id, raison}]}.
3. src/lib/trial/ledger.ts : les lignes L1 à L14 de la section 3.5, chacune avec ses entrées (depuis)
   et "non calculable" si une entrée manque. Aucune autre formule.
4. Vérification des champs libres (G4) : chaque nombre doit correspondre à un appui ou à une ligne citée.
5. Tests piégés : invented-number, extract-mismatch, value-not-in-extract, roleplay-number,
   ledger-mismatch, juriste-non-officiel. Tests unitaires de ledger avec des valeurs simples à la main, et de numbers (numbers.test.ts : formats français, tolérance ±1 %).
```

**Critère de validation :** les 6 tests piégés passent. `ledger.test.ts` vérifie au moins un cas calculé à la main (ex. F = 1 000, marge = 100 → point mort = 10).

---
