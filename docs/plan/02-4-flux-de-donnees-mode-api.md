<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 2.4 Flux de données (mode API)

```text
[Saisie : nom, offre, cible, prix, ville (+ problème facultatif)]
             ─► P0 Dépôt (code : découpage de la saisie, nettoyage, injection,
                  registre des entreprises + fiche commune → « pièces du greffe »)
             ─► P1a Identification (Greffier-enquêteur, Sonnet + web, puis mise en forme) ─► Identification
             ─► P1b Questions (code, 0 à 2 questions fixes : prix absent, homonymes) ─► réponses ou « passer »
             ─► P1c Mise en état (Greffier-rédacteur, Sonnet, sans web) ─► CaseFile neutre + PersonaCliente
             ─► P2 Instruction ×5 en parallèle (Sonnet + web) ─► vérificateur ─► Vote 1 scellé
             ─► P3 Débat, 2 tours (Sonnet) ─► vérificateur
             ─► P4 Correction (Juge, Opus) ─► Plan corrigé (CaseFile v2)
             ─► P5 Revote ×5 (Sonnet) ─► tally.ts
             ─► P6 Verdict (code) ─► rapport.pdf
     Chaque étape écrit des événements ─► SQLite ─► SSE ─► salle d'audience
```

---
