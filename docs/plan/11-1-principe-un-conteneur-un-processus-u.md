<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->

## 11. Déploiement / Infrastructure

> Ajouté le 20/11/2026. L'appli se déploie sur un serveur Linux open source (auto-hébergé) dans **un seul conteneur Docker**. Les valeurs marquées HYPOTHÈSE sont à valider à l'étape 12.

### 11.1 Principe : un conteneur, un processus, un volume

L'appli web (Next.js), la base SQLite, la génération du PDF et le flux d'événements (SSE) tournent dans le **même processus**. Il n'y a ni base de données séparée, ni Redis, ni file de tâches. Le plugin Claude Code (`plugin/`) est l'autre porte d'entrée : il n'est pas dans l'image.

| Quoi | Où | Persistant ? |
|---|---|---|
| Serveur Next.js autonome (`server.js`) | `/app` | Non (dans l'image) |
| Prompts `prompts/`, fixtures `fixtures/`, migrations `drizzle/` | `/app/...` | Non (dans l'image, copiés explicitement) |
| Base SQLite `tribunal.db` (+ `-wal`, `-shm`) | `/data` | **Oui (volume)** |
| Fichiers des procès : PDF, `.tribunal/` | `/data/files` | **Oui (volume)** |
| Clé API, jeton d'accès | variables d'environnement au démarrage | Jamais dans l'image ni dans le volume |
