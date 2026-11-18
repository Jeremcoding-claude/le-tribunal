<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 4.2 Le calcul de la note globale (`tally.ts`)

**Vote valide** = passe Zod + cohérence note/verdict + au moins 2 appuis **vérifiés** + rendu avant le délai.

**Quorum** (nombre minimum de votes valides) : **4 sur 5**, à chaque tour de vote.
- Vote 1 sans quorum → une relance des jurés manquants. Toujours sans quorum → procès **ajourné** : rapport partiel, pas de verdict.
- Revote sans quorum → une relance. Toujours sans quorum → la note après n'est pas calculée. Le verdict se fonde sur le vote 1, avec la mention « revote sans quorum ».

**Note avant** = moyenne arithmétique des notes valides du vote 1, arrondie à 0,1.
**Note après** = moyenne arithmétique des notes valides du revote, arrondie à 0,1.
Chaque juré pèse autant que les autres. Le Juge ne vote pas.

**Écart-type** (mesure de dispersion : plus il est grand, plus les jurés sont en désaccord) calculé pour les deux votes. S'il dépasse 2,5, le rapport affiche « jury divisé ».

**Verdict du jury** (sur le revote) :
1. **Majorité stricte** : un verdict obtient plus de la moitié des votes valides (3 sur 5, ou 3 sur 4) → c'est ce verdict.
   - Règle de prudence : un GO majoritaire exige aussi une note après ≥ 6,5. Sinon → PIVOT.
2. **Pas de majorité, ou égalité** (ex. 2 GO, 2 PIVOT, 1 NO-GO ; ou 2-2 avec 4 votes) → le verdict découle de la note après :
   - note ≥ 6,5 → GO ;
   - 4,0 ≤ note < 6,5 → PIVOT ;
   - note < 4,0 → NO-GO.

**La phrase finale** (ce que lit l'utilisateur) :

| Vote 1 (majorité ou règle 2) | Revote | Phrase du rapport |
|---|---|---|
| GO | GO | **« Lance. »** |
| PIVOT ou NO-GO | GO | **« Modifie ton plan : la version corrigée peut être lancée. »** |
| peu importe | PIVOT | **« Modifie ton plan. »** |
| peu importe | NO-GO | **« Ne lance pas. »** |

```ts
// tally.ts — signature et règles, testées une par une
export function tally(round1: Vote[], round2: Vote[], cfg = GUARDRAILS.tally): {
  noteAvant: number | null; noteApres: number | null;
  ecartTypeAvant: number | null; ecartTypeApres: number | null;
  quorumAvant: boolean; quorumApres: boolean;
  verdictJury: "GO" | "PIVOT" | "NO-GO" | "AJOURNE";
  regleAppliquee: "majorite" | "majorite+prudence" | "note" | "ajourne";
  phrase: "Lance." | "Modifie ton plan : la version corrigée peut être lancée." | "Modifie ton plan." | "Ne lance pas." | "Procès ajourné.";
}
```

Toutes les constantes (quorum 4, seuils 6,5 / 4,0, seuil « jury divisé » 2,5, bandes de cohérence) sont dans `config.ts`.

---
