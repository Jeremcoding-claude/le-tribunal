# ⚖️ Le Tribunal

Soumettez une idée de business. Cinq jurés IA cherchent de vrais chiffres sourcés, votent en secret,
débattent, un Juge corrige votre plan, ils revotent. Vous repartez avec une réponse franche
— « Lance », « Modifie ton plan » ou « Ne lance pas » — et un rapport PDF.

Gratuit et open source (MIT). Vous utilisez votre propre accès à Claude.

## Exemple
« Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon » → voir [docs/exemple-rapport.pdf](docs/exemple-rapport.pdf) (procès fictif en mode MOCK).

## Le format
    Nom, ce qu'il vend, à qui, à quel prix, dans quelle ville[, car le problème réglé]
Le prix est exigé : sans lui, les comptes sont partiels. Le problème est facultatif.
Le Greffier vérifie d'abord à quoi correspond le business (registre officiel des entreprises,
site, commune), puis les jurés le jugent.

## Option 1 — Dans Claude Code (le plus simple)
Prérequis : Claude Code et Node.js 22+.

    /plugin marketplace add <votre-compte>/le-tribunal
    /plugin install tribunal@le-tribunal
    /tribunal:juger Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon

Par défaut, le procès utilise votre forfait Claude (environ 24 appels de sous-agents).
S'il manque le prix, ou si plusieurs entreprises portent ce nom, Claude Code vous pose 1 ou 2 questions.
Avec une clé API : ajoutez `--api` (la clé est lue dans `ANTHROPIC_API_KEY`).
En une commande (Claude Code v2.1.275+) : `/plugin install tribunal --marketplace <votre-compte>/le-tribunal`

## Autorisations (à lire avant le premier procès dans Claude Code)
Les jurés cherchent sur le web et écrivent leurs réponses dans `.tribunal/`. En mode normal,
Claude Code demande votre accord pour chaque nouveau site lu, pour la première recherche
et pour la première écriture. Pour un procès sans interruption, créez, dans le dossier où
vous lancez le procès, le fichier `.claude/settings.local.json` (non partagé) :

    { "permissions": { "allow": ["WebSearch", "WebFetch", "Edit(.tribunal/**)"] } }

`WebFetch` autorise la lecture de n'importe quel site. Les jurés n'ont accès à aucun secret et
n'écrivent que dans `.tribunal/`, mais si vous préférez valider chaque site, ne mettez pas cette ligne.

## Option 2 — L'appli web, en local
Prérequis : Node.js 22+. Une clé API Anthropic n'est nécessaire que pour de vrais procès.

    git clone https://github.com/<votre-compte>/le-tribunal
    cd le-tribunal
    npm install
    cp .env.example .env.local     # MOCK_MODE=true : démo sans frais
    npm run dev                    # http://localhost:3000

Sans clé, laissez `MOCK_MODE=true` : tout fonctionne avec des données fictives, sans frais.
Pour de vrais procès : `MOCK_MODE=false`, `ANTHROPIC_API_KEY=…` **et** `TRIBUNAL_ACCESS_TOKEN=…` (16 caractères minimum :
le mot de passe qui protège votre clé). Une valeur douteuse arrête le démarrage.

## Option 3 — Sur un serveur (Docker)
Un seul conteneur, un seul volume (`/data`). Voir le plan §11 (`docs/PLAN.md`).

    cp .env.example .env            # laisser MOCK_MODE=true pour un premier essai
    docker compose up -d --build
    docker compose ps               # l'état doit passer à « healthy »
    curl http://127.0.0.1:3000/api/health
    docker compose logs -f          # le journal ne contient aucun secret

Le port n'est publié que sur `127.0.0.1` : mettez un reverse proxy HTTPS devant (exemples Caddy et nginx dans `deploy/`,
flux SSE sans tampon). Sauvegarde : `docker compose stop`, copier tout `/data` (le `.db` avec ses `-wal` et `-shm`).

## Combien ça coûte ?
Estimation avant mesure : 1,50 à 5 $ par procès en mode API. Plafond par défaut : 6 $ (alerte à 3,50 $, modifiable dans
`src/lib/guardrails/config.ts`). Le mode MOCK et le plugin sur forfait ne facturent aucun appel API.

### Coût mesuré
<!-- COUT-MESURE:DEBUT -->
Aucun procès réel mesuré pour l'instant (voir l'estimation ci-dessus). Mesure : `npm run smoke` puis `npm run cost`.
<!-- COUT-MESURE:FIN -->

## Comment ça marche
Dépôt → Mise en état → Instruction (5 jurés en parallèle, recherche web) → Débat (2 tours)
→ Correction par le Juge → Revote → Verdict et rapport.
Le code enchaîne les phases et calcule les notes. Aucun chiffre sans source vérifiée.

## Limites
- Les sources web peuvent être fausses ou datées : le rapport les cite pour que vous vérifiiez.
- Pas un conseil financier ni juridique.
- Pas de limitation de débit : en mode réel, seul le mot de passe d'accès protège votre clé.
- La salle 3D est décorative ; tout existe aussi en texte.

## Sécurité
Votre clé reste sur votre machine, côté serveur. Elle n'est jamais envoyée au navigateur
ni écrite dans les journaux. Voir [SECURITY.md](SECURITY.md).

## Contribuer
Voir [CONTRIBUTING.md](CONTRIBUTING.md). Les règles du projet sont dans [CLAUDE.md](CLAUDE.md).

## Licence et crédits
MIT. Idée inspirée par le principe du skill open source « Claude Court » (alexyc9381/court-skill),
sans reprise de son code, de ses textes ni de son design.
