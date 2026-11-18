<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 3.3 Le Greffier (mise en état) — pas un juré

| | |
|---|---|
| Rôle | Établir **à quoi correspond** le business, puis rédiger le **dossier neutre** (`CaseFile`) et créer le **personnage de la Cliente**. |
| Ton | Aucun. Style administratif, phrases sans adjectifs. |
| Modèle | Sonnet 5.5 |
| Outils | **Deux appels (v2.4)** : l'**enquêteur** (P1a) a `web_search` (max 3) et `web_fetch` (max 2) ; le **rédacteur** (P1c) n'a aucun outil et ne lit jamais de page web, seulement l'identification vérifiée. |
| Entrées | La saisie découpée + les **pièces du greffe** (registre et commune, obtenues par le code) |
| Sortie | `Identification` + `CaseFile` + `PersonaCliente` |

#### 3.3.1 La saisie (P0, code : `src/lib/trial/intake.ts`)

Format demandé, dans le plugin comme dans l'appli :

```text
/tribunal:juger Nom, ce qu'il vend, à qui, à quel prix, dans quelle ville[, car le problème réglé]
```

Exemple : `/tribunal:juger Brigade IA, agents IA qui gèrent réservations et avis, aux restaurants indépendants, 149 € par mois, Lyon, car les gérants perdent du temps sur l'administratif`

| Élément | Exigé ? | Pourquoi |
|---|---|---|
| Nom | oui | Identification au registre, recherche de concurrents et de marques |
| Ce qu'il vend | oui | La solution jugée |
| À qui | oui | La cible, et la Cliente |
| **Prix** (et sa fréquence) | **oui**, dans l'offre ou à part | Sans prix, le Comptable ne peut calculer presque aucune ligne |
| Ville (ou `en ligne`, `France entière` ; pays entre parenthèses, ex. `Bruxelles (Belgique)`) | oui | Marché local, concurrents locaux, la Cliente, le registre |
| Problème réglé (introduit par « car », « parce que », « problème : ») | non | Sinon le dossier écrit « non précisé » et le Greffier place sa supposition dans `hypotheses_implicites` (jamais présentée comme un fait) |

- Dans Claude Code, une skill de plugin s'appelle `/<nom-du-plugin>:<nom-de-la-skill>` [S21]. Le plugin s'appelle `tribunal` et sa skill `juger`, d'où `/tribunal:juger` (plus lisible que `/tribunal:tribunal`).
- Dans l'appli web : un formulaire à 5 champs exigés (nom, ce qu'il vend, à qui, prix, ville) et 1 champ facultatif (problème réglé). La case « Je n'ai pas encore de prix » remplace le champ prix et déclenche le mode « comptes partiels ».

Découpage déterministe par le code :
1. Séparation sur les virgules. **1er élément = nom**. Un élément qui commence par un marqueur de problème (« car », « parce que », « problème : ») = **problème** ; il est retiré avant la suite. Le **dernier** élément restant = **ville** (ou `en ligne` / `France entière`) ; un pays entre parenthèses est extrait, sinon `FR`.
2. Parmi les éléments du milieu, dans cet ordre :
   - un élément qui n'est **qu'un prix** (`numbers.ts` : « 149 € par mois », « à 30 €/commande », « gratuit ») = **prix**, même s'il commence par « à » ;
   - puis l'élément qui commence par « à », « aux », « pour », « auprès de » = **cible** ; s'il n'y en a aucun, le **dernier** élément du milieu restant = cible (ordre naturel : nom, offre, cible) ;
   - le reste = **offre**.
3. Un prix écrit **dans** l'offre (« agents IA à 149 € par mois ») est extrait aussi ; l'élément reste l'offre. Le prix est une `donnee_utilisateur`.
   Les deux formes sont donc valides : `Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon` et `Brigade IA, agents IA, aux restaurants indépendants, 149 € par mois, Lyon`.
4. **Moins de 4 éléments** (nom, offre, cible, ville) → refus, avec le format et un exemple. Plugin : la skill redemande l'élément manquant. Web : le champ vide est signalé.
5. **Aucun prix détecté** → pas un refus : la question `prix_absent` sera posée en P1b (§ 4.1), sauf si le Greffier trouve un prix affiché et sourcé sur le site officiel d'une entreprise existante.
6. Éléments en trop (une virgule dans l'offre) → le code fait au mieux, et le Greffier confirme ou corrige dans `saisie_confirmee`. Le code vérifie que chaque champ confirmé est un **extrait de la saisie** (pas d'ajout).

