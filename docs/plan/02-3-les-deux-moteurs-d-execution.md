<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 2.3 Les deux moteurs d'exécution

Les deux partagent **les mêmes schémas, les mêmes prompts, le même vérificateur et le même calcul de note**. Seul change « qui fait l'appel au modèle ».

**A. Mode API** (appli web, et `tribunal run --api` dans le terminal)
`runTrial()` enchaîne les phases. Chaque agent = un appel Messages API, avec `web_search` et `web_fetch` côté serveur. Le code lance les jurés en parallèle (limite de concurrence dans `config.ts`), valide, vérifie, calcule, puis passe à la phase suivante.

**B. Mode abonnement** (plugin, par défaut dans Claude Code)
Le CLI est la **machine à états**. Claude Code n'est qu'un exécutant :

```text
/tribunal:juger Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon
   │
   ▼
tribunal start "<saisie>"    → découpe la saisie, interroge le registre et la commune,
                               crée .tribunal/<id>/, renvoie la 1re tâche (le Greffier)
                               (élément manquant → { status: "saisie_incomplete", manque, format })
   │
   ┌─► tribunal next          → JSON : { phase, tasks: [ {agent: "tribunal:investisseur", input, output}, … ] }
   │                             ou { status: "questions", questions: [ … ] } (P1b, 2 au plus)
   │       │  questions → Claude Code les pose telles quelles (outil AskUserQuestion, même tour),
   │       │              puis tribunal answer --trial <id> --reponses '<json>' (ou --passer)
   │       │
   │       ▼  Claude Code lance en parallèle les sous-agents listés
   │          (chacun lit son fichier input, cherche sur le web, écrit son JSON dans output)
   │       │
   │   tribunal submit        → valide (Zod), vérifie les sources, calcule, journalise
   └───────┘  (tant que status ≠ "done")
   │
   ▼
tribunal report               → rapport.pdf + résumé texte
```

Pourquoi c'est déterministe : `next` refuse de donner la phase N+1 tant que la phase N n'est pas validée. `submit` refuse un fichier inattendu. Les notes sont calculées par `tally.ts`, jamais par Claude Code. La skill interdit à Claude Code de calculer ou d'éditer les JSON lui-même.

Différence assumée : en mode abonnement, les sous-agents utilisent les outils `WebSearch` / `WebFetch` de Claude Code. Ils rendent `{source_url, extrait}` et **le CLI va lui-même relire la page** (requête HTTP depuis la machine de l'utilisateur) pour vérifier que l'extrait et le chiffre y figurent.
