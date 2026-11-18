# Prompts des 8 sessions (à coller dans Claude Code)

Ce fichier complète `docs/PROCESSUS.md`. Une section = une session Claude Code = un contexte neuf.

Abonnement Pro : voir la section « Mode Pro » en fin de fichier (une étape par séance, prompt de pause, suivi du quota).

## Avant chaque session

1. Ouvrir Claude Code dans le dossier du projet (`le-tribunal`).
2. `git status` : l'arbre doit être propre. Sinon, commiter ou annuler avant de commencer.
3. `/clear` si la session précédente est encore ouverte.
4. Coller le prompt de la section.

## Entre deux étapes d'une même session (sessions 1, 4, 5, 7)

Chaque prompt s'arrête à la fin de la première étape. Tapez `/context` :
- moins de 60 % utilisé : collez le prompt « Étape suivante » dans la même session ;
- 60 % ou plus : `/clear`, puis collez le même prompt « Étape suivante » (il relit tout seul ce qu'il faut).

## Règles communes (déjà incluses dans chaque prompt)

- Une étape à la fois, un commit par étape, tests verts avant commit.
- Aucun vrai appel API : `MOCK_MODE=true`. Aucun `git push`.
- Fin d'étape : 5 lignes ajoutées à `docs/JOURNAL.md`, commitées à part.
- Documentation externe : lue par un sous-agent qui rend 300 mots au plus.

---

## Session 1 — Étapes 1 et 2 (≈ 108 k tokens)

**Étape 1 — Initialiser le dépôt.** Premier prompt : `CLAUDE.md` n'existe pas encore, c'est cette étape qui le crée.

```text
Lis docs/JOURNAL.md, puis docs/plan/etape-01.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 1 du plan, rien d'autre. Elle crée CLAUDE.md : je n'en ai pas encore.

Précisions :
- Le dossier contient déjà un dépôt git, docs/, scripts/ et .claude/ (le kit de processus). Ne les écrase pas. Si create-next-app refuse un dossier non vide, génère le projet dans un dossier temporaire puis déplace les fichiers sans toucher à docs/, scripts/ ni .claude/.
- .gitignore doit contenir .run/ en plus des entrées prévues par l'étape.
- Pour la commande d'initialisation de shadcn/ui, fais lire la documentation officielle par un sous-agent (réponse de 300 mots au plus).
- Aucun vrai appel API.

Critère de validation : npm test, npm run typecheck et npm run lint passent ; grep -r "sk-ant" . (hors node_modules) ne trouve rien.

Fin d'étape : un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Ne passe pas à l'étape 2. Termine en m'écrivant les 5 lignes du journal, rien d'autre.
```

**Étape suivante — Étape 2 : schémas Zod et fixtures.** À coller après le contrôle `/context`.

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-02.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 2 du plan, rien d'autre.

Précisions :
- Zod 4 (z.toJSONSchema). Ajoute le « budget de schéma » : un test qui compte, pour chaque schéma envoyé en sortie structurée, les champs facultatifs (24 au plus) et les champs à types multiples (16 au plus).
- Le cas de référence « restaurants à 149 € » doit exister en fixtures MOCK, sans réseau.
- Aucun vrai appel API.

Critère de validation : npm test -- schemas passe. Une fixture avec un GO noté 3/10 est rejetée avec un message clair.

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Ne passe pas à l'étape 3. Termine en m'écrivant les 5 lignes du journal, rien d'autre.
```

---

## Session 2 — Étape 3 (≈ 73 k tokens)

**Étape 3 — Les prompts, source unique, et la génération des sous-agents.**

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-03.md et uniquement les fichiers de sa section « À lire » (y compris docs/prompts-v3.md).
Exécute l'étape 3 du plan, rien d'autre.

Précisions :
- Les prompts sont dans prompts/ (source unique) ; plugin/agents/ est GÉNÉRÉ par npm run build:plugin et commité. Ne modifie jamais plugin/agents/ à la main.
- Les 9 fichiers agents : greffier-enquete, greffier-redaction, mise-en-forme, investisseur, comptable, juriste, concurrent, cliente, juge. Reprends le contenu de docs/prompts-v3.md, marqueurs FORMAT et MODE compris. Aucune donnée dans les prompts système.
- Avant d'écrire l'en-tête des sous-agents du plugin, fais vérifier par un sous-agent la documentation officielle des plugins et sous-agents Claude Code (réponse de 300 mots au plus, avec les URL).
- Si la commande claude plugin validate n'existe pas dans ma version, dis-le dans le journal au lieu de l'inventer.
- Aucun vrai appel API.

Critère de validation : npm run build:plugin && git diff --exit-code plugin/agents ne montre rien ; le test de cohérence prompts ↔ plugin passe ; claude plugin validate ./plugin affiche « Validation passed » (si la commande existe).

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Ne passe pas à l'étape 4. Termine en m'écrivant les 5 lignes du journal, rien d'autre.
```

---

## Session 3 — Étape 4 (≈ 103 k tokens, 73 k avec la documentation déléguée)

**Étape 4 — La couche LLM, le mode MOCK et la recherche.** C'est l'étape qui dépend le plus de la documentation externe : elle est déléguée.

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-04.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 4 du plan, rien d'autre.

Précisions :
- Avant d'écrire du code, lance DEUX sous-agents (un par sujet), chacun rend 300 mots au plus avec les URL officielles : (1) sorties structurées de l'API Claude avec Zod (zodOutputFormat, messages.parse, limites des schémas, incompatibilité avec les citations) ; (2) outils serveur web_search et web_fetch (version actuelle des outils, max_uses, allowed_domains, citations, max_content_tokens). Ne lis pas toi-même ces pages.
- Un seul point d'appel au modèle : callAgent. Il marche en MOCK et en réel, et mesure le coût de chaque appel.
- Les tests ne touchent jamais le réseau. MOCK_MODE=true par défaut.
- Aucun vrai appel API pendant cette session.

Critère de validation : npm test -- llm passe sans réseau ; le test max-uses.test.ts passe.

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Ne passe pas à l'étape 5. Termine en m'écrivant les 5 lignes du journal, rien d'autre.
```

*Contrôle à faire de votre côté :* coupez le Wi-Fi et relancez `npm test -- llm` pour confirmer que rien ne touche le réseau.

---

## Session 4 — Étapes 5 et 6 (≈ 115 k tokens)

**Étape 5 — Le vérificateur de sources et les calculs du Comptable.**

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-05.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 5 du plan, rien d'autre.

Précisions :
- Les calculs du Comptable sont faits en TypeScript dans src/lib/trial/ledger.ts, uniquement. Aucune autre formule ailleurs.
- Écris les 6 tests piégés : invented-number, extract-mismatch, value-not-in-extract, roleplay-number, ledger-mismatch, juriste-non-officiel. Ajoute au moins un cas calculé à la main dans ledger.test.ts (par exemple F = 1 000 et marge = 100 donnent un point mort de 10) et le fichier numbers.test.ts.
- Aucun vrai appel API ; en MOCK, le vérificateur lit fixtures/<cas>/pages/.

Critère de validation : les 6 tests piégés passent ; ledger.test.ts vérifie au moins un cas calculé à la main.

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Ne passe pas à l'étape 6. Termine en m'écrivant les 5 lignes du journal, rien d'autre.
```

**Étape suivante — Étape 6 : le moteur du procès et le calcul de la note.**

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-06.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 6 du plan, rien d'autre.

Précisions :
- Toutes les règles de note sont dans src/lib/trial/tally.ts, exactement comme la section 4.2 du plan. Un test par règle, plus les cas limites : 2-2 avec 4 votes, 3 GO avec note 6,0, 3 votes valides.
- Le vote 1 est scellé : aucun prompt de débat ne contient les notes des autres jurés. Le débat reçoit des fiches résumées construites par le code, jamais les dossiers complets.
- L'orchestration est déterministe : c'est le code qui enchaîne les phases, jamais le modèle.
- Aucun vrai appel API.

Critère de validation : npm test -- e2e passe en moins de 10 s, sans réseau ; le test affiche la note avant, la note après et la phrase finale.

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Ne passe pas à l'étape 7. Termine en m'écrivant les 5 lignes du journal, rien d'autre.
```

---

## Session 5 — Étapes 7 et 8 (≈ 102 k tokens)

**Étape 7 — Tous les garde-fous et leurs tests piégés.**

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-07.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 7 du plan, rien d'autre.

Précisions :
- Un garde-fou ajouté = un test piégé ajouté dans tests/guardrails/, avec les fixtures de fixtures/pieges/.
- Le test « inventaire » échoue si un fichier de src/lib/guardrails/ n'a pas de test associé ; config.ts est exempté, numbers.ts a déjà son test unitaire de l'étape 5.
- Ne modifie pas les règles de calcul de tally.ts.
- Aucun vrai appel API.

Critère de validation : npm test -- guardrails passe ; au moins 18 tests piégés ; le test « inventaire » passe.

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Ne passe pas à l'étape 8. Termine en m'écrivant les 5 lignes du journal, rien d'autre.
```

**Étape suivante — Étape 8 : le rapport PDF.**

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-08.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 8 du plan, rien d'autre.

Précisions :
- Le rapport est construit sans aucun appel au modèle : tout vient des sorties validées et de tally.
- Chaque chiffre du rapport porte un numéro de source [n] ou la mention d'une ligne du Comptable. Un test échoue si un nombre n'a ni l'un ni l'autre.
- L'avertissement « ni conseil financier, ni conseil juridique » est présent dans le PDF.
- Après avoir généré le PDF en MOCK, vérifie-le toi-même en extrayant son texte (note avant/après et phrase finale en première page, accents corrects).
- Aucun vrai appel API.

Critère de validation : npm run trial -- --mock "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon" produit rapport.pdf, qui s'ouvre, avec la note avant/après et la phrase finale en première page.

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Ne passe pas à l'étape 9. Termine en m'écrivant les 5 lignes du journal, rien d'autre.
```

*Contrôle à faire de votre côté :* ouvrez le `rapport.pdf` produit (dans `.tribunal/<id>/`) et vérifiez qu'il est lisible.

---

## Session 6 — Étape 9 (≈ 90 k tokens)

**Étape 9 — Le CLI et le plugin Claude Code.** Une partie se fait à la main : Claude Code ne peut pas installer un plugin dans sa propre session, et les vrais procès sont payants.

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-09.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 9 du plan, rien d'autre, sauf les parties que je fais à la main (voir plus bas).

Précisions :
- Avant d'écrire, fais lire par un sous-agent la documentation officielle (structure d'un plugin, format de marketplace.json, commande d'installation) ; réponse de 300 mots au plus avec les URL. Ne lis pas toi-même ces pages.
- Fais tout ce qui se teste en MOCK : le CLI (start, next, answer, submit, run), la génération du plugin (npm run build:plugin ; plugin/ est commité), puis npm run trial -- --mock "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon" qui doit produire un PDF.
- Ne lance NI npm run smoke, NI aucun vrai procès, NI /plugin install : ce sont des commandes que je lance moi-même.
- Aucun vrai appel API.

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Termine par une liste « À FAIRE À LA MAIN » avec les commandes exactes des critères 2 et 3 de l'étape 9 (installation du plugin, /tribunal:juger avec saisie complète, avec 3 éléments seulement, puis sans prix ; enfin MOCK_MODE=false npm run smoke). Ne passe pas à l'étape 10.
```

**Après vos essais manuels.** Remplacez les trois lignes entre crochets, puis collez dans une session neuve.

```text
Lis CLAUDE.md et docs/JOURNAL.md. Voici le résultat de mes essais manuels de l'étape 9 :
- Installation du plugin et /tribunal:juger : [OK, ou le message d'erreur exact]
- Saisie à 3 éléments, saisie sans prix puis « passer » : [OK, ou ce qui s'est passé]
- MOCK_MODE=false npm run smoke : [verdict et coût affiché, ou le message d'erreur exact]
Corrige uniquement ce qui doit l'être pour que ces essais passent. Si la commande /tribunal:juger n'est pas reconnue, teste avec claude --plugin-dir ./plugin et note la version de Claude Code dans le journal. Aucun vrai appel API de ta part. Tests verts, un commit, puis 5 lignes dans docs/JOURNAL.md, commitées à part.
```

*Coût :* le test `smoke` est un vrai procès payant (de l'ordre de 3 à 5 $ d'après le plan). C'est vous qui le lancez.

---

## Session 7 — Étapes 10 et 11 (≈ 121 k tokens)

**Étape 10 — L'API web, la base SQLite et le direct (SSE).**

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-10.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 10 du plan, rien d'autre.

Précisions :
- Avant d'écrire, fais vérifier par un sous-agent la documentation officielle de Next.js (route handlers en streaming, SSE) et de Drizzle avec better-sqlite3 ; réponse de 300 mots au plus avec les URL.
- La clé API n'est lue que côté serveur, dans process.env. Elle ne doit apparaître ni dans un log, ni dans un événement, ni dans .next/static (test client-bundle après next build).
- Pour tester le flux SSE avec curl, démarre le serveur en arrière-plan, teste, puis arrête-le. Ne laisse jamais npm run dev tourner au premier plan.
- Aucun vrai appel API.

Critère de validation : curl -N http://localhost:3000/api/trials/<id>/stream affiche les événements un par un en MOCK ; les tests G7 et G8 passent.

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Ne passe pas à l'étape 11. Termine en m'écrivant les 5 lignes du journal, rien d'autre.
```

**Étape suivante — Étape 11 : l'interface « salle d'audience ».**

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-11.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 11 du plan, rien d'autre.

Précisions :
- Tailwind et shadcn/ui. Aucune clé et aucun appel Anthropic côté client.
- Chaque chiffre affiché ouvre sa source. Les textes d'interface sont en français.
- Ne laisse jamais npm run dev tourner au premier plan : pour vérifier, utilise les tests et un démarrage en arrière-plan que tu arrêtes ensuite.
- Aucun vrai appel API.

Critère de validation : en MOCK, un procès complet se déroule à l'écran ; chaque chiffre affiché ouvre sa source ; aucune requête réseau du navigateur vers api.anthropic.com.

Fin d'étape : npm test, npm run typecheck et npm run lint verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Termine en me donnant la commande pour lancer l'appli moi-même et les 3 choses à regarder à l'écran (dont l'onglet Réseau du navigateur).
```

*Contrôle à faire de votre côté :* lancez `npm run dev`, déroulez un procès en MOCK et ouvrez l'onglet Réseau du navigateur : aucune requête vers `api.anthropic.com`.

---

## Session 8 — Étape 12 (≈ 54 k tokens)

**Étape 12 — Publication open source, CI et mesure du coût réel.** Les 3 vrais procès sont payants : Claude Code prépare tout, c'est vous qui les lancez.

```text
Lis CLAUDE.md et docs/JOURNAL.md, puis docs/plan/etape-12.md et uniquement les fichiers de sa section « À lire ».
Exécute l'étape 12 du plan, rien d'autre, sauf les parties que je fais à la main (voir plus bas).

Précisions :
- Fais vérifier par un sous-agent la syntaxe actuelle de GitHub Actions (npm ci, cache, variables d'environnement) ; réponse de 300 mots au plus avec les URL.
- README.md, CI, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md et le script npm run cost : fais-les. La CI force MOCK_MODE=true et échoue si ANTHROPIC_API_KEY est présente.
- Ne lance AUCUN vrai procès (point 5 de l'étape) : prépare tout pour que je les lance moi-même. Ne crée pas de tag, ne pousse rien, ne crée aucun dépôt GitHub.
- Aucun vrai appel API.

Fin d'étape : npm test, npm run typecheck, npm run lint et npm run build verts ; un seul commit pour l'étape ; puis 5 lignes dans docs/JOURNAL.md (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Termine par une liste « À FAIRE À LA MAIN » : les 3 commandes de vrais procès (dont le cas restaurants), npm run cost, le test d'un clone neuf en suivant uniquement le README, puis le tag v1.0.0 à créer.
```

**Après vos 3 vrais procès.** Remplacez la ligne entre crochets, puis collez dans une session neuve.

```text
Lis CLAUDE.md et docs/JOURNAL.md. J'ai lancé 3 vrais procès avec MOCK_MODE=false. Voici la sortie de npm run cost : [coller la sortie complète ici].
Analyse les taux de rejet par règle. Pour toute règle au-dessus de 20 %, propose d'abord la cause probable et la correction (prompt ou tolérance) et attends mon accord avant de modifier. Une modification de règle de calcul ou de garde-fou met à jour docs/PLAN.md, docs/plan/ (node scripts/split-plan.mjs) et les tests. Remplis la section « Coût mesuré » du README avec les chiffres réels. Aucun vrai appel API de ta part. Tests verts, un commit, puis 5 lignes dans docs/JOURNAL.md, commitées à part.
```

---

## Si une session déraille

- Ne dites pas « corrige » : tapez `/rewind` pour revenir avant l'erreur, puis reformulez.
- Si la session sature (compaction automatique) : `/clear`, puis recollez le prompt de l'étape en cours. Il relit `CLAUDE.md` et le journal, et reprend là où git s'est arrêté.
- Si un test reste rouge après deux essais : arrêtez, copiez l'erreur dans une session neuve avec « Lis CLAUDE.md et docs/JOURNAL.md. Ce test échoue : [erreur]. Corrige uniquement cela. »

---

## Mode Pro (abonnement Pro : 12 séances, une étape chacune)

Principe : sur Pro, le quota est partagé entre claude.ai et Claude Code, avec une fenêtre de 5 heures et un plafond hebdomadaire. On fait donc **une étape par séance**, y compris dans les sessions 1, 4, 5 et 7 qui en regroupent deux plus haut. Les blocs « Étape suivante » fonctionnent seuls : ils relisent `CLAUDE.md` et le journal.

### Déroulé commun d'une séance (à répéter pour chaque étape)

Le préfixe `!` lance une commande depuis Claude Code. S'il ne marche pas chez vous, demandez à Claude de la lancer.

**Avant**
1. `!git status` : l'arbre doit être propre. `!git log --oneline -3` : le dernier commit est celui de l'étape précédente (ou « wip » si vous reprenez après une pause).
2. Sur claude.ai, Settings > Usage : notez le pourcentage de la session de 5 heures et du plafond hebdomadaire, dans le tableau de suivi plus bas.
3. `/clear`, puis `/model` : choisissez Sonnet.
4. Collez le prompt de l'étape (colonne « Prompt » du tableau suivant).

**Pendant**
5. N'utilisez pas claude.ai en parallèle : c'est le même quota. Si la fenêtre de 5 heures approche de la fin, collez le prompt de pause (plus bas).

**Après**
6. Lancez les commandes de contrôle de l'étape (colonne « Contrôle »).
7. `!git log --oneline -3` : deux nouveaux commits (l'étape, puis le journal). `!git status` : arbre propre.
8. Settings > Usage : notez les pourcentages d'après.
9. `/clear`.

### Étape par étape

Poids = taille de contexte estimée de l'étape (léger : 40 k tokens ou moins ; moyen : 44 à 58 k ; lourd : 73 k ou plus). Les étapes se font dans l'ordre : on ne les réordonne pas, on les espace. Avant une étape lourde (2, 4 ou 9), démarrez dans une fenêtre de 5 heures neuve, et attendez le renouvellement hebdomadaire si le reste de la semaine ne couvre pas la consommation de votre dernière étape de poids comparable (voir le tableau de suivi).

| Étape | Prompt | Poids | Contrôle | À faire de votre côté |
|---|---|---|---|---|
| 1 | Session 1, premier bloc | léger (≈ 20 k) | `!npm test`, `!npm run typecheck`, `!npm run lint` ; demandez à Claude de chercher « sk-ant » hors `node_modules` : rien ne doit sortir | — |
| 2 | Session 1, « Étape suivante » | lourd (≈ 73 k) | `!npm test -- schemas` | — |
| 3 | Session 2 | moyen (≈ 58 k) | `!npm run build:plugin` puis `!git diff --exit-code plugin/agents` (aucune sortie) ; `!npm test` | — |
| 4 | Session 3 | lourd (≈ 88 k) | `!npm test -- llm` | Coupez le Wi-Fi et relancez `npm test -- llm` : il doit passer |
| 5 | Session 4, premier bloc | moyen (≈ 44 k) | `!npm test` (les 6 tests piégés) | — |
| 6 | Session 4, « Étape suivante » | moyen (≈ 56 k) | `!npm test -- e2e` | — |
| 7 | Session 5, premier bloc | moyen (≈ 55 k) | `!npm test -- guardrails` | — |
| 8 | Session 5, « Étape suivante » | léger (≈ 32 k) | `!npm run trial -- --mock "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon"` | Ouvrez `rapport.pdf` (dans `.tribunal/<id>/`) |
| 9 | Session 6, premier bloc, puis « Après vos essais manuels » | lourd (≈ 75 k) | `!npm test` ; le procès en MOCK comme à l'étape 8 | La liste « À FAIRE À LA MAIN » que Claude affiche : plugin, 3 saisies, puis `smoke` (procès payant) |
| 10 | Session 7, premier bloc | moyen (≈ 48 k) | `!npm test` et `!npm run build` | — |
| 11 | Session 7, « Étape suivante » | moyen (≈ 58 k) | `!npm test` | `npm run dev`, un procès en MOCK, onglet Réseau : aucune requête vers `api.anthropic.com` |
| 12 | Session 8, puis « Après vos 3 vrais procès » | léger (≈ 39 k) | `!npm test`, `!npm run lint`, `!npm run build` | 3 vrais procès, `npm run cost`, test du clone neuf, tag `v1.0.0` |

### Prompt de pause

À coller quand le compteur de la fenêtre de 5 heures approche de la limite, avant d'être coupé.

```text
Je dois m'arrêter. Termine la modification en cours sans en commencer d'autre. Ajoute à la fin de docs/JOURNAL.md une note « PAUSE étape N » : ce qui est fait, ce qui reste, le test qui échoue s'il y en a un et la commande qui le lance. Puis commite tout, note du journal comprise, en UN SEUL commit « wip: étape N », même si des tests sont rouges. Ne fais rien d'autre. Réponds en 3 lignes.
```

Remplacez N par le numéro de l'étape. Un commit « wip » est une entorse à la règle « tests verts avant commit » : l'étape n'est pas terminée tant que le commit final n'est pas propre.

### Prompt de reprise après une pause

À coller dans une session neuve (après `/clear`), à la place du prompt de l'étape. Remplacez N et NN.

```text
Lis CLAUDE.md et docs/JOURNAL.md. L'étape N a été interrompue : le dernier commit est « wip: étape N » et le journal contient une note « PAUSE étape N ». Lis docs/plan/etape-NN.md et uniquement les fichiers de sa section « À lire », puis reprends exactement là où cette note s'arrête et termine l'étape. Quand les tests sont verts, remplace le commit « wip » par un commit propre de l'étape (git reset --soft HEAD~1, puis un seul commit). Remplace ensuite la note « PAUSE étape N » du journal par 5 lignes (Fait / Décisions / // HYPOTHÈSE: ouvertes / Tests / Suivant), commitées à part. Aucun vrai appel API, aucun git push. Ne passe pas à l'étape suivante.
```

### Si le quota coupe sans prévenir

Vous n'avez alors pas pu coller le prompt de pause : il n'y a ni commit « wip » ni note « PAUSE » dans le journal, et `!git status` montre des fichiers modifiés non commités. Au renouvellement, deux choix :
- **Reprendre :** collez le prompt de l'étape (pas celui de reprise) en ajoutant d'abord cette phrase : « La séance précédente a été coupée : commence par git status et git diff --stat, et reprends à partir des fichiers déjà modifiés. »
- **Repartir de zéro :** vérifiez `!git status`, puis `!git restore .` et `!git clean -fd` effacent le travail non commité (définitivement). Recollez ensuite le prompt de l'étape.

### Tableau de suivi (à remplir)

Notez le pourcentage affiché dans Settings > Usage. Après les étapes 1 et 2, vous saurez ce que coûte une étape légère et une étape lourde.

| Étape | Date | Session de 5 h : avant → après | Semaine : avant → après | Pause (oui/non) |
|---|---|---|---|---|
| 1 |  |  |  |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |
| 4 |  |  |  |  |
| 5 |  |  |  |  |
| 6 |  |  |  |  |
| 7 |  |  |  |  |
| 8 |  |  |  |  |
| 9 |  |  |  |  |
| 10 |  |  |  |  |
| 11 |  |  |  |  |
| 12 |  |  |  |  |

Règle de décision (une suggestion, pas une mesure) : si l'étape 2 consomme plus de 20 % de votre plafond hebdomadaire, ne faites qu'une étape lourde par semaine (2, 4, 9) et comptez environ 3 semaines au total.
