<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 12.6 Dans le conteneur Docker (§11)

- Rien à changer au Dockerfile ni au compose : `public/` est déjà copié dans l'image (§11.2), le flux SSE est déjà sans tampon (§11.5), les données restent dans `/data` (§11.4).
- `three` et `@react-three/fiber` servent au navigateur : ils partent dans `.next/static` au build. L'image ne devrait pas grossir de leur taille (HYPOTHÈSE, à mesurer avec `docker images` après le build).
- Sans ressource externe, l'interface reste utilisable sur un réseau fermé (hors appel à l'API Claude en mode réel).
