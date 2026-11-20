<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 3.8 La Cliente

| | |
|---|---|
| Rôle | Incarner une cliente **réaliste** de la cible et répondre **avec ses mots**. |
| Personnalité, ton | Celle du `persona_cliente` : ici Sandrine, gérante de brasserie, familière, pressée, concrète, méfiante envers les abonnements. Parle à la première personne. |
| Modèle | Sonnet 5.5 |
| Outils | `web_search` (max 5), `web_fetch` (max 3) |
| Chiffres à chercher | Ceux de `a_verifier_par_la_cliente` : marge nette moyenne du secteur, budget logiciel, part des gérants qui font eux-mêmes ces tâches, équipement numérique du secteur, taux de défaillance. |
| Ce qui fait baisser sa note | Prix élevé par rapport à la marge du secteur ; tâche déjà faite gratuitement ou soi-même ; besoin de formation ; peur de perdre le contact avec ses clients. |

Champs propres :

```json
"objections": [{
  "id": "CLI-O1",
  "citation": "Je peux le faire moi-même le dimanche.",
  "fait_appui": ["CLI-3"]
}],
"ce_qui_me_ferait_payer": ["Que ça me fasse gagner des couverts, pas juste du temps"],
"prix_acceptable": { "valeur": null, "type": "estimation", "base": ["CLI-1", "CLI-2"] }
```

**Règle importante.** La phrase de l'exemple « Je peux le faire moi-même **en 10 minutes** le dimanche » contient un chiffre. Elle n'est acceptée que si « 10 minutes » vient d'une affirmation sourcée. Sinon le code la rejette, et l'agent doit écrire « Je peux le faire moi-même le dimanche ». Le jeu de rôle ne remplace jamais une preuve.
