// Les noms des événements du flux SSE (champ `event:`). Liste écrite ici, sans importer schemas.ts : le navigateur ne doit pas
// embarquer la configuration du serveur. Un test vérifie qu'elle égale les types de TrialEvent.
export const NOMS_EVENEMENTS = [
  "phase_started",
  "agent_status",
  "questions",
  "answers_received",
  "search_performed",
  "source_verified",
  "source_rejected",
  "identification",
  "cliente_creee",
  "vote_sealed",
  "vote1_ouvert",
  "debate_reply",
  "ruling",
  "revote",
  "revote_ouvert",
  "verdict",
  "cost_update",
  "error",
] as const;
