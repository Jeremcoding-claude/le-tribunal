<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 9.2 Le README (gabarit)

````markdown
# ⚖️ Le Tribunal

Soumettez une idée de business. Cinq jurés IA cherchent de vrais chiffres sourcés, votent en secret,
débattent, un Juge corrige votre plan, ils revotent. Vous repartez avec une réponse franche
— « Lance », « Modifie ton plan » ou « Ne lance pas » — et un rapport PDF.

Gratuit et open source (MIT). Vous utilisez votre propre accès à Claude.

## Exemple
« Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon » → voir docs/exemple-rapport.pdf

## Le format
    Nom, ce qu'il vend, à qui, à quel prix, dans quelle ville[, car le problème réglé]
Le prix est exigé : sans lui, les comptes sont partiels. Le problème est facultatif.
Le Greffier vérifie d'abord à quoi correspond le business (registre officiel des entreprises,
site, commune), puis les jurés le jugent.

## Option 1 — Dans Claude Code (le plus simple)
Prérequis : Claude Code et Node.js 20+.
    /plugin marketplace add <votre-compte>/le-tribunal
    /plugin install tribunal@le-tribunal
    /tribunal:juger Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon
Par défaut, le procès utilise votre forfait Claude (environ 24 appels de sous-agents).
S'il manque le prix, ou si plusieurs entreprises portent ce nom, Claude Code vous pose 1 ou 2 questions.
Avec une clé API : ajoutez --api (la clé est lue dans ANTHROPIC_API_KEY).
En une commande (Claude Code v2.1.275+) : /plugin install tribunal --marketplace <votre-compte>/le-tribunal

## Autorisations (à lire avant le premier procès dans Claude Code)
Les jurés cherchent sur le web et écrivent leurs réponses dans .tribunal/. En mode normal,
Claude Code demande votre accord pour chaque nouveau site lu, pour la première recherche
et pour la première écriture. Pour un procès sans interruption, créez, dans le dossier où
vous lancez le procès, le fichier .claude/settings.local.json (non partagé) :
    { "permissions": { "allow": ["WebSearch", "WebFetch", "Edit(.tribunal/**)"] } }
"WebFetch" autorise la lecture de n'importe quel site. Les jurés n'ont accès à aucun secret et
n'écrivent que dans .tribunal/, mais si vous préférez valider chaque site, ne mettez pas cette ligne.

## Option 2 — L'appli web, en local
Prérequis : Node.js 20+, une clé API Anthropic (console Claude).
    git clone https://github.com/<votre-compte>/le-tribunal
    cd le-tribunal
    npm install
    cp .env.example .env.local     # collez votre clé dans ANTHROPIC_API_KEY, MOCK_MODE=false
    npm run dev                    # http://localhost:3000
Sans clé, laissez MOCK_MODE=true : tout fonctionne avec des données fictives, sans frais.

## Combien ça coûte ?
Coût mesuré : voir « Coût mesuré » (mis à jour par npm run cost).
Estimation avant mesure : 1,50 à 5 $ par procès en mode API. Plafond par défaut : 6 $ (alerte à 3,50 $, modifiable).

## Comment ça marche
Dépôt → Mise en état → Instruction (5 jurés en parallèle, recherche web) → Débat (2 tours)
→ Correction par le Juge → Revote → Verdict et rapport.
Le code enchaîne les phases et calcule les notes. Aucun chiffre sans source vérifiée.

## Limites
- Les sources web peuvent être fausses ou datées : le rapport les cite pour que vous vérifiiez.
- Pas un conseil financier ni juridique.
- Version web : locale uniquement pour l'instant.

## Sécurité
Votre clé reste sur votre machine, côté serveur. Elle n'est jamais envoyée au navigateur
ni écrite dans les journaux. Voir SECURITY.md.

## Contribuer
Voir CONTRIBUTING.md. Les règles du projet sont dans CLAUDE.md.

## Licence et crédits
MIT. Idée inspirée par le principe du skill open source « Claude Court » (alexyc9381/court-skill),
sans reprise de son code, de ses textes ni de son design.
````

---
