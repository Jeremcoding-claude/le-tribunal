<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/03-3-le-greffier-mise-en-etat-pas-un-jure.md`
- `docs/plan/03-9-le-juge.md`
- `docs/plan/04-1-les-phases.md`
- `docs/plan/04-2-le-calcul-de-la-note-globale-tally-t.md`
- `docs/plan/08-la-structure-du-rapport-pdf.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 11 — L'interface « salle d'audience »

**Objectif :** montrer le vrai travail des agents, en direct, comme un procès.

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».
Utilise Tailwind et shadcn/ui. Aucune clé, aucun appel Anthropic côté client.

1. Page d'accueil : 5 champs obligatoires — « Nom du business », « Ce qu'il vend », « À qui »,
   « Prix et fréquence » (ou la case « Je n'ai pas encore de prix »), « Dans quelle ville » (ou « en ligne »)
   — 1 champ facultatif « Quel problème ça règle ? », et le bouton « Ouvrir l'audience ».
   Si l'événement questions arrive (homonymes), afficher le choix et l'envoyer à /answers.
   Avant l'instruction, afficher la carte d'identification du Greffier (existante / homonymes / aucune trace,
   activité, commune, écarts), avec ses sources.
   Mention : « Chaque procès utilise votre clé API ; coût estimé affiché en direct. »
2. Page /proces/[id] :
   - Estrade du Juge en haut ; 5 sièges de jurés (nom, rôle, statut : recherche / vérification / vote scellé / parle).
   - Pendant l'instruction : sous chaque juré, les requêtes de recherche réelles et les domaines des sources
     au fil de l'eau (événements search_performed, source_verified, source_rejected).
   - Votes : « sous scellés » jusqu'à votes_revealed, puis révélation simultanée.
   - Débat : bulles de dialogue dans la voix des personnages, chaque chiffre cliquable vers sa source.
   - Correction : le plan « avant / après » en deux colonnes.
   - Verdict : note avant → note après, phrase finale en grand, bouton « Télécharger le rapport PDF ».
   - Bandeau : phase en cours, minuteur, coût en $ en direct, alertes (sources rejetées, injection détectée).
3. Accessibilité : contrastes AA, l'animation n'est jamais la seule information.
4. Test : rendu de la page en MOCK avec une séquence d'événements enregistrée (fixtures/restaurants/events.json).
```

**Critère de validation :** en MOCK, un procès complet se déroule à l'écran ; chaque chiffre affiché ouvre sa source ; aucune requête réseau du navigateur vers `api.anthropic.com` (onglet Réseau).

---
