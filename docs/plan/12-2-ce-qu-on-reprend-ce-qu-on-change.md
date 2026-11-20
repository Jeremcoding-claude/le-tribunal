<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 12.2 Ce qu'on reprend, ce qu'on change

| Élément | Décision pour Le Tribunal |
|---|---|
| Titre et pastille | « Le Tribunal » (nom du projet). Pastille en haut à droite : « 6 agents » |
| Champ unique | Un seul champ. `intake.ts` découpe ensuite la saisie (nom, offre, cible, prix, ville, problème). Le texte brut ne va jamais aux jurés (§4.3) |
| Trois idées d'exemple | Trois idées prêtes, dont le cas de référence (agents IA pour restaurants, 149 € par mois, Lyon). Les deux autres sont à écrire par nous : les exemples de la capture sont tronqués, on ne les copie pas. Un clic remplit le champ, il ne lance rien |
| « avec ton abonnement Claude » | **Écart avec le plan** : le plan n'a pas de mode « abonnement ». L'appli web appelle l'API avec la clé du serveur (§11.3). Le pied de page affiche le **mode** : « Mode démo (aucun appel payant) » ou « Mode réel ». Jamais la clé, son début, ni le jeton |
| « Voir la démo » | Rejoue le cas de référence depuis `fixtures/restaurants/`. Zéro appel payant, même en mode réel (HYPOTHÈSE) |
| « Mes audiences (N) » | Liste des procès enregistrés dans SQLite (`/data`, §11.1), avec un bouton « Supprimer ». HYPOTHÈSE : pas de comptes ; une instance = une liste, partagée par toutes les personnes qui ont le jeton. La page le dit, car les idées sont stockées sur le serveur de celui qui héberge |
| Scène, robots, accessoires | Direction artistique reprise ; modèles, textures et code **recréés par nous**. Pour réutiliser du code ou des modèles de l'appli de référence, vérifier d'abord sa licence et l'indiquer dans un fichier `NOTICE` |
| Pile de pièces | Gardée : la question du procès est « du cash ? ». HYPOTHÈSE : elle brille pour GO, s'éteint pour NO-GO, reste neutre pour PIVOT |
