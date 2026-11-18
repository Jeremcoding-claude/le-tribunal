<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/01-la-stack-recommandee.md`
- `docs/plan/02-4-flux-de-donnees-mode-api.md`
- `docs/plan/05-2-tableau-des-garde-fous.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 10 — L'API web, la base SQLite et le direct (SSE)

**Objectif :** l'appli web lance un procès et diffuse ses événements en direct.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».

1. Store SQLite (Drizzle) : tables trials, phases, events (seq croissant), artifacts (JSON validés), usage.
   Même interface Store que l'étape 6.
2. POST /api/trials {idee, pays} : valide (Zod), crée le procès, lance runTrial EN ARRIÈRE-PLAN
   (sans attendre la fin) et renvoie {id}. Clé lue côté serveur dans process.env uniquement.
3. GET /api/trials/:id/stream : SSE. Lit les events en base à partir de Last-Event-ID et les pousse ;
   heartbeat toutes les 15 s ; se termine sur "verdict" ou "error". Retourne la Response immédiatement,
   le travail se fait dans le ReadableStream (sinon tout arrive à la fin).
4. GET /api/trials/:id (état), GET /api/trials/:id/report (PDF), POST /api/trials/:id/resume,
   POST /api/trials/:id/answers (réponses de P1b, validées par Zod).
5. redact.ts appliqué à tout événement et toute erreur sortants.
6. Tests : route POST en MOCK, flux SSE reçu dans l'ordre, reprise après coupure (Last-Event-ID),
   client-bundle.test.ts après next build (aucune clé dans .next/static).
```

**Critère de validation :** `curl -N http://localhost:3000/api/trials/<id>/stream` affiche les événements un par un en MOCK ; les tests G7 et G8 passent.

---
