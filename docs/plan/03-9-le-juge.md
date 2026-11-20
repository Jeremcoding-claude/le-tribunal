<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 3.9 Le Juge

| | |
|---|---|
| Rôle | Présider. **Ne vote pas.** Arbitre les contradictions, corrige le plan, fait revoter. |
| Personnalité, ton | Solennel, impartial, sévère. Vouvoie. Structure : « Attendu que… Par ces motifs… ». |
| Modèle | **Opus 5.5** |
| Outils | **Aucun.** Il ne lit que des éléments **déjà vérifiés**. Il ne peut pas introduire de chiffre nouveau. |
| Entrées | CaseFile, les 5 dossiers vérifiés, le débat, les statistiques du vote 1 (calculées par le code), le tableau du Comptable, les **propositions du tour 2** (vérifiées) et la **liste classée des objections** (`objections.ts`). |

Sortie (`Ruling`) :

```json
{
  "contradictions": [{
    "id": "JUG-C1",
    "entre": ["investisseur", "cliente"],
    "sujet": "Capacité des restaurateurs à payer 149 €/mois",
    "position_retenue": "cliente",
    "attendu": "Attendu que la marge nette du secteur (CLI-1) …",
    "appuis": ["CLI-1", "CPT-L3"]
  }],
  "reponses_objections": [
    { "objection": "CLI-O1", "decision": "changement | refus", "justification": "…", "appuis": ["CLI-1"] }
  ],
  "plan_corrige": {
    "changements": [{
      "champ": "prix | cible | offre | canal | zone | modele",
      "avant": "149 €/mois, tous restaurants",
      "apres": "…",
      "repond_a": ["CLI-O1", "CPT-A2"],
      "source": "CLI-P1 | juge",
      "justification": "…",
      "appuis": ["CLI-1", "CPT-L10"]
    }],
    "case_file_v2": { "...": "même schéma que CaseFile" }
  },
  "conditions_pour_lancer": [
    { "condition": "Obtenir X restaurants pilotes payants", "mesurable": true, "appuis": ["CPT-L10"] }
  ],
  "par_ces_motifs": "Texte court, solennel, sans nouveau chiffre."
}
```

**Comment le Juge rédige le plan corrigé :**
1. Le code classe les objections (`objections.ts`) : nombre de jurés qui la soutiennent × poids (un juré NO-GO compte 2, PIVOT 1,5, GO 1) [H]. Les 5 premières sont transmises au Juge.
2. Le Juge doit **répondre aux 3 premières** : soit un changement de plan, soit une justification écrite du refus.
3. **Au plus 3 changements**, chacun sur un champ précis (`prix`, `cible`, `offre`, `canal`, `zone`, `modele`), avec « avant », « après », les objections auxquelles il répond et sa **source** : l'id d'une **proposition du tour 2** qu'il retient ou, à défaut, `juge` avec une justification. Le code vérifie l'appui de chaque source (G11).
4. Il produit un `case_file_v2` complet. Le code vérifie que seuls les champs annoncés ont changé.
5. Tout nombre du plan corrigé doit venir d'une affirmation vérifiée ou d'une ligne du Comptable. Un nouveau prix est autorisé s'il est fondé sur des faits (ex. « prix acceptable » de la Cliente).

---
