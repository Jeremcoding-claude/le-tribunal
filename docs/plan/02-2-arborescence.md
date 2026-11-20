<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 2.2 Arborescence

```text
le-tribunal/
├── .claude-plugin/
│   └── marketplace.json          # fait du dépôt un marketplace (lien 2)
├── plugin/                        # le plugin Claude Code
│   ├── .claude-plugin/plugin.json
│   ├── skills/juger/SKILL.md     # la commande /tribunal:juger
│   ├── agents/                    # GÉNÉRÉ depuis prompts/
│   │   ├── greffier-enquete.md    # appelé tribunal:greffier-enquete (+ greffier-redaction.md)
│   │   ├── investisseur.md … juge.md   # tribunal:investisseur … tribunal:juge
│   └── bin/tribunal.mjs           # GÉNÉRÉ : moteur + CLI en un fichier
├── prompts/                       # SOURCE UNIQUE des personnages
│   ├── _commun.md                 # règles communes à tous les agents
│   ├── greffier-enquete.md  greffier-redaction.md  mise-en-forme.md
│   ├── investisseur.md  comptable.md  juriste.md
│   ├── concurrent.md  cliente.md  juge.md
│   └── agents.config.ts           # modèle, outils, max recherches par agent
├── src/
│   ├── lib/                       # LE MOTEUR (aucun import de Next.js)
│   │   ├── schemas.ts             # tous les schémas Zod
│   │   ├── trial/
│   │   │   ├── state-machine.ts   # ordre des phases, transitions autorisées
│   │   │   ├── intake.ts          # découpage de la saisie (nom, offre, cible, prix, ville, problème)
│   │   │   ├── questions.ts       # P1b : 2 questions fixes au plus
│   │   │   ├── phases/            # depot, mise-en-etat, instruction, debat, correction, revote, verdict
│   │   │   ├── tally.ts           # moyennes, écart-type, quorum, majorité, égalité
│   │   │   ├── ledger.ts          # les calculs du Comptable, ligne par ligne
│   │   │   ├── verifier.ts        # aucun chiffre sans source vérifiée
│   │   │   ├── objections.ts      # classement des objections pour le Juge
│   │   │   ├── prononce.ts        # texte fixe de Nadia au verdict, nombres fournis par tally.ts (candidat)
│   │   │   ├── persona-prenom.ts  # règle du prénom de la Cliente (candidat)
│   │   │   └── replique-cliente.ts  # chiffres permis dans les répliques de la Cliente (candidat)
│   │   ├── llm/
│   │   │   ├── client.ts          # Messages API (vrai)
│   │   │   ├── mock.ts            # rejoue les fixtures (MOCK)
│   │   │   └── usage.ts           # tokens, recherches, coût en $
│   │   ├── search/                # adaptateurs : native | tavily | mock
│   │   ├── registry/              # pièces du greffe : fr.ts (registre), geo-fr.ts (commune), mock
│   │   ├── guardrails/
│   │   │   ├── config.ts          # TOUTES les limites
│   │   │   ├── sanitize.ts        # contenu web = donnée
│   │   │   ├── numbers.ts         # extraction et comparaison des nombres
│   │   │   ├── neutrality.ts      # anti-complaisance
│   │   │   ├── consensus.ts       # anti-consensus artificiel
│   │   │   ├── budget.ts          # plafond de coût
│   │   │   └── redact.ts          # masque la clé API partout
│   │   ├── prompts/loader.ts      # lit prompts/*.md, assemble les messages, remplace <!-- PRENOMS -->
│   │   ├── env.ts                 # SEUL endroit qui lit process.env (validation Zod)
│   │   ├── store/                 # sqlite (web) | fichiers (plugin)
│   │   └── pdf/Report.tsx
│   ├── cli/tribunal.ts            # start | next | submit | run | report | resume
│   ├── components/{salle,audience}/   # scène 3D, repli 2D, journal d'audience (section 12)
│   └── app/                       # Next.js : pages + /api
├── fixtures/restaurants/          # réponses MOCK du cas de référence
├── Dockerfile  docker-compose.yml  .dockerignore   # déploiement (section 11)
├── deploy/                        # exemples Caddy et nginx (§11.5)
├── scripts/build-plugin.ts
└── tests/{unit,guardrails,e2e}/
```
