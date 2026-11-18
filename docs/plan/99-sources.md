<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## Sources

Consultées le 16 novembre 2026. Les dates entre parenthèses sont celles des pages quand elles sont connues.

- **[S1]** Anthropic — Tarifs de l'API Claude (modèles 5.5, cache, Batch, web search 10 $/1 000, web fetch sans surcoût) : https://platform.claude.com/docs/en/about-claude/pricing
- **[S2]** Anthropic — Outil web search (`max_uses`, `allowed_domains` / `blocked_domains`, pas les deux à la fois) : https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- **[S3]** Anthropic — Outil web fetch (`max_uses`, `allowed_domains`, citations optionnelles, `max_content_tokens`, URL limitées à celles fournies ou trouvées auparavant, pas de rendu JavaScript) : https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
- **[S4]** Parallel — « How to save money on the Claude API » (8 oct. 2026 ; coût et tokens du web search, filtrage dynamique) : https://parallel.ai/articles/how-to-save-money-on-claude-api
- **[S5]** Tavily — tarifs (1 000 crédits gratuits/mois, 0,008 $/crédit ; recherche simple 1 crédit, avancée 2) : ColdIQ (6 juil. 2026) https://coldiq.com/blog/tavily-pricing et cloro (lu le 24 oct. 2026) https://cloro.dev/comparisons/tavily-alternatives/
- **[S6]** Brave Search API — 5 $/1 000 requêtes, 5 $ de crédit mensuel (You.com, 4 sept. 2026) : https://you.com/resources/tavily-alternatives ; CostBench (août 2026) : https://www.costbench.com/software/ai-search-apis/brave-search-api/
- **[S7]** Exa — Recherche à 7 $/1 000 requêtes : https://exa.ai/docs/reference/pricing.md (l'offre gratuite varie selon les sources consultées : à vérifier sur exa.ai/pricing)
- **[S8]** Anthropic — Agent SDK, vue d'ensemble (comparaison Agent SDK / CLI / Client SDK ; interdiction de proposer la connexion claude.ai sans accord) : https://code.claude.com/docs/en/agent-sdk/overview
- **[S9]** Agent SDK TypeScript : paquet `@anthropic-ai/claude-agent-sdk`, embarque le binaire Claude Code, version 0.3.302 au 16 oct. 2026 (Developers Digest, 17 oct. 2026) : https://www.developersdigest.tech/blog/claude-agent-sdk-whats-new-2026
- **[S10]** Agent SDK, guide 2026 (Node 18+, versions 0.x) : https://alexcloudstar.com/blog/claude-agent-sdk-guide-2026/
- **[S11]** Anthropic — Structured outputs (`output_config.format`) et strict tool use : https://platform.claude.com/docs/en/build-with-claude/structured-outputs et https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
- **[S12]** Structure d'un plugin Claude Code (`.claude-plugin/plugin.json`, `agents/`, `skills/` à la racine, `${CLAUDE_PLUGIN_ROOT}`) : https://tessl.io/registry/skills/github/anthropics/claude-code/plugin-structure
- **[S13]** Anthropic — Sous-agents Claude Code (Markdown + YAML, `tools`, `model`, `.claude/agents/`, agents fournis par plugin) : https://code.claude.com/docs/en/sub-agents
- **[S14]** Anthropic — Installer des plugins (marketplace, installation en une commande) : https://code.claude.com/docs/en/plugins/install
- **[S15]** Anthropic — Créer un marketplace de plugins (`/plugin marketplace add`, `/plugin install <plugin>@<marketplace>`) : https://code.claude.com/docs/en/plugin-marketplaces
- **[S16]** Streaming SSE dans les Route Handlers Next.js (Web Streams, `ReadableStream`, clé jamais en `NEXT_PUBLIC_`) : https://dev.to/jangwook_kim_e31e7291ad98/building-a-streaming-ai-chat-app-with-nextjs-16-claude-api-complete-app-router-guide-594n
- **[S17]** Piège SSE : Next.js attend la fin du handler si le travail est fait avant le `return` : https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996
- **[S18]** `@react-pdf/renderer` v4.5.1, licence MIT : https://mcp.depscope.dev/pkg/npm/@react-pdf/renderer
- **[S19]** Vercel — Durée maximale des fonctions (Hobby 300 s ; Pro 800 s ; 1 800 s en bêta, Fluid compute) : https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute et https://vercel.com/docs/functions/limitations
- **[S21]** Anthropic — Skills : les skills de plugin utilisent l'espace de noms `plugin-name:skill-name` : https://code.claude.com/docs/en/skills ; tutoriel plugins (`/my-first-plugin:hello`, préfixe = champ `name` de plugin.json) : https://code.claude.com/docs/en/plugins ; ticket signalant des skills de plugin non reconnues en commande : https://github.com/anthropics/claude-code/issues/41842
- **[S22]** API Recherche d'entreprises (DINUM, annuaire-entreprises.data.gouv.fr) : recherche par nom, SIREN, adresse, code NAF, recherche géographique, accès ouvert : https://www.data.gouv.fr/dataservices/api-recherche-dentreprises et https://github.com/annuaire-entreprises-data-gouv-fr/search-api
- **[S23]** Anthropic — Sous-agents : outil `Agent` (renommé depuis `Task` en v2.1.63, `Task` reste un alias), champs d'en-tête, héritage du mode d'autorisation, `AskUserQuestion` indisponible pour les sous-agents : https://code.claude.com/docs/en/sub-agents
- **[S24]** Anthropic — Référence du manifeste `plugin.json` (seul `name` obligatoire, préfixe des composants, dossier `bin/`, `${CLAUDE_PLUGIN_ROOT}` substitué dans le texte des skills et agents) : https://code.claude.com/docs/en/plugins/manifest-reference ; agents de plugin (champs acceptés, nom `plugin:agent`) : https://code.claude.com/docs/en/plugins-reference
- **[S25]** Anthropic — Installer un plugin, dont `/plugin install <plugin> --marketplace <source>` (v2.1.275+) : https://code.claude.com/docs/en/plugins/install ; créer et valider un marketplace : https://code.claude.com/docs/en/plugin-marketplaces
- **[S26]** Anthropic — Skills (`allowed-tools` valable pour le seul tour qui lance la skill, `$ARGUMENTS`, `${CLAUDE_PLUGIN_ROOT}` dans `allowed-tools`, nom court utilisable) : https://code.claude.com/docs/en/skills ; règles d'autorisation (`WebFetch`, `WebSearch`, `Edit(chemin)` qui couvre aussi Write) : https://code.claude.com/docs/en/permissions
- **[S27]** Anthropic — Structured outputs : incompatibles avec les citations (erreur 400), limites des schémas (pas de `minimum`/`maxLength`, 24 champs facultatifs, 16 champs à types multiples), `zodOutputFormat` qui retire puis revérifie les contraintes : https://platform.claude.com/docs/en/build-with-claude/structured-outputs ; avertissement côté citations : https://platform.claude.com/docs/en/build-with-claude/citations
- **[S28]** Zod 4 — `z.toJSONSchema()` : https://zod.dev/json-schema
- **[S29]** SDK TypeScript Anthropic — helpers `zodOutputFormat` et `messages.parse` : https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md
- **[S20]** Claude Court (alexyc9381/court-skill), MIT : jury de 12 Claude, script de tenue d'état, 17 appels de sous-agents par procès (11 en rapide) : https://www.skillsdirectory.com/skills/alexyc9381-court et https://www.skillsdirectory.com/skills/ibrdot-court
