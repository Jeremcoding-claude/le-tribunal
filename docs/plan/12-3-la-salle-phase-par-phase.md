<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 12.3 La salle, phase par phase

| Phase | Dans la scène | Dans le panneau (journal d'audience) |
|---|---|---|
| Accueil | Les 6 agents assis, la pile de pièces tourne lentement | Champ, 3 idées, « Juger mon idée », « Voir la démo » |
| P0 à P1c | Pas de 7e personnage : le Greffier n'a ni prénom ni vote | Bandeau « Le greffier prépare le dossier », statut d'identification (entreprise existante, homonymes, aucune trace), 0 à 2 questions fixes avec « Passer » |
| P2 Instruction | Chaque juré « cherche » (écran-visage animé) | Compteur de recherches et de sources vérifiées par juré. À la fin : une **enveloppe scellée** devant chaque juré (vote 1) |
| P3 Débat | Le juré qui parle est éclairé ; une flèche va vers le juré visé quand il conteste | Tour 1 puis tour 2 ; chaque argument avec ses **pastilles de source** cliquables ; au tour 2, une carte « proposition d'amélioration » |
| P4 Correction | Les enveloppes du vote 1 s'ouvrent ; Nadia se lève | Notes du vote 1 (moyenne, écart-type), contradictions, réponses aux 3 objections, **plan v1 → v2** (champs modifiés surlignés), conditions pour lancer |
| P5 Revote | Nouvelles enveloppes scellées, ouvertes ensemble | Notes du revote |
| P6 Verdict | Nadia « prononce » (texte fixe, nombres fournis par le code) ; la pile de pièces réagit | **Note finale /10, avant → après**, verdict, répartition du jury, rappel « ni conseil financier, ni conseil juridique », bouton « Télécharger le rapport (PDF) » |

Un chiffre affiché vient toujours d'un événement émis par le code (affirmation sourcée, calcul de `tally.ts` ou de `ledger.ts`). Une estimation porte le badge « estimation » et sa base.
