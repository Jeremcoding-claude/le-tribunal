<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## À lire (et rien d'autre)

- `docs/plan/03-3-le-greffier-mise-en-etat-pas-un-jure.md`
- `docs/plan/03-9-le-juge.md`
- `docs/plan/04-1-les-phases.md`
- `docs/plan/04-2-le-calcul-de-la-note-globale-tally-t.md`
- `docs/plan/04-3-qui-voit-quoi.md`
- `docs/plan/08-la-structure-du-rapport-pdf.md`
- `docs/plan/12-1-ce-que-montre-la-capture.md`
- `docs/plan/12-2-ce-qu-on-reprend-ce-qu-on-change.md`
- `docs/plan/12-3-la-salle-phase-par-phase.md`
- `docs/plan/12-4-regles-de-l-interface.md`
- `docs/plan/12-5-technique-hypotheses-a-verifier-au-d.md`
- `docs/plan/12-6-dans-le-conteneur-docker-11.md`
- `docs/plan/12-7-etape-interface-etape-11-de-ce-plan.md`
- `docs/plan/12-8-ce-qui-est-verifie-ce-qui-ne-l-est-p.md`

Ne lis pas `docs/PLAN.md` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.

---

### Étape 11 — L'interface « salle d'audience »

**Objectif :** montrer le vrai travail des agents, en direct, comme un procès, dans la direction artistique de la section 12 (salle 3D décorative, journal d'audience en texte).

```text
Lis CLAUDE.md et les fichiers de docs/plan/ listés dans « À lire ».
Utilise Tailwind et shadcn/ui. Aucune clé, aucun appel Anthropic côté client. Rien de tiers au chargement.
Avant d'écrire la scène : fais lire par un sous-agent la doc officielle de React Three Fiber (réponse de 300 mots) et vérifie
@react-three/fiber v9 avec React 19 dans CE dépôt : un Canvas avec une boîte, puis next build.

1. Pages : accueil, audience/[id] (la salle, en direct ou en rejeu), audiences (la liste, bouton « Supprimer »),
   demo (rejoue fixtures/restaurants/ ; zéro appel payant, même en mode réel).
2. Accueil : un seul champ « Quelle est ton idée de business ? » (intake.ts découpe ensuite la saisie ; le texte brut ne va jamais
   aux jurés), trois idées d'exemple dont le cas de référence (un clic remplit le champ, il ne lance rien), bouton « Juger mon idée »,
   pastille « 6 agents ». Si le prix manque, ou si l'événement questions arrive (homonymes), afficher les questions à texte fixe avec « Passer ».
   Avant l'instruction : bandeau « Le greffier prépare le dossier » et carte d'identification (existante / homonymes / aucune trace,
   activité, commune, écarts), avec ses sources.
   Pied de page : le MODE (« Mode démo (aucun appel payant) » ou « Mode réel »), jamais la clé, son début ni le jeton.
   Mention : « Chaque procès utilise la clé API du serveur ; coût estimé affiché en direct. »
3. La salle (tableau du §12.3) : src/components/salle/ (scène 3D @react-three/fiber chargée côté client seulement par import dynamique,
   repli 2D, personnages.ts, etat.ts = fonction pure « liste d'événements → état de la salle ») et
   src/components/audience/ (journal, bulles et pastilles de source cliquables, enveloppes scellées, plan corrigé, verdict).
   - Instruction : sous chaque juré, les requêtes réelles et les domaines des sources au fil de l'eau
     (search_performed, source_verified, source_rejected). Fin : une enveloppe scellée devant chaque juré.
   - Vote 1 « sous scellés » jusqu'à l'événement vote1_ouvert (début de P4) ; revote : nouvelles enveloppes, ouvertes ensemble (revote_ouvert).
   - Débat : bulles dans la voix des personnages ; au tour 2, une carte « proposition d'amélioration » ; chaque chiffre cliquable vers sa source.
   - Correction : plan v1 → v2 en deux colonnes, champs modifiés surlignés, chacun avec sa source (proposition ou « juge »).
   - Verdict : Nadia « prononce » (texte fixe de prononce.ts), note finale /10 avant → après, répartition du jury, divergence éventuelle,
     rappel « ni conseil financier, ni conseil juridique », bouton « Télécharger le rapport (PDF) ».
   - Bandeau : phase en cours, minuteur, coût en $ en direct, alertes (sources rejetées, injection détectée).
4. Règles du §12.4 : la 3D est décorative (tout existe aussi en texte) ; repli 2D sans WebGL ou avec prefers-reduced-motion ;
   aucun accessoire, couleur ni décor dans un prompt ; jeton d'accès (mode réel) dans un cookie HttpOnly, jamais dans l'adresse ;
   textes en français, tutoiement. Accessibilité : contrastes AA, l'animation n'est jamais la seule information.
5. Tests : tests/unit/salle-etat.test.ts (événements du procès MOCK → état attendu, sans WebGL) ;
   tests/guardrails/vote-scelle-affichage.test.ts (G14) ; rendu de la page en MOCK avec une séquence d'événements enregistrée
   (fixtures/restaurants/events.json). Direct et rejeu passent par le même code d'affichage.
```

**Critère de validation :** en MOCK, un procès complet se déroule à l'écran ; chaque chiffre affiché ouvre sa source ; avant `vote1_ouvert` aucune note n'est dans le flux ; aucune requête réseau du navigateur vers `api.anthropic.com` ni vers un domaine tiers (onglet Réseau) ; la page reste utilisable sans WebGL.

---
