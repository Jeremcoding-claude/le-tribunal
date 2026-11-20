// Contexte partagé par les phases : client LLM, sources du greffe, store, événements, coût, et l'état du procès.
// L'état est du JSON pur : il est sauvegardé après chaque phase (G7) et permet de reprendre.

import pLimit from "p-limit";
import type { ZodType } from "zod";
import type { AgentId, Phase } from "../../../../prompts/agents.config";
import { SuiviBudget } from "../../guardrails/budget";
import { GUARDRAILS } from "../../guardrails/config";
import { donneesPersonnelles } from "../../guardrails/privacy";
import { masquerProfond } from "../../guardrails/redact";
import type { LlmClient, LlmEvent, ToolEvidence } from "../../llm/types";
import { LlmError, TacheEnAttente } from "../../llm/types";
import type { PageLue } from "../../search/types";
import type { Question } from "../../schemas";
import { verifierDossierApi, verifierDossierParLecture, type DossierVerifiable, type ResultatVerification } from "../verifier";
import { SuiviUsage, type Usage } from "../../llm/usage";
import { construireMission } from "../../prompts/loader";
import type { SourcesRegistre } from "../../registry";
import type { DebateTurn, EnqueteGreffier, Identification, JurorBrief, LedgerLine, MiseEnEtat, PiecesDuGreffe, Reponses, Revote, Ruling, Saisie, TrialEvent, Vote, AgentJure } from "../../schemas";
import { TrialEvent as TrialEventSchema } from "../../schemas";
import type { Store } from "../../store/types";
import type { Rejet } from "../verifier";
import type { Repondre } from "../questions";
import type { ResultatTally } from "../tally";
import type { EtatProces } from "../state-machine";

export class ProcesError extends Error {
  constructor(
    message: string,
    readonly code: "echec" | "budget_depasse" = "echec",
  ) {
    super(message);
  }
}
/** Une sortie d'agent qui ne passe pas un contrôle du code : l'agent est relancé UNE fois (« 1 relance max par juré »). */
export class ValidationError extends Error {}
/** Le moteur se suspend : des tâches attendent un sous-agent (mode abonnement). */
export class Suspension extends Error {}
/** Les questions de P1b attendent la réponse de l'utilisateur (mode abonnement). */
export class QuestionsEnAttente extends Error {
  constructor(readonly questions: Question[]) {
    super("Questions en attente");
  }
}

/** Après un lot en parallèle : si une tâche attend, tout le lot est enregistré puis le moteur se suspend (jamais « juré absent »). */
export function suspendreSiEnAttente(resultats: PromiseSettledResult<unknown>[]): void {
  if (resultats.some((r) => r.status === "rejected" && r.reason instanceof TacheEnAttente)) throw new Suspension();
}

export interface DossierJure {
  brief: JurorBrief;
  acceptees: string[];
  rejets: Rejet[];
}

export interface Etat {
  id: string;
  texte: string;
  phase: EtatProces;
  saisie?: Saisie;
  pieces?: PiecesDuGreffe;
  enquete?: EnqueteGreffier;
  identification?: Identification;
  reponses?: Reponses;
  miseEnEtat?: MiseEnEtat;
  prenomCliente?: string;
  dossiers?: Partial<Record<AgentJure, DossierJure>>;
  absents?: AgentJure[];
  ledger?: LedgerLine[];
  votes1?: Partial<Record<AgentJure, Vote>>;
  debat?: DebateTurn[];
  ruling?: Ruling;
  votes2?: Partial<Record<AgentJure, Revote>>;
  resultat?: ResultatTally & { texte: string };
  coutUsd?: number;
  /** Tokens et recherches du procès, et coût par phase (annexe B du rapport). */
  usage?: Usage;
  coutParPhase?: Record<string, number>;
  /** Alertes pour le rapport : instructions cachées, arguments recopiés, budget. */
  alertes?: string[];
  /** Mots publicitaires retirés de la saisie avant les appels (G3). */
  motsRetires?: string[];
  /** La saisie après neutralisation (injection et superlatifs retirés) : la référence du « extrait de la saisie ». */
  texteNeutre?: string;
}

type Retire<T> = T extends unknown ? Omit<T, "trial_id" | "seq" | "ts"> : never;
export type EvenementPartiel = Retire<TrialEvent>;

