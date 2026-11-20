<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 11.4 Persistance (volume Docker)

- Le compose monte un **volume nommé** `tribunal-data` sur `/data`. Les données survivent à `docker compose down` et aux mises à jour de l'image. Elles disparaissent seulement avec `docker compose down -v`.
- `/data` appartient à l'utilisateur `node` (uid 1000 dans l'image officielle). Avec un dossier monté à la main (« bind mount »), il faut d'abord : `chown 1000:1000 <dossier>`.
- **Un seul conteneur** écrit dans la base. Ne pas lancer deux réplicas sur le même volume.
- Sauvegarde : arrêter le conteneur (`docker compose stop`), copier tout `/data` (le fichier `.db` **avec** ses `-wal` et `-shm`), redémarrer.
- Mise à jour : `git pull`, puis `docker compose up -d --build`. Le volume est conservé.
