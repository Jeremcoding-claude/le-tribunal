<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/02-1-le-principe.md`
- `docs/plan/03-1-regles-communes-prompts-commun-md.md`
- `docs/plan/03-3-le-greffier-mise-en-etat-pas-un-jure.md`
- `docs/plan/03-4-l-investisseur.md`
- `docs/plan/03-5-le-comptable.md`
- `docs/plan/03-6-le-juriste.md`
- `docs/plan/03-7-le-concurrent.md`
- `docs/plan/03-8-la-cliente.md`
- `docs/plan/03-9-le-juge.md`
- `docs/plan/05-1-limites-par-defaut-src-lib-guardrail.md`
- `docs/prompts-v3.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 3 — Les prompts, source unique, et la génération des sous-agents

**Objectif :** les personnages sont écrits une seule fois et le plugin est généré à partir d'eux.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».

1. Écris prompts/_commun.md (texte de la section 3.1) et un fichier par agent :
   greffier-enquete, greffier-redaction, mise-en-forme, investisseur, comptable, juriste, concurrent, cliente, juge.
   Chaque fichier : rôle, personnalité et ton (avec 2 exemples de phrases SANS chiffre),
   chiffres à chercher, ce qui fait baisser la note, format JSON attendu (renvoie aux schémas).
   Reprends le contenu de docs/prompts-v3.md (« Prompts système v3 (allégés) », marqueurs FORMAT et MODE compris).
   src/lib/prompts/format.ts : formats JSON générés depuis les schémas Zod (z.toJSONSchema), insérés
   à la place de <!-- FORMAT --> en mode plugin seulement. Le message MISSION finit par le RAPPEL de la phase.
   Aucune donnée dans les prompts système : elles arrivent dans le message MISSION.
2. Écris prompts/agents.config.ts : pour chaque agent, modèle, outils (API et Claude Code),
   limites de recherche lues dans GUARDRAILS.
3. Écris src/lib/prompts/loader.ts : assemble le prompt système (_commun + agent) et le message MISSION
   (phase, budget, DONNÉES), et refuse une donnée manquante.
4. Écris scripts/build-plugin.ts qui génère plugin/agents/<agent>.md avec un en-tête YAML
   (name: <agent> SANS préfixe ni « : », description, tools, model: sonnet ou opus, maxTurns) et, comme corps, le prompt assemblé SANS variables
   (le sous-agent lira ses données dans le fichier d'entrée que le CLI lui donne).
   Champs acceptés pour un agent de plugin (vérifié le 16/11/2026) : name, description, model, effort,
   maxTurns, tools, disallowedTools, skills, memory, background, omitClaudeMd, isolation.
   Pas de hooks, mcpServers ni permissionMode. Claude Code l'expose sous le nom tribunal:<agent>.
   Outils Claude Code : jurés et greffier-enquete = WebSearch, WebFetch, Read, Write ;
   greffier-redaction et juge = Read, Write. mise-en-forme.md ne sert qu'en mode API (aucun agent plugin).
5. Test : régénérer le plugin ne produit aucune différence avec les fichiers commités (test "à jour").
```

**Critère de validation :** `npm run build:plugin && git diff --exit-code plugin/agents` ne montre rien. Le test de cohérence prompts ↔ plugin passe. `claude plugin validate ./plugin` affiche `Validation passed`.

---