export interface Contexte {
  id: string;
  client: LlmClient;
  sources: SourcesRegistre;
  store: Store;
  suivi: SuiviUsage;
  budget: SuiviBudget;
  /** Mode abonnement : les sources sont vérifiées en relisant les pages (pas de preuves d'outils côté API). */
  lire?: (url: string) => Promise<PageLue>;
  /** « Prénom Nom » des dirigeants vus dans le registre : ils ne doivent apparaître dans aucune sortie (jamais stockés). */
  nomsProteges: string[];
  repondre?: Repondre;
  limite: ReturnType<typeof pLimit>;
  emit(e: EvenementPartiel): Promise<void>;
}

export function creerEmetteur(store: Store, id: string, deja: number, now: () => string = () => new Date().toISOString()) {
  let seq = deja;
  return async (e: EvenementPartiel) => {
    const complet = TrialEventSchema.parse(masquerProfond({ ...e, trial_id: id, seq: seq++, ts: now() }));
    await store.ajouterEvenement(id, complet);
  };
}

const agentEvent = (a: AgentId): "greffier" | "juge" | AgentJure => (a.startsWith("greffier") ? "greffier" : (a as AgentJure | "juge"));
export const agentJure = (a: AgentId): AgentJure => a as AgentJure;

/** Un seul point d'appel aux agents : relie les événements, le coût et le plafond (G6). */
export async function appeler(ctx: Contexte, p: { agent: AgentId; phase: Phase; tour?: 1 | 2; donnees: unknown; prenomCliente?: string; pays?: string }) {
  const mission = construireMission({ agent: p.agent, phase: p.phase, tour: p.tour, mode: "api", donnees: p.donnees, prenomCliente: p.prenomCliente, pays: p.pays });
  const pending: Promise<void>[] = [];
  const onEvent = (e: LlmEvent) => {
    const a = agentEvent(e.agent);
    if (e.type === "agent_status") {
      const statut = e.statut === "recherche" ? "recherche" : e.statut === "mise_en_forme" ? "verification" : "termine";
      pending.push(ctx.emit({ type: "agent_status", agent: a, statut }));
    } else if (e.type === "search_performed") pending.push(ctx.emit({ type: "search_performed", agent: a, requete: e.requete, domaines: e.domaines }));
  };
  const r = await ctx.client.callAgent({ agent: p.agent, phase: p.phase, tour: p.tour, pays: p.pays, mission, onEvent });
  await Promise.all(pending);
  ctx.suivi.ajouter(p.agent, p.phase, r.modele, r.usage);
  const total = ctx.suivi.total();
  await ctx.emit({ type: "cost_update", usd: total.coutUsd, tokens_entree: total.usage.entree, tokens_sortie: total.usage.sortie, recherches: total.usage.recherches });
  const b = ctx.budget.verifier(total.coutUsd);
  if (b.nouvelleAlerte) await ctx.emit({ type: "error", code: "budget_alerte", message: `Coût estimé ${total.coutUsd} $ : au-delà de ${GUARDRAILS.budget.warnUsdPerTrial} $.`, phase: null });
  if (b.etat === "depasse") throw new ProcesError(`Plafond de coût dépassé (${total.coutUsd} $ > ${GUARDRAILS.budget.maxUsdPerTrial} $).`, "budget_depasse");
  const pii = donneesPersonnelles(r.sortie, ctx.nomsProteges);
  if (pii) throw new ValidationError(`${p.agent} : ${pii} dans la sortie (G9)`);
  return r;
}

/** Vérifie les sources d'un dossier : preuves des outils (mode API) ou relecture des pages (mode abonnement). */
export function verifierSources(ctx: Contexte, d: DossierVerifiable, evidence: ToolEvidence, pays: string): Promise<ResultatVerification> {
  return ctx.lire ? verifierDossierParLecture(d, ctx.lire, pays) : verifierDossierApi(d, evidence, pays);
}

/** Valide une sortie avec Zod ; sinon ValidationError (l'appelant relance une fois). */
export function valider<T>(schema: ZodType<T>, brut: unknown, quoi: string): T {
  const r = schema.safeParse(brut);
  if (!r.success) throw new ValidationError(`${quoi} : ${r.error.issues.slice(0, 2).map((i) => `${i.path.join(".") || "(racine)"} ${i.message}`).join(" ; ")}`);
  return r.data;
}

/** Joue `fn` ; sur un rejet du code (ValidationError) ou une erreur du modèle, UNE relance, puis on abandonne. */
export async function avecUneRelance<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ValidationError || (e instanceof LlmError && !(e instanceof ProcesError))) return fn();
    throw e;
  }
}
