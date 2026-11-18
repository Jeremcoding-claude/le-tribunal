<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 0. En une page

**Ce qu'on construit.** Un outil MIT. L'utilisateur décrit son business en **une phrase** : `/tribunal:juger Nom, ce qu'il vend, à qui, à quel prix, dans quelle ville[, car le problème réglé]`. Nom, offre, cible, ville et prix sont exigés ; s'il manque le prix, le code pose la question. Le Greffier vérifie d'abord à quoi il correspond (entreprise existante ou projet, activité, commune). Six personnages (5 jurés + 1 Juge) la jugent comme dans un procès. Chaque juré est un vrai appel à Claude, qui cherche de vrais chiffres sur le web. Le code enchaîne les phases, calcule les notes et refuse tout chiffre sans source vérifiée. On obtient une note sur 10 avant et après correction du plan, un verdict franc (« lance », « modifie ton plan », « ne lance pas ») et un rapport PDF.

**Deux façons de lancer un procès, un seul moteur :**

| Version | Pour qui | Qui paie les appels | Lien |
|---|---|---|---|
| Plugin Claude Code | Utilisateur de Claude Code | Son **abonnement Claude** (mode « abonnement ») ou sa **clé API** (mode « API ») | Lien 2 |
| Appli web locale | Tout le monde | Sa **clé API Anthropic** uniquement | Lien 1 |

Pourquoi l'appli web exige une clé API : Anthropic n'autorise pas les développeurs tiers à proposer la connexion claude.ai (ni les limites d'un abonnement) dans leurs propres produits, sauf accord préalable. Il faut passer par une clé API. Le plugin, lui, tourne **dans le Claude Code de l'utilisateur** : il consomme donc son forfait, comme n'importe quel sous-agent.

**Les hypothèses que je prends (à confirmer, mais le plan avance sans) :**

| # | Hypothèse | Pourquoi |
|---|---|---|
| H1 | Pays par défaut : France. Langue : français. | Exemple de référence français. |
| H2 | Hébergement v1 : **local uniquement**. | Un procès dure plusieurs minutes. Gratuit pour vous. |
| H3 | Budget de développement : **20 €/mois** d'appels réels maximum. | MOCK partout, vrais appels seulement pour les tests « smoke ». |
| H4 | Un seul dépôt GitHub sert à la fois d'appli web **et** de marketplace du plugin. | Les « 2 liens » pointent vers le même dépôt, deux points d'entrée. |
| H5 | Note sur 10 par pas de 0,5 ; note globale arrondie à 0,1. | Lisible (« 3,4/10 »). |
| H6 | Durée d'un procès : 4 à 8 minutes. | Estimation, à mesurer à l'étape 9. |
| H7 | Cas de référence réécrit au nouveau format : `Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon`. Nom et ville **fictifs**, à remplacer. | La saisie exige désormais un nom et une ville. |

Les hypothèses sont marquées **[H]** dans la suite. Les faits vérifiés renvoient à la section « Sources ».

---
