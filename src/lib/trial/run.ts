// runTrial : le CODE enchaîne les phases P0 → P6, émet les événements, sauvegarde après chaque phase (reprise possible).
// Aucun appel réseau par lui-même : tout passe par le client LLM (MOCK ou réel) et les sources du greffe injectés.

import pLimit from "p-limit";
import { GUARDRAILS } from "../guardrails/config";
import type { LlmClient } from "../llm/types";
import { SuiviUsage } from "../llm/usage";
import type { SourcesRegistre } from "../registry";
import type { TrialEvent } from "../schemas";
import type { Store } from "../store/types";
import { creerStoreMemoire } from "../store/memoire";
import { correction } from "./phases/correction";
import { creerEmetteur, ProcesError, type Contexte, type Etat } from "./phases/contexte";
import { debat } from "./phases/debat";
import { depot, SaisieIncomplete } from "./phases/depot";
import { identification, miseEnEtat, questions } from "./phases/mise-en-etat";
import { instruction } from "./phases/instruction";
import { revote, verdict } from "./phases/revote";
import type { Repondre } from "./questions";
import { estFinal, PHASES_PROCES, phaseSuivante, transition, type EtatProces, type PhaseProces } from "./state-machine";

export interface OptionsProces {
  client: LlmClient;
  sources: SourcesRegistre;
  store?: Store;
  id?: string;
  /** Réponses aux questions de mise en état. Absent : tout est « passé ». */
  repondre?: Repondre;
  /** Reprend un procès sauvegardé (phase suivante du dernier point de sauvegarde). */
  reprendre?: boolean;
  /** S'arrête après cette phase (tests de reprise). */
  arretApres?: PhaseProces;
  now?: () => string;
}

export type StatutProces = "termine" | "ajourne" | "interrompu" | "echec" | "budget_depasse" | "saisie_incomplete";

export interface ResultatProces {
  id: string;
  statut: StatutProces;
  etat?: Etat;
  message?: string;
  evenements: TrialEvent[];
}

const NOMS: Record<PhaseProces, (ctx: Contexte, etat: Etat) => Promise<void>> = {
  P0: depot,
  P1a: identification,
  P1b: questions,
  P1c: miseEnEtat,
  P2: instruction,
  P3: async (ctx, etat) => {
    await debat(ctx, etat, 1);
    await debat(ctx, etat, 2);
  },
  P4: correction,
  P5: revote,
  P6: verdict,
};

export async function runTrial(texte: string, o: OptionsProces): Promise<ResultatProces> {
  const store = o.store ?? creerStoreMemoire();
  const id = o.id ?? `t-${Date.now().toString(36)}`;
  const existants = await store.evenements(id);
  const ctx: Contexte = {
    id,
    client: o.client,
    sources: o.sources,
    store,
    suivi: new SuiviUsage(),
    repondre: o.repondre,
    limite: pLimit(GUARDRAILS.concurrency),
    emit: creerEmetteur(store, id, existants.length, o.now),
  };

  let etat: Etat = { id, texte, phase: "DEBUT" };
  if (o.reprendre) {
    const dernier = await store.dernierEtat(id);
    if (!dernier) return { id, statut: "echec", message: `Aucun point de sauvegarde pour ${id}.`, evenements: existants };
    etat = dernier.etat as Etat;
  }
  const fini = async (statut: StatutProces, message?: string): Promise<ResultatProces> => ({ id, statut, etat, message, evenements: await store.evenements(id) });

  try {
    for (let phase = phaseSuivante(etat.phase); phase !== null; phase = phaseSuivante(etat.phase)) {
      transition(etat.phase, phase);
      await ctx.emit({ type: "phase_started", phase });
      await NOMS[phase](ctx, etat);

      // Vote 1 sans quorum : procès ajourné, rapport partiel (pas de débat ni de correction).
      if (phase === "P2" && Object.keys(etat.votes1 ?? {}).length < GUARDRAILS.tally.quorum) {
        etat.phase = "P5";
        etat.votes2 = {};
        await ctx.emit({ type: "phase_started", phase: "P6" });
        await verdict(ctx, etat);
        etat.phase = "AJOURNE" as EtatProces;
        await store.sauvegarder(id, "AJOURNE", etat);
        return fini("ajourne");
      }
      etat.phase = phase;
      etat.coutUsd = ctx.suivi.total().coutUsd;
      await store.sauvegarder(id, phase, etat);
      if (o.arretApres === phase) return fini("interrompu");
    }
    etat.phase = "TERMINE";
    await store.sauvegarder(id, "TERMINE", etat);
    return fini(etat.resultat?.verdictJury === "AJOURNE" ? "ajourne" : "termine");
  } catch (e) {
    if (e instanceof SaisieIncomplete) return { id, statut: "saisie_incomplete", message: e.message, evenements: await store.evenements(id) };
    const message = (e as Error).message;
    const code = e instanceof ProcesError ? e.code : "echec";
    await ctx.emit({ type: "error", code, message, phase: etat.phase !== "DEBUT" && !estFinal(etat.phase) ? (etat.phase as PhaseProces) : null });
    return fini(code === "budget_depasse" ? "budget_depasse" : "echec", message);
  }
}

export { PHASES_PROCES };
