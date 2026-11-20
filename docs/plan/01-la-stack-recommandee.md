<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 1. La stack recommandée

Vocabulaire :
- **SDK** : bibliothèque officielle pour appeler un service depuis son code.
- **Messages API** : l'API de base de Claude. On envoie des messages, on reçoit une réponse.
- **Sous-agent** (Claude Code) : un « assistant spécialisé » décrit dans un fichier Markdown, que Claude Code lance avec son propre contexte.
- **Plugin / marketplace** : un plugin regroupe des sous-agents et des skills. Un marketplace est un catalogue de plugins, ici notre dépôt GitHub.
- **SSE** (*Server-Sent Events*) : le serveur garde une connexion HTTP ouverte et pousse des messages au navigateur, dans un seul sens.
- **Zod** : bibliothèque qui vérifie qu'un objet JSON a exactement la forme attendue.

| Couche | Outil recommandé | Rôle | Alternative (et quand la choisir) | Source |
|---|---|---|---|---|
| Langage | TypeScript strict, Node 22+ (Node 20 n'est plus maintenu depuis le 30/04/2026 ; l'image Docker utilise Node 24) | Un seul langage pour le moteur, le CLI, le web | — | [S9] |
| Appels LLM (web + CLI mode API) | **Messages API** via `@anthropic-ai/sdk` | Le code décide chaque appel : orchestration déterministe, parallélisme maîtrisé, coût mesuré par appel | **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) : embarque le binaire Claude Code et sa boucle d'agent. Utile pour réutiliser les sous-agents du plugin sans terminal, mais c'est le LLM qui pilote la boucle → moins déterministe et plus lourd | [S8][S9][S10] |
| Sorties JSON | **Structured outputs** (`output_config.format`) via `zodOutputFormat` + `messages.parse`, et validation Zod | Le modèle est contraint à produire un JSON conforme au schéma ; Zod revalide côté code. **Incompatible avec les citations** : les agents qui cherchent sur le web font la recherche puis un 2ᵉ appel de mise en forme | *Strict tool use* (`strict: true`) : un outil « rendre_verdict » dont l'entrée est le JSON | [S11][S27][S29] |
| Recherche web des agents | **Outil web search de l'API Claude** + **web fetch** | Recherche côté serveur, **citations natives** (URL + passage cité) que le vérificateur peut contrôler ; une seule clé pour l'utilisateur | **Tavily** (1 000 crédits gratuits/mois, puis 0,008 $/crédit) via un adaptateur `SearchProvider`, si on veut réduire le coût ou **filtrer le contenu web avant** qu'il atteigne le modèle. Brave (5 $/1 000 requêtes, 5 $ offerts/mois) et Exa (7 $/1 000) sont d'autres options | [S2][S3][S4][S5][S6][S7] |
| Modèles | **Sonnet 5.5** (greffier + 5 jurés), **Opus 5.5** (Juge) | Sonnet : 2 $/10 $ par million de tokens ; Opus : 4 $/20 $ | Haiku 5.5 (0,10 $/0,50 $) pour un mode « rapide » ou pour le greffier | [S1] |
| Version terminal | **Plugin Claude Code** : `agents/`, `skills/`, `.claude-plugin/plugin.json` | Installe les sous-agents et la commande `/tribunal:juger` en une fois | **Skill seule** copiée dans `.claude/skills/` (approche de Claude Court) : plus simple, mais pas de mise à jour ni de sous-agents packagés | [S12][S13][S14][S20] |
| Sous-agents Claude Code | Fichiers `.md` avec en-tête YAML (`model: sonnet` / `opus`, `tools: …`) | Chaque juré est un sous-agent ; ses outils sont limités | Option `--agents` en JSON (pratique pour tester, pas pour distribuer) | [S13] |
| Interface web | Next.js App Router + Tailwind + shadcn/ui | Salle d'audience, formulaire, rapport | Vite + React (si on renonce aux routes serveur intégrées) | — |
| Direct (salle d'audience) | **SSE** depuis un *Route Handler* Next.js (`ReadableStream`) | Pousse les événements (recherche lancée, source trouvée, vote scellé…) | Interrogation périodique (*polling*) de la base toutes les secondes : plus simple, moins fluide | [S16][S17] |
| Stockage | SQLite + Drizzle | État de chaque phase, événements, reprise après panne | Fichiers JSON dans `.tribunal/` (c'est ce que fait le plugin) | — |
| PDF | `@react-pdf/renderer` 4.x (MIT) | Rapport généré côté serveur ou CLI, sans navigateur | Playwright « imprimer en PDF » d'une page HTML : rendu plus fidèle, mais installe un navigateur | [S18] |
| Tests | Vitest | Tests unitaires, garde-fous piégés, procès complet en MOCK | Jest | — |
| Hébergement | **Local** (`npm run dev`) | Pas de limite de durée, coût nul pour vous | **Vercel Pro** : 300 s par défaut, 800 s maximum, 1 800 s en bêta (Fluid compute). Le plan **Hobby plafonne à 300 s**, trop juste pour un procès entier | [S19] |

### Vérifié / hypothèse

- **Vérifié (lien en Sources)** : tous les prix, limites et noms de paramètres du tableau ; la règle sur la connexion claude.ai ; la structure des plugins ; les durées Vercel.
- **Mes hypothèses [H]** :
  - le web search natif est le meilleur choix **par défaut** parce qu'il fournit des citations exploitables. À réévaluer si le coût par procès dépasse 2 $ ;
  - SSE + base de données suffit pour le direct (pas besoin de WebSocket) ;
  - un procès tient en 4 à 8 minutes (H6).

### Inspiration (sans copie)

Le skill open source **Claude Court** (MIT) fait juger une idée par un jury de 12 Claude. Il confie toute la tenue des comptes à un script (`court.py`) et lance des sous-agents. Un procès complet y représente 17 appels de sous-agents, qui comptent dans le forfait de l'utilisateur [S20]. On retient deux **principes** : un script tient le greffe (l'état), et les sous-agents ne font que leur tâche. Ni le code, ni les textes, ni le design ne sont repris.

---
