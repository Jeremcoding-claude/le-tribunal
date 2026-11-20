<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

### 11.6 Mise en route (5 commandes)

```
cp .env.example .env            # laisser MOCK_MODE=true pour un premier essai
docker compose up -d --build
docker compose ps               # l'état doit passer à « healthy »
curl http://127.0.0.1:3000/api/health
docker compose logs -f          # le journal ne doit contenir aucun secret
```
