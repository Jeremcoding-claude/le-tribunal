# Processus d'exécution du plan (anti-saturation du contexte)

Principe : **une étape = un contexte neuf**. L'état vit dans git et dans `docs/JOURNAL.md`, pas dans la conversation.
Estimations de tokens : voir « Simulation d'exécution — budget de contexte » (dans le projet Claude).

## Étape 0 — installer le kit (une fois)

1. Copier à la racine du dépôt : `docs/PLAN.md`, `docs/prompts-v3.md`, `docs/JOURNAL.md`, `docs/PROCESSUS.md`, `scripts/`, `.claude/settings.json`.
2. `node scripts/split-plan.mjs` : génère `docs/plan/` (à relancer si `docs/PLAN.md` change ; ne pas modifier `docs/plan/` à la main).
3. `git init && git add -A && git commit -m "chore: kit de processus"`.

## Ce que contient le kit

| Fichier | Rôle |
|---|---|
| `docs/PLAN.md` | Plan v2.5 : v2.4 + corrections de la simulation (liste en tête du fichier) |
| `docs/plan/` | Plan découpé : un fichier par section et par étape, avec la liste « À lire » de chaque étape |
| `docs/JOURNAL.md` | Relais entre sessions (5 lignes par étape) |
| `scripts/run-etapes.mjs` | Lance les étapes une par une, en `claude -p`, et contrôle le résultat (commit, tests, typecheck) |
| `.claude/settings.json` + `scripts/hooks/` | 3 hooks : `SessionStart` (relit la fin du journal), `PreCompact` (sauve l'état), `Stop` (bloque la fin d'étape si tests rouges, modifications non commitées ou journal non mis à jour) |

Le hook `Stop` ne fait rien en session normale : il n'agit que si `TRIBUNAL_STEP` est défini, ce que fait le script.

## Deux façons de travailler

**Automatique** : `node scripts/run-etapes.mjs 1 2 3` (`--dry` pour voir sans exécuter). 12 contextes neufs, ≈ 15 k de socle en plus par étape.
Les étapes 9 et 12 sont faites en partie à la main (plugin à installer dans Claude Code, vrais procès payants) : le script le rappelle à la fin.

**À la main** : une session par ligne, `/clear` entre deux.

| Session | Étapes | Estimation (200 k) |
|---|---|---|
| S1 | 1 + 2 | ≈ 108 k |
| S2 | 3 | ≈ 73 k |
| S3 | 4 | ≈ 103 k (73 k avec la documentation déléguée à un sous-agent) |
| S4 | 5 + 6 | ≈ 115 k |
| S5 | 7 + 8 | ≈ 102 k |
| S6 | 9 | ≈ 90 k |
| S7 | 10 + 11 | ≈ 121 k |
| S8 | 12 | ≈ 54 k |

Prompt de session :

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-NN.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape NN du plan, rien d'autre. Tests verts, un commit, puis ajoute 5 lignes à docs/JOURNAL.md et commite-les.
```

## Réglages utiles

- `/context` : mesurer la fenêtre. Après l'étape 2, recaler les estimations.
- Compaction : le script fixe `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=60` (hypothèse à ajuster).
- Étape qui dérape : `/rewind` plutôt que « corrige ».
- Sorties verbeuses : `npm test` doit être `vitest run` (pas de mode watch) ; au besoin `| tail -40`.
- Documentation externe (API Claude, plugins, Next.js, API publiques) : à lire par un sous-agent qui rend 300 mots.

## À valider une fois (non testé ici : pas de Claude Code dans l'environnement de préparation)

1. `claude --help` : noms de `-p`, `--permission-mode`, `--allowedTools`, `--max-turns`, `--max-budget-usd`, `--output-format`. Le budget est une estimation : la dépense peut le dépasser.
2. Prompt sur l'entrée standard avec `-p` sans argument (choisi pour éviter les accents dans la ligne de commande sous Windows). Sinon, passer le prompt en argument.
3. Hooks : `/hooks` dans Claude Code pour voir les 3 hooks ; `$CLAUDE_PROJECT_DIR` doit être résolu par le shell des hooks (Git Bash sous Windows).
4. Lancer d'abord `node scripts/run-etapes.mjs 1 --dry`, puis l'étape 1 réelle, et lire `.run/etape-01.json` (coût, tours).
