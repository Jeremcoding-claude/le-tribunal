<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/03-0-les-prenoms-les-voix-et-la-salle-v3.md`
- `docs/plan/04-1-les-phases.md`
- `docs/plan/04-2-le-calcul-de-la-note-globale-tally-t.md`
- `docs/plan/04-3-qui-voit-quoi.md`
- `docs/plan/03-9-le-juge.md`
- `docs/plan/05-1-limites-par-defaut-src-lib-guardrail.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 6 — Le moteur du procès et le calcul de la note

**Objectif :** un procès complet tourne en MOCK, de la phrase au verdict.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».

1. src/lib/trial/tally.ts : exactement les règles de la section 4.2 (quorum, moyennes arrondies à 0,1,
   écart-type (population), majorité stricte, égalité départagée par la moyenne, divergence, « jury divisé » ≥ 1,5,
   « consensus suspect » ≤ 0,5, note finale /10, phrase finale ; comparaisons en demi-points entiers).
   Un test par règle, plus les cas limites : 2-2 avec 4 votes, 3 GO avec une moyenne de 5,8 (divergence signalée),
   moyenne de 6,0 et de 4,5 exactement, 3 votes valides (sans quorum), écart-type de 1,5 et de 0,5 exactement,
   et un test exhaustif sur toutes les combinaisons de notes (le candidat tally.ts en a un : 9 072 cas).
2. src/lib/trial/objections.ts : classement des objections (section 3.9).
   v3.0 : src/lib/trial/prononce.ts (texte fixe de Nadia au verdict ; tous ses nombres viennent de tally.ts, aucun autre) et
   src/lib/trial/persona-prenom.ts (règle du prénom de la Cliente, section 3.0) ; candidats à fusionner, avec le candidat
   state-machine.ts (extrait).
3. src/lib/trial/state-machine.ts : phases P0→P1a→P1b→P1c→P2…P6, transitions autorisées uniquement, point de sauvegarde
   après chaque phase via une interface Store (implémentations : fichiers .tribunal/<id>/ et mémoire).
4. src/lib/trial/phases/*.ts : une fonction par phase. Jurés en parallèle avec la limite de concurrence.
   Le Comptable fait appel 1 → ledger → appel 2. Le débat ne contient jamais les notes des autres ; au tour 2, il recueille au plus une proposition par juré (G11), transmise au Juge.
   Il reçoit des fiches résumées (affirmations vérifiées + arguments) construites par le code, jamais les dossiers complets (§10.3).
   src/lib/trial/questions.ts : P1b exactement comme la section 4.1 (2 questions fixes au plus,
   réponses lues par le code, relance unique du Greffier après choix d'un homonyme, « passer »).
5. runTrial(idee, options) : enchaîne tout et émet des TrialEvent (phase_started, agent_status,
   questions, answers_received, search_performed, source_verified, source_rejected, vote_sealed, vote1_ouvert, debate_reply,
   ruling, revote, revote_ouvert, verdict, cost_update, error).
6. tests/e2e/restaurants.mock.test.ts : le cas de référence va jusqu'au verdict en MOCK ;
   la note n'est PAS codée en dur dans le test : il vérifie qu'elle est égale à tally(fixtures).
```

**Critère de validation :** `npm test -- e2e` passe en moins de 10 s, sans réseau. Le test affiche note avant, note après et la phrase finale.

---
