import { masquerProfond } from "../guardrails/redact";
import type { TrialEvent } from "../schemas";
import type { Store } from "./types";

export function creerStoreMemoire(): Store {
  const etats = new Map<string, { phase: string; etat: unknown }>();
  const events = new Map<string, TrialEvent[]>();
  return {
    async sauvegarder(id, phase, etat) {
      etats.set(id, { phase, etat: masquerProfond(structuredClone(etat)) });
    },
    async dernierEtat(id) {
      const e = etats.get(id);
      return e ? { phase: e.phase, etat: structuredClone(e.etat) } : null;
    },
    async ajouterEvenement(id, e) {
      events.set(id, [...(events.get(id) ?? []), e]);
    },
    async evenements(id) {
      return [...(events.get(id) ?? [])];
    },
  };
}
