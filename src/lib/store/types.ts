// Point de sauvegarde après chaque phase (plan v3.0, G7) et journal des événements. Deux implémentations :
// mémoire (tests, web mono-processus) et fichiers `.tribunal/<id>/` (plugin). SQLite arrive à l'étape 10.

import type { TrialEvent } from "../schemas";

export interface Store {
  /** Enregistre l'état complet du procès après une phase (JSON). */
  sauvegarder(trialId: string, phase: string, etat: unknown): Promise<void>;
  /** Le dernier état enregistré, ou null. */
  dernierEtat(trialId: string): Promise<{ phase: string; etat: unknown } | null>;
  ajouterEvenement(trialId: string, e: TrialEvent): Promise<void>;
  evenements(trialId: string): Promise<TrialEvent[]>;
}
