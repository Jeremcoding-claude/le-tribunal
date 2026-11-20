<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/03-0-les-prenoms-les-voix-et-la-salle-v3.md`
- `docs/plan/03-1-regles-communes-prompts-commun-md.md`
- `docs/plan/03-2-le-format-commun-de-sortie-zod.md`
- `docs/plan/03-3-le-greffier-mise-en-etat-pas-un-jure.md`
- `docs/plan/03-4-l-investisseur.md`
- `docs/plan/03-5-le-comptable.md`
- `docs/plan/03-6-le-juriste.md`
- `docs/plan/03-7-le-concurrent.md`
- `docs/plan/03-8-la-cliente.md`
- `docs/plan/03-9-le-juge.md`
- `docs/plan/04-1-les-phases.md`
- `docs/plan/04-2-le-calcul-de-la-note-globale-tally-t.md`
- `docs/plan/04-3-qui-voit-quoi.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 2 — Schémas Zod et fixtures du cas de référence

**Objectif :** toutes les formes de données sont figées et testées, et le cas « restaurants à 149 € » existe en MOCK.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».

1. Écris src/lib/schemas.ts : Affirmation, Argument, Vote, CaseFile, PersonaCliente, JurorBrief
   (avec les champs propres de chaque personnage : marche, hypotheses/lecture, risques,
   concurrents/plan_de_copie, objections), LedgerLine, DebateTurn, Ruling, Revote, TrialEvent.
   Ajoute les superRefine de la section 3.2 (fait ⇒ source ; estimation ⇒ base ; cohérence note/verdict).
   Exporte les types TypeScript inférés.
   Ajoute Saisie, PiecesDuGreffe, Identification (section 3.3), Question et Reponses (section 4.1, P1b).
   v3.0 : Proposition (section 3.2 ; candidat à fusionner), champ proposition de DebateTurn, champ source des changements du Ruling,
   et la règle du prénom de PersonaCliente (section 3.0).
   v2.4 : MiseEnEtat (case_file + persona_cliente + champs_manquants), ComptableHypotheses, ComptableLecture,
   et la variante « mise en forme » d'Affirmation (champ citation: "Cx" au lieu de source_url + extrait).
   Chaque champ a un .describe() court : il sert de documentation dans les formats générés.
2. Crée fixtures/restaurants/ : une réponse JSON valide par agent et par phase pour la saisie
   « Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon », plus des pages web MOCK
   (fixtures/restaurants/pages/*.txt) qui contiennent les extraits cités, et registre.json
   (réponse MOCK du registre et de la commune, avec un champ dirigeants à supprimer).
   IMPORTANT : toutes les valeurs et URL de ces fixtures sont FICTIVES. Utilise le domaine
   exemple.test et écris "DONNÉE FICTIVE DE TEST" dans chaque page.
3. Crée aussi des fixtures piégées dans fixtures/pieges/ (une par test de la section 5.2).
4. Tests unitaires : chaque fixture valide passe ; chaque fixture piégée échoue pour la bonne raison.

5. Test « budget de schéma » : pour chaque schéma envoyé à l'API (zodOutputFormat), compte les champs facultatifs (24 au plus)
   et les champs à types multiples, null compris (16 au plus) [S27] ; le test échoue au-dessus.
   Remplace un nullable par une valeur vide explicite quand c'est possible.

Ne crée aucune logique d'orchestration à cette étape.
```

**Critère de validation :** `npm test -- schemas` passe. Une fixture avec un GO noté 3/10 est rejetée avec un message clair.

---
