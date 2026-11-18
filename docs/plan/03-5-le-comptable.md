<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 3.5 Le Comptable

| | |
|---|---|
| Rôle | Faire les comptes **à voix haute**, ligne par ligne : clients nécessaires, coût d'acquisition, marge, point mort. |
| Personnalité, ton | Expert-comptable méticuleux, un peu pince-sans-rire. Numérote tout : « Ligne 4 : … ». Ne s'emballe jamais. |
| Modèle | Sonnet 5.5 (2 appels) |
| Outils | Appel 1 : `web_search` (max 5), `web_fetch` (max 3). Appel 2 : aucun. |
| Chiffres à chercher | Coût d'acquisition client (**CAC**) pour un logiciel vendu à des TPE ; taux de désabonnement mensuel (**churn**) de logiciels pour TPE ; coût variable par client (prix des tokens selon la grille officielle × consommation **estimée**, hébergement, frais de paiement) ; frais du prestataire de paiement ; charges fixes minimales (outils, assurance). |
| Ce qui fait baisser sa note | Marge brute < 60 % ; ratio **LTV/CAC** < 3 ; retour sur coût d'acquisition (*payback*) > 12 mois ; point mort qui exige une part du SAM > 5 %. Ces seuils sont des **conventions du SaaS [H]**, réglables dans `config.ts`. |

Vocabulaire : **CAC** = ce que coûte l'acquisition d'un client. **Churn** = part des clients qui partent chaque mois. **LTV** = marge totale rapportée par un client sur sa durée de vie. **Point mort** = nombre de clients à partir duquel on ne perd plus d'argent.

**Comment il présente ses calculs ligne par ligne** — en trois temps, parce que **le code calcule, pas le LLM** :

1. **Appel 1 (recherche).** Le Comptable rend des **hypothèses**, chacune sourcée ou fondée sur des faits sourcés :

```json
"hypotheses": {
  "prix_mensuel_ht":        { "valeur": 149,  "ref": "CASE-prix" },
  "cout_variable_mensuel":  { "valeur": null, "ref": "CPT-3" },
  "churn_mensuel_pct":      { "valeur": null, "ref": "CPT-5" },
  "cac":                    { "valeur": null, "ref": "CPT-6" },
  "charges_fixes_mensuelles": { "valeur": null, "ref": "CPT-8" },
  "objectif_remuneration_mensuelle": { "valeur": null, "ref": "CONFIG" }
}
```

(Les valeurs `null` sont remplies par l'agent à partir de ses affirmations ; je ne donne pas de chiffres ici pour ne pas en inventer.)

2. **Le code calcule** (`ledger.ts`) toujours les **mêmes lignes**, avec les mêmes formules :

| Ligne | Calcul (fait par le code) |
|---|---|
| L1 | Prix mensuel HT = P |
| L2 | Coût variable par client et par mois = Cv |
| L3 | Marge unitaire = P − Cv ; taux de marge = (P − Cv) / P |
| L4 | Durée de vie moyenne d'un client = 1 / churn (mois) |
| L5 | LTV = marge unitaire × durée de vie |
| L6 | CAC |
| L7 | Ratio LTV / CAC |
| L8 | Payback = CAC / marge unitaire (mois) |
| L9 | Charges fixes mensuelles = F |
| L10 | **Point mort** = arrondi supérieur de F / marge unitaire (clients) |
| L11 | Clients pour se verser l'objectif R = arrondi supérieur de (F + R) / marge unitaire |
| L12 | Budget d'acquisition pour atteindre le point mort = L10 × CAC |
| L13 | Part du SAM nécessaire = L10 / SAM (SAM venant de l'Investisseur) |
| L14 | Plafond de revenu annuel = SAM × P × 12 |

Chaque ligne garde la trace de ses entrées (`depuis: ["CPT-3", "CPT-5"]`). Si une entrée manque, la ligne vaut « non calculable » : le code n'invente pas.

3. **Appel 2 (lecture à voix haute + vote).** Le Comptable reçoit le tableau calculé. Il le lit en personnage et vote :

```json
"lecture": [
  { "ligne": "L3",  "phrase": "Ligne 3 : voilà ce qu'il vous reste par client, une fois l'IA payée." },
  { "ligne": "L10", "phrase": "Ligne 10 : voilà le nombre de restaurants qu'il faut avant d'arrêter de perdre de l'argent." }
]
```

Le code vérifie que chaque nombre d'une phrase est **exactement** celui de la ligne citée.
