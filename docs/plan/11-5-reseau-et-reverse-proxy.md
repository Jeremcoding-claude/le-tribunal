<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 11.5 Réseau et reverse proxy

- Le conteneur écoute sur `0.0.0.0:3000` **dans** le conteneur. Le compose le publie sur `127.0.0.1` seulement : il n'est joignable de l'extérieur que par le reverse proxy.
- Le reverse proxy (Caddy ou nginx, exemples dans `deploy/`) fait le HTTPS et publie le port 443. À ne pas publier en HTTP simple sur Internet.
- **Flux SSE (salle d'audience)** : pas de mise en mémoire tampon, lecture longue. nginx : `proxy_buffering off` et `proxy_read_timeout 3600s`. Caddy : `flush_interval -1`. L'appli envoie déjà `X-Accel-Buffering: no` et `Cache-Control: no-cache, no-transform` sur ses flux. Un procès réel dure plusieurs minutes : sans cela, la salle se fige puis se vide d'un coup.
- Sans reverse proxy, sur un réseau local de confiance seulement : remplacer `127.0.0.1:` par rien dans `ports`.
