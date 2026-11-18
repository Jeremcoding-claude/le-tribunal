<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/01-la-stack-recommandee.md`
- `docs/plan/03-3-le-greffier-mise-en-etat-pas-un-jure.md`
- `docs/plan/05-1-limites-par-defaut-src-lib-guardrail.md`
- `docs/plan/10-1-tarifs-utilises-verifies-le-16-11-20.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 4 — La couche LLM, le mode MOCK et la recherche

**Objectif :** un seul point d'appel au modèle, qui fonctionne en MOCK et en réel, et mesure le coût.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».

1. src/lib/llm/client.ts : une fonction callAgent({agent, phase, messages, schema, tools}).
   - Messages API via @anthropic-ai/sdk, en streaming (pour émettre les événements de recherche en direct).
   - Sortie JSON via structured outputs : zodOutputFormat + client.messages.parse (output_config.format).
     INCOMPATIBLE avec les citations (erreur 400) : pour un agent avec miseEnForme=true, appel 1 = recherche
     (outils web, texte, citations) ; le code numérote les citations C1…Cn ; appel 2 = prompts/mise-en-forme.md,
     sans outil, avec le JSON imposé ; le code remplace chaque « citation: Cx » par l'URL et le cited_text.
     Respecte les limites des schémas (24 champs facultatifs, 16 champs à types multiples par requête).
     Vérifie la syntaxe exacte sur https://platform.claude.com/docs/en/build-with-claude/structured-outputs.
   - Outils serveur web_search et web_fetch (version actuelle dans la doc), avec max_uses,
     allowed_domains pour le Juriste, citations activées pour web_fetch (appel 1 seulement), max_content_tokens.
   - Récupère pour chaque appel : les URL réellement renvoyées par les outils et les passages cités
     (nécessaires au vérificateur).
   - Relances 429/529/5xx (GUARDRAILS.retries), timeout par agent.
   - Revalide la réponse avec Zod.
2. src/lib/llm/mock.ts : même signature, rejoue fixtures/<cas>/ ; simule usage et événements.
   Sélection automatique selon GUARDRAILS.mock.
3. src/lib/llm/usage.ts : coût en $ à partir des tarifs (constantes datées du 16/11/2026, section 10),
   recherches à 0,01 $ l'unité, cache compris.
4. src/lib/search/ : interface SearchProvider avec trois implémentations : native (outil serveur),
   tavily (appel HTTP, contenu passé par sanitize.ts), mock.
5. src/lib/registry/fr.ts et geo-fr.ts : pièces du greffe (section 3.3.2). Vérifie d'abord la doc
   de l'API Recherche d'entreprises et de geo.api.gouv.fr (paramètres, champs, limite de débit).
   Supprime les champs de GUARDRAILS.registry.champsSupprimes, masque les entreprises individuelles,
   met en cache 24 h. Implémentation mock qui lit fixtures/<cas>/registre.json.
   src/lib/trial/intake.ts : découpage de la saisie (section 3.3.1) : nom, offre, cible, prix, ville,
   problème facultatif ; prix détecté avant la cible ; pays entre parenthèses.
6. Tests : en MOCK, callAgent renvoie la fixture et un usage non nul ; toute requête construite
   contient max_tokens et max_uses (test G6) ; intake et registre MOCK (tests G9 et G10).

Aucun appel réel dans les tests. Les tests échouent si MOCK_MODE=false est détecté en CI.
```

**Critère de validation :** `npm test -- llm` passe sans réseau (coupez le Wi-Fi pour vérifier). Le test `max-uses.test.ts` passe.

---