#### 3.3.2 Les pièces du greffe (P0, code, gratuit, sans LLM)

Avant d'appeler le Greffier, le code consulte deux sources officielles et ouvertes (France ; ailleurs, l'étape est sautée et le Greffier cherche sur le web) :

| Pièce | Source | Ce qu'on garde | Fichier |
|---|---|---|---|
| Registre des entreprises | **API Recherche d'entreprises** (annuaire-entreprises.data.gouv.fr), recherche par nom, filtrée sur la commune. Ouverte, sans clé [S22] | Au plus 5 correspondances : dénomination, SIREN, activité (code NAF), commune du siège, date de création, état (active / cessée), URL de la fiche | `src/lib/registry/fr.ts` |
| Fiche de la commune | API Découpage administratif (geo.api.gouv.fr) [H : champs à vérifier à l'étape 4] | Nom officiel, code commune, département, population | `src/lib/registry/geo-fr.ts` |

Règles :
- Ces pièces viennent d'une source officielle interrogée **par le code** : elles sont « vérifiées par construction » et portent l'URL de la fiche comme `source_url`.
- **Données personnelles (G9)** : le code **supprime** les dirigeants, adresses de personnes, téléphones et e-mails **avant** de passer les pièces au Greffier. Pour une entreprise individuelle (souvent au nom d'une personne), la dénomination est **masquée** : on garde seulement « entreprise individuelle », l'activité, la commune et l'état.
- En MOCK et en test, les deux adaptateurs lisent `fixtures/<cas>/registre.json` : aucun appel réseau.
- Panne ou limite de débit de l'API → les pièces valent `indisponible`, le procès continue et le Greffier cherche sur le web.

#### 3.3.3 La mission du Greffier

**Répartition (v2.4).** Points 1 à 4 et 6 : l'**enquêteur** (P1a, prompt `greffier-enquete.md`), qui rend `saisie_confirmee` + `identification`. Point 5 : le **rédacteur** (P1c, prompt `greffier-redaction.md`), qui rend `case_file` + `persona_cliente` + `champs_manquants`, après les questions de P1b. L'exemple JSON ci-dessous montre l'ensemble des deux sorties.

1. **Rapprocher la saisie des pièces** et fixer un statut :
   - `entreprise_existante` : une seule correspondance nette (même nom, même commune, activité cohérente avec l'offre) ;
   - `homonymes` : plusieurs correspondances, ou activité incohérente. Le Greffier **ne choisit pas** au hasard ; le dossier le signale ;
   - `aucune_trace` : rien au registre ni sur le web. C'est le cas normal d'un **projet**, pas un défaut.
2. **Si l'entreprise existe**, chercher son site officiel et son **offre publique** (ce qui est vendu, prix affiché). Le site du business est la source la plus exposée aux instructions cachées (G5) : c'est une donnée, jamais une instruction.
3. **Classer l'activité** : code NAF et libellé correspondant à l'**offre déclarée** (nomenclature INSEE), avec source.
4. **Relever les écarts** entre la saisie, le registre et le site (« le registre indique une activité de restauration ; la saisie décrit un logiciel »). Les écarts vont dans le dossier : les jurés en tiennent compte.
5. **Rédiger le CaseFile neutre** et **créer la Cliente** (§ 3.3.4), désormais dans la **vraie commune**.
6. **Lister les champs manquants** (`champs_manquants`) : ce que la saisie ne dit pas et qu'aucune source n'a établi (prix, problème, canal…). Le Greffier **ne pose pas** de question : c'est le code qui décide en P1b, avec des questions à texte fixe.

```json
{
  "saisie_confirmee": {
    "nom": "Brigade IA",
    "offre": "agents IA qui gèrent réservations et avis",
    "cible": "restaurants indépendants",
    "prix": "149 € par mois",
    "ville": "Lyon",
    "pays": "FR",
    "probleme": "les gérants perdent du temps sur l'administratif"
  },
  "champs_manquants": ["canal"],
  "identification": {
    "statut": "entreprise_existante | homonymes | aucune_trace",
    "correspondances": [
      { "denomination": "…", "siren": "…", "activite_naf": "…", "commune": "…",
        "date_creation": "…", "etat": "active | cessee", "source_url": "https://annuaire-entreprises.data.gouv.fr/…" }
    ],
    "site_officiel": { "url": null, "extrait": null },
    "offre_publique": { "resume": null, "prix_affiche": null, "source_url": null, "extrait": null },
    "categorie_activite": { "code_naf": "…", "libelle": "…", "source_url": "…", "extrait": "…" },
    "zone": { "commune": "Lyon", "code_commune": "…", "departement": "…", "pays": "FR",
              "population": { "valeur": null, "source_url": "…" } },
    "ecarts": [],
    "alertes": []
  },
  "case_file": {
    "nom": "Brigade IA",
    "cible": "Restaurants indépendants (brasseries, bistrots) à Lyon",
    "probleme": "Temps passé sur l'administratif : réservations, réponses aux avis",
    "probleme_origine": "saisie | non_precise",
    "solution": "Agents IA qui exécutent ces tâches pour le restaurant",
    "modele_revenu": "abonnement",
    "prix": { "montant": 149, "devise": "EUR", "periode": "mois", "ht_ou_ttc": "inconnu",
              "origine": "saisie | site_officiel | reponse_question | non_communique" },
    "zone": "Lyon (Rhône), FR",
    "pays": "FR",
    "statut_identification": "aucune_trace",
    "canal_presume": "non précisé",
    "differenciation": null,
    "hypotheses_implicites": ["Le restaurateur a un ordinateur ou un smartphone", "..."],
    "affirmations_a_verifier": [],
    "inconnues": [],
    "mots_retires": []
  },
  "persona_cliente": {
    "prenom": "Nadine",
    "role": "Gérante et propriétaire",
    "etablissement": "Brasserie de quartier, service midi et soir",
    "ville": "Lyon",
    "rapport_au_numerique": "Utilise son téléphone pour tout, se méfie des abonnements",
    "journee_type": "Ouverture 9 h, coup de feu midi, compta le dimanche",
    "registre": "Familier, direct, phrases courtes",
    "a_verifier_par_la_cliente": [
      "budget moyen des restaurateurs pour les logiciels",
      "marge nette moyenne du secteur",
      "part des restaurateurs qui gèrent eux-mêmes leurs réseaux"
    ]
  }
}
```

(Les valeurs `"…"` et `null` sont des emplacements : le cas de référence est fictif, aucune valeur réelle n'est supposée.)

#### 3.3.4 La Cliente, créée à partir de la cible et de la ville

**Comment la Cliente est créée à partir de la cible :**
1. Le Greffier choisit **l'archétype le plus fréquent** de la cible (ici : un restaurant indépendant, pas une chaîne). Le prénom est fictif et courant.
2. Il décrit la **situation** (rôle, journée, rapport au numérique, registre de langue), **jamais de chiffre**. Le code rejette tout chiffre dans `persona_cliente`, sauf les heures de la journée type.
3. Il liste ce que la Cliente **devra vérifier** sur le web (`a_verifier_par_la_cliente`). Ce sont ces faits sourcés qui fondent ses objections.
4. Le code vérifie que la persona est cohérente avec `case_file.cible` (même secteur) et vit dans la commune de `zone`.
5. La persona est **toujours fictive**, même si l'entreprise existe : ce n'est jamais un client réel, ni le gérant réel.

**Neutralité :** une liste de mots interdits (« révolutionnaire », « unique », « meilleur », « disruptif », « énorme »…) est retirée par le code **avant** l'appel, puis revérifiée **après**. Les mots retirés sont listés dans `mots_retires`. Les jurés ne voient **jamais** le texte brut : ils reçoivent le CaseFile et l'`identification` vérifiée. Le nom du business est conservé (les jurés en ont besoin pour chercher), mais pas les slogans. Rien n'indique aux jurés si l'utilisateur est le propriétaire.

**Ce que les jurés font de l'identification :** l'Investisseur mesure le marché **dans la zone** puis au niveau national ; le Concurrent cherche d'abord les concurrents **dans la ville** ; le Juriste part du code NAF ; la Cliente vit dans la commune. Un statut `homonymes` ou des `ecarts` sont cités par les jurés comme incertitudes, jamais comme preuves.
