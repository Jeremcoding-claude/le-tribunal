<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/02-3-les-deux-moteurs-d-execution.md`
- `docs/plan/09-1-les-2-liens.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 9 — Le CLI et le plugin Claude Code : premier vrai procès dans le terminal

**Objectif :** installer le plugin et faire tourner un vrai procès, en mode abonnement et en mode API.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».
Avant d'écrire, vérifie dans la doc officielle la structure d'un plugin, le format de marketplace.json
et la commande d'installation : https://code.claude.com/docs/en/plugins/install et
https://code.claude.com/docs/en/plugin-marketplaces.

1. src/cli/tribunal.ts, commandes :
   - start "<nom, offre, cible, prix, ville>" : P0 (découpage, pièces du greffe), crée .tribunal/<id>/,
     renvoie du JSON ; si un élément manque : {status:"saisie_incomplete", manque:[…], format:"…"}.
   - next --trial <id> : renvoie {status:"tasks", phase, tasks:[{agent, input, output}]} où agent est
     le nom préfixé du sous-agent (ex. "tribunal:investisseur"),
     {status:"questions", questions:[{id, texte, choix?}]} (P1b) ou {status:"done"}.
   - answer --trial <id> --reponses '<json>' | --passer : enregistre les réponses de P1b.
     Pour chaque tâche, écrit le fichier input (CaseFile, persona, éléments vérifiés…).
   - submit --trial <id> : lit les output, valide (Zod), vérifie par relecture des pages (verifyByFetch),
     calcule, sauvegarde ; renvoie un résumé texte court (ce qui est accepté, rejeté, à relancer).
   - run "<nom, offre, cible, prix, ville>" --api | --mock [--sans-questions] : procès complet avec runTrial (clé lue dans ANTHROPIC_API_KEY).
   - report --trial <id> : génère rapport.pdf. resume --trial <id>.
2. scripts/build-plugin.ts empaquette le CLI en un seul fichier plugin/bin/tribunal.mjs (tsup, dépendances incluses).
3. plugin/.claude-plugin/plugin.json et plugin/skills/juger/SKILL.md : la skill /tribunal:juger
   décrit la boucle start → (next → lancer les sous-agents EN PARALLÈLE → submit,
   ou next → poser les questions MOT POUR MOT → answer) → report.
   Les sous-agents sont lancés avec l'outil Agent (subagent_type = agent, sans paramètre name).
   Les questions passent par l'outil AskUserQuestion, pour ne pas finir le tour : l'autorisation
   allowed-tools de la skill ne vaut que pour le tour qui la lance.
   Elle INTERDIT à Claude Code : calculer une note, modifier un JSON, sauter une phase,
   reformuler les chiffres. Elle affiche tels quels les résumés du CLI.
   Si ANTHROPIC_API_KEY est défini et que l'utilisateur écrit --api, elle lance "run --api" à la place.
4. .claude-plugin/marketplace.json à la racine du dépôt, qui pointe vers ./plugin (formats de la section 9.1).
   Lance claude plugin validate ./plugin puis claude plugin validate . : les deux doivent passer.
5. Test e2e : simuler la boucle next/submit avec les fixtures (sans Claude Code).
6. smoke réel (manuel, coûte de l'argent) : npm run smoke lance UN procès --api sur l'exemple
   et vérifie : verdict produit, coût < GUARDRAILS.budget.maxUsdPerTrial, 0 chiffre non sourcé dans le PDF.
   Il affiche aussi le **taux de rejet par règle** (source introuvable, nombre libre, cohérence note/verdict,
   appuis insuffisants, format) et signale toute règle au-dessus de GUARDRAILS.rejets.alerteParRegle.
```

**Critère de validation :**
1. `npm run trial -- --mock "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon"` → PDF.
2. Dans Claude Code : `/plugin marketplace add ./` puis `/plugin install tribunal@le-tribunal`, puis `/tribunal:juger Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon` → procès complet, PDF dans `.tribunal/<id>/`. Vérifier aussi qu'une saisie à 3 éléments déclenche la question sur l'élément manquant, et qu'une saisie sans prix déclenche la question `prix_absent` (puis tester « passer » → « comptes partiels »). (Un ticket Claude Code a déjà signalé des skills de plugin non reconnues en commande `/` : si c'est le cas, tester via `claude --plugin-dir ./plugin` et noter la version.)
3. `MOCK_MODE=false npm run smoke` → verdict, coût affiché sous le plafond.

---
