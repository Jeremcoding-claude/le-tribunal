<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 4. Le protocole du procès

### 4.1 Les phases

| Phase | Qui | Entre | Sort | Contrôles du code |
|---|---|---|---|---|
| **P0 Dépôt** | Code | Saisie `Nom, offre, cible, prix, ville[, car problème]` (≤ 500 caractères) | `Saisie` découpée + **pièces du greffe** (registre, commune) + `Trial` | 4 éléments présents (nom, offre, cible, ville), prix détecté ou noté absent, longueur, caractères de contrôle, détection d'injection, suppression des données personnelles (G9), budget initialisé |
| **P1a Identification** | Greffier-enquêteur (Sonnet + web : 3 recherches, 2 lectures ; mode API : puis mise en forme) | Saisie + pièces du greffe | `saisie_confirmee` + `Identification` | Zod, vérificateur de sources, statut cohérent avec les pièces, `saisie_confirmee` = extraits de la saisie, aucune donnée personnelle |
| **P1b Questions** | Code (textes fixes) ; l'utilisateur répond | `champs_manquants`, statut d'identification | 0 à 2 `Question` ; puis `CaseFile` complété | Au plus 2 questions, de la liste `GUARDRAILS.questions.autorisees` ; aucun texte de question écrit par un LLM ; réponse au prix lue par `numbers.ts` ; « passer » toujours possible |
| **P1c Mise en état** | Greffier-rédacteur (Sonnet, sans web) | `saisie_confirmee` + `Identification` vérifiée + réponses de P1b | `CaseFile` + `PersonaCliente` + `champs_manquants` | Zod, mots interdits, rien d'ajouté, prix selon son origine, aucun chiffre dans la persona |
| **P2 Instruction** | 5 jurés **en parallèle** (Sonnet + web) | `CaseFile` (+ persona pour la Cliente) | 5 `JurorBrief`, dont **vote 1 scellé** | Zod, vérificateur de sources, nombres libres, cohérence note/verdict ; 1 relance max par juré ; Comptable : appel 1 → `ledger.ts` → appel 2 |
| **P3 Débat** (2 tours) | 5 jurés | Arguments et affirmations **vérifiés** des autres, **sans leurs notes** | `DebateTurn` par juré et par tour | Au moins 1 réplique de type `conteste` par juré et par tour ; au plus 1 recherche nouvelle par tour ; nouvelles affirmations vérifiées |
| **P4 Correction** | Juge (Opus, sans web) | Tout ce qui précède + stats du vote 1 + objections classées | `Ruling` + `case_file_v2` | ≤ 3 changements, réponse aux 3 objections principales, aucun chiffre nouveau |
| **P5 Revote** | 5 jurés en parallèle (Sonnet, sans web) | `case_file_v2`, `Ruling`, **leur propre** vote 1 | `Revote` par juré | `a_change_d_avis` cohérent avec l'écart de note ; si changement, `pourquoi` cite un changement ou un argument |
| **P6 Verdict et rapport** | Code | Votes 1 et 2 | Note avant, note après, verdict, `rapport.pdf` | `tally.ts`, puis génération PDF |

#### Les questions de mise en état (P1b, `src/lib/trial/questions.ts`)

Le code, pas l'IA, décide s'il faut demander quelque chose. Deux questions seulement existent, dans cet ordre, **2 au plus** par procès :

| Code | Quand | Texte exact (fixe) | Réponse |
|---|---|---|---|
| `prix_absent` | Aucun prix dans la saisie, et aucun prix affiché sourcé sur le site officiel | « Quel est le prix, et sa fréquence ? (ex. 149 € par mois, 30 € par commande) » | Texte libre, lu par `numbers.ts`. Illisible → la question est reposée **une** fois. |
| `homonymes` | Le Greffier a rendu `statut: homonymes` | « Plusieurs entreprises correspondent. Laquelle est la vôtre ? » | Choix parmi les correspondances (entreprise individuelle : « entreprise individuelle — activité — commune », sans nom), ou « aucune, c'est un projet ». |

Ce que le code fait de la réponse :
- **Prix** : transmis au Greffier-rédacteur (P1c), qui remplit `case_file.prix` avec `origine: "reponse_question"`. Aucun appel en plus : la rédaction vient après les questions.
- **Homonyme choisi** : statut `entreprise_existante`, correspondance retenue, puis **une seule** relance du Greffier-enquêteur en phase `IDENTIFICATION_COMPLEMENT` (2 recherches, 1 lecture) pour trouver le site et l'offre publique. « Aucune, c'est un projet » → statut `aucune_trace`, sans relance.
- **« Passer » ou pas de réponse** : prix → `prix: null`, `origine: "non_communique"` ; les lignes du Comptable qui en dépendent valent « non calculable », et le rapport affiche **« Prix non communiqué : comptes partiels »**. Homonymes → le statut reste `homonymes`, cité comme incertitude.

Où sont posées les questions :
- **Plugin** : `next` renvoie `{status: "questions"}`. Claude Code les pose **mot pour mot**, puis lance `tribunal answer`. Pas de délai : le procès attend.
- **Web** : événement SSE `questions`, réponse par `POST /api/trials/:id/answers`. Le formulaire exigeant déjà le prix, seule la question `homonymes` apparaît en pratique.
- **Terminal `run --api`** : question dans le terminal, sauf avec `--sans-questions` (tout est « passé »).

Format d'un tour de débat :

```json
{
  "agent": "concurrent", "tour": 1,
  "repliques": [{
    "type": "conteste | concede | precise",
    "vise": "INV-A1",
    "texte": "Ton marché, je le prends en trois semaines avec…",
    "appuis": ["CON-4", "INV-2"]
  }],
  "nouvelles_affirmations": []
}
```

Tour 1 : chacun répond aux arguments des autres. Tour 2 : chacun répond aux répliques qui le visaient.

Format du revote :

```json
{
  "agent": "cliente",
  "vote": { "note": 5.5, "verdict": "PIVOT", "raison_principale": "…", "appuis": ["CLI-1", "JUG-C1"] },
  "a_change_d_avis": true,
  "pourquoi": "Le prix corrigé répond à mon objection CLI-O1.",
  "cite": ["changement:prix", "CLI-O1"]
}
```

(Ces notes sont des **exemples de forme**, pas des résultats.)
