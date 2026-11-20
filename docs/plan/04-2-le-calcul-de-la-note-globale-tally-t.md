<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 4.2 Le calcul de la note globale (`tally.ts`)

> **Règle v1 du 19/11/2026**, vérifiée par exécution (9 072 cas exhaustifs plus les cas aux bornes). Elle **remplace** l'ancienne règle (seuils 6,5 / 4,0, règle de prudence, « jury divisé » à 2,5). Les valeurs sont dans `config.ts`.

**Vote valide** = passe Zod + cohérence note/verdict + au moins 2 appuis **vérifiés** + rendu avant le délai.

**Quorum** (nombre minimum de votes valides) : **4 sur 5**, à chaque tour de vote. Sans quorum, aucun verdict : « sans quorum ».
- Vote 1 sans quorum → une relance des jurés manquants. Toujours sans quorum → procès **ajourné** : rapport partiel, pas de verdict.
- Revote sans quorum → une relance. Toujours sans quorum → la note après n'est pas calculée. Le verdict se fonde sur le vote 1, avec la mention « revote sans quorum ».

**Note avant** = moyenne arithmétique des notes valides du vote 1. **Note après** (ou **note finale sur 10**) = moyenne des notes valides du revote. Les deux sont arrondies à 0,1 (0,05 vers le haut), par la même fonction. Chaque juré pèse autant que les autres. Le Juge ne vote pas.

**Verdict du jury** (sur le revote) :
1. **Majorité stricte** : un verdict qui réunit **strictement plus de la moitié** des votes valides l'emporte (3 sur 5, 3 sur 4).
2. **Égalité** (aucune majorité stricte) : on départage par la **moyenne** des notes : GO si ≥ 6, NO-GO si ≤ 4,5, PIVOT sinon.
3. **Divergence** : si la majorité et la moyenne donnent deux verdicts différents, le verdict reste celui de la **majorité** et le rapport le signale. Il affiche les deux : par exemple « verdict GO à 3 voix sur 5, mais note 5,8/10 ».
4. **Écart-type** (population ; mesure de dispersion : plus il est grand, plus les jurés sont en désaccord), calculé pour les deux votes : **≥ 1,5 ⇒ « jury divisé »** ; **≤ 0,5 ⇒ « consensus suspect »** (alerte anti-consensus, G2).

Les comparaisons se font en **demi-points entiers** : aucune erreur d'arrondi aux bornes (6, 4,5, 1,5, 0,5).

**La phrase finale** (ce que lit l'utilisateur) :

| Vote 1 (même règle) | Revote | Phrase du rapport |
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
  repartition: { GO: number; PIVOT: number; "NO-GO": number };   // revote
  verdictJury: "GO" | "PIVOT" | "NO-GO" | "AJOURNE";
  regleAppliquee: "majorite" | "egalite_moyenne" | "ajourne";
  divergence: boolean;          // majorité ≠ verdict de la moyenne : le rapport l'affiche
  juryDivise: boolean;          // écart-type après ≥ 1,5
  consensusSuspect: boolean;    // écart-type après ≤ 0,5
  phrase: "Lance." | "Modifie ton plan : la version corrigée peut être lancée." | "Modifie ton plan." | "Ne lance pas." | "Procès ajourné.";
}
```

Toutes les constantes (quorum 4, seuils 6 et 4,5, « jury divisé » 1,5, « consensus suspect » 0,5, bandes de cohérence) sont dans `config.ts`.

**Qui prononce ? (HYPOTHÈSE, à valider)** Le code compte les votes et calcule la note. Dans l'interface et le rapport, **Nadia « prononce » le verdict avec un texte fixe** (`src/lib/trial/prononce.ts`) dont le code remplit les nombres. Elle ne calcule ni n'écrit elle-même aucune note ni aucun verdict, conformément à sa fiche (§3.9).
