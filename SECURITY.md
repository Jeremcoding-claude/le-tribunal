# Sécurité

## Signaler un problème
Écrivez-nous en privé (onglet « Security » → « Report a vulnerability » du dépôt GitHub) ; n'ouvrez pas d'issue publique pour une faille.

## Fuite de clé API
Si vous pensez avoir vu une clé dans un journal, un événement, un PDF, un fichier `.tribunal/`, l'image Docker ou le navigateur :
1. **Révoquez la clé immédiatement** dans la console Anthropic et créez-en une nouvelle.
2. Signalez-le comme ci-dessus, avec le fichier et l'étape qui l'a produit (sans recopier la clé).

## Ce que le projet garantit
La clé reste côté serveur (variable d'environnement), n'est jamais envoyée au navigateur, ni écrite en base, ni dans les journaux, événements et rapports (tests `G8`, `G13`). En mode réel, un mot de passe d'accès est exigé. Ne publiez jamais le conteneur en HTTP simple sur Internet : utilisez un proxy HTTPS (`deploy/`).
