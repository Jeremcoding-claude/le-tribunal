<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 9. L'installation en 2 liens et le README

### 9.1 Les 2 liens

Un seul dépôt GitHub, deux usages [H4] :

**Lien 1 — l'appli web, en local**
`https://github.com/<votre-compte>/le-tribunal`

**Lien 2 — le plugin Claude Code**
Le même dépôt sert de marketplace. Dans Claude Code :
```text
/plugin marketplace add <votre-compte>/le-tribunal
/plugin install tribunal@le-tribunal
```
Ou **en une seule commande** (Claude Code v2.1.275 ou plus récent) :
```text
/plugin install tribunal --marketplace <votre-compte>/le-tribunal
```
Depuis le terminal, sans ouvrir Claude Code : `claude plugin marketplace add <votre-compte>/le-tribunal` puis `claude plugin install tribunal@le-tribunal`.
Dans une session, `/plugin install` ouvre la fiche du plugin : on choisit la portée (pour soi, pour le dépôt, ou ce dossier seulement) [S14][S15].

**Formats vérifiés (16/11/2026)** [S23][S24][S25] :
- `.claude-plugin/marketplace.json` à la racine du dépôt : `name`, `owner.name` et `plugins` obligatoires ; chaque entrée a `name` et `source`. `source` est un chemin relatif depuis la racine (`./plugin`, sans `..`). Le `name` de l'entrée doit être **identique** au `name` de `plugin.json` (`tribunal`).
- `plugin/.claude-plugin/plugin.json` : seul `name` est obligatoire (kebab-case, sans `:` ni espace) ; `version`, `description` et `author.name` évitent des avertissements.
- Contrôle : `claude plugin validate ./plugin` puis `claude plugin validate .` doivent afficher `Validation passed`.
- Le dossier `plugin/bin/` est ajouté au `PATH` de Claude Code pendant que le plugin est actif. Effet secondaire assumé : claude.ai et Cowork n'installent pas un plugin qui a un dossier `bin/` (sans conséquence ici, le plugin vise Claude Code).
- La commande courte `/juger` marche aussi, sauf si une autre commande porte déjà ce nom ; `/tribunal:juger` marche toujours.
