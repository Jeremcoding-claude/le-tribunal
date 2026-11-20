// Le vrai client : Messages API via @anthropic-ai/sdk (plan v3.0, étape 4). Un SEUL point d'appel au modèle.
//
// - Appel 1 (agents qui cherchent sur le web) : outils web + citations, TEXTE, en streaming, pour émettre les
//   événements de recherche en direct.
// - Appel 2 : mise en forme JSON sans outil (output_config.format + messages.parse). Le code recopie lui-même
//   l'adresse et le passage cité de chaque source (citations.ts) : l'agent ne peut pas inventer un extrait.
// - Agents sans recherche : un seul appel, JSON imposé.
// - Relances 429/529/5xx avec délai croissant, délai maximal par appel, revalidation Zod de chaque réponse.
// Aucune clé n'est lue ici : le SDK lit ANTHROPIC_API_KEY lui-même, et une erreur ne la contient jamais (G8).
//
// // HYPOTHÈSE: la gestion de `stop_reason: "pause_turn"` (suite d'un tour d'outils serveur) et la lecture de
// `parsed_output` suivent la doc et les types du SDK 1.12 ; jamais exécutées contre le vrai service (smoke test, étape 12).

import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import { AGENTS, BUDGET_PAR_PHASE, schemaSortie, type AgentId } from "../../../prompts/agents.config";
import { GUARDRAILS } from "../guardrails/config";
import { promptMiseEnForme, promptSysteme } from "../prompts/loader";
import { extraireEvidence, recopierCitations, type Bloc } from "./citations";
import { requeteDirecte, requeteMiseEnForme, requeteRecherche, type RequeteMessages } from "./requetes";
import { evidenceVide, LlmError, type CallAgentParams, type CallAgentResult, type LlmClient, type LlmEvent } from "./types";
import { additionner, coutUsd, usageDepuisReponse, usageVide, type UsageApi } from "./usage";

// ─────────── Ce que le client attend du SDK (structurel : on peut l'injecter en test) ───────────

export interface MessageLike {
  content: Bloc[];
  usage?: UsageApi | null;
  stop_reason?: string | null;
  parsed_output?: unknown;
}
export interface EvenementStream {
  type: string;
  index?: number;
  content_block?: { type?: string; name?: string };
  delta?: { type?: string; partial_json?: string };
}
export interface StreamLike extends AsyncIterable<EvenementStream> {
  finalMessage(): Promise<MessageLike>;
}
export interface AnthropicLike {
  messages: {
    stream(params: RequeteMessages, opts?: { signal?: AbortSignal }): StreamLike;
    parse(params: RequeteMessages, opts?: { signal?: AbortSignal }): Promise<MessageLike>;
  };
}

// ─────────── Relances ───────────

export interface OptionsRelance {
  max?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

function estRelancable(e: unknown): boolean {
  const s = (e as { status?: number } | null)?.status;
  if (typeof s === "number") return s === 429 || s === 529 || s >= 500;
  return (e as { name?: string } | null)?.name === "APIConnectionError";
}

/** Relance 429, 529 et 5xx avec un délai qui double ; les autres erreurs (400, 401…) sont rendues telles quelles. */
export async function avecRelances<T>(fn: () => Promise<T>, o: OptionsRelance = {}): Promise<T> {
  const max = o.max ?? GUARDRAILS.retries.max;
  const base = o.baseDelayMs ?? GUARDRAILS.retries.baseDelayMs;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let essai = 0; ; essai++) {
    try {
      return await fn();
    } catch (e) {
      if (essai >= max || !estRelancable(e)) throw e;
      await sleep(base * 2 ** essai);
    }
  }
}

// ─────────── Événements de recherche en direct ───────────

/** Suit le flux (streaming) et émet un événement dès qu'une recherche ou une lecture est demandée par le modèle. */
export class SuiviStream {
  private readonly blocs = new Map<number, { name: string; json: string }>();
  private enRecherche = false;

  constructor(
    private readonly agent: AgentId,
    private readonly onEvent?: (e: LlmEvent) => void,
    private readonly domaines: string[] = [],
  ) {}

  traiter(ev: EvenementStream): void {
    const i = ev.index ?? -1;
    if (ev.type === "content_block_start" && ev.content_block?.type === "server_tool_use") {
      this.blocs.set(i, { name: ev.content_block.name ?? "", json: "" });
      if (!this.enRecherche) {
        this.enRecherche = true;
        this.onEvent?.({ type: "agent_status", agent: this.agent, statut: "recherche" });
      }
    } else if (ev.type === "content_block_delta" && ev.delta?.type === "input_json_delta") {
      const b = this.blocs.get(i);
      if (b) b.json += ev.delta.partial_json ?? "";
    } else if (ev.type === "content_block_stop") {
      const b = this.blocs.get(i);
      if (!b) return;
      this.blocs.delete(i);
      let entree: Record<string, unknown> = {};
      try {
        entree = JSON.parse(b.json || "{}") as Record<string, unknown>;
      } catch {
        return; // entrée illisible : l'événement est perdu, l'évidence finale reste exacte
      }
      if (b.name === "web_search") this.onEvent?.({ type: "search_performed", agent: this.agent, requete: String(entree.query ?? ""), domaines: this.domaines });
      if (b.name === "web_fetch") this.onEvent?.({ type: "fetch_performed", agent: this.agent, url: String(entree.url ?? "") });
    }
  }
}

// ─────────── Le client ───────────

export interface OptionsClientReel extends OptionsRelance {
  anthropic?: AnthropicLike;
  /** Délai maximal d'un appel. Défaut : config.ts, timeouts.agentMs. */
  timeoutMs?: number;
}

const resume = (e: { issues: { path: PropertyKey[]; message: string }[] }) =>
  e.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" ; ");

export function creerClientReel(opts: OptionsClientReel = {}): LlmClient {
  let sdk: AnthropicLike | undefined = opts.anthropic;
  const anthropic = (): AnthropicLike => (sdk ??= new Anthropic() as unknown as AnthropicLike);
  const signal = () => AbortSignal.timeout(opts.timeoutMs ?? GUARDRAILS.timeouts.agentMs);

  /** Appel 1 : recherche en streaming. Suit `pause_turn` (jusqu'à 3 reprises) en renvoyant le contenu déjà produit. */
  async function chercher(req: RequeteMessages, p: CallAgentParams, domaines: string[]) {
    let contenu: Bloc[] = [];
    let usage = usageVide();
    let requete = req;
    for (let reprise = 0; reprise < 4; reprise++) {
      const msg = await avecRelances(async () => {
        const flux = anthropic().messages.stream(requete, { signal: signal() });
        const suivi = new SuiviStream(p.agent, p.onEvent, domaines);
        for await (const ev of flux) suivi.traiter(ev);
        return flux.finalMessage();
      }, opts);
      contenu = [...contenu, ...msg.content];
      usage = additionner(usage, usageDepuisReponse(msg.usage));
      if (msg.stop_reason !== "pause_turn") break;
      requete = { ...req, messages: [...req.messages, { role: "assistant", content: contenu }] };
    }
    return { contenu, usage };
  }

  async function formater(req: RequeteMessages, schema: ZodType) {
    const msg = await avecRelances(() => anthropic().messages.parse(req, { signal: signal() }), opts);
    const brut = msg.parsed_output;
    if (brut === null || brut === undefined) throw new LlmError("Réponse sans sortie structurée (parsed_output vide).");
    const r = schema.safeParse(brut);
    if (!r.success) throw new LlmError(`Sortie non conforme au schéma : ${resume(r.error)}`, r.error);
    return { sortie: r.data as unknown, usage: usageDepuisReponse(msg.usage) };
  }

  return {
    mode: "reel",
    async callAgent(p: CallAgentParams): Promise<CallAgentResult> {
      const def = AGENTS[p.agent];
      const budget = BUDGET_PAR_PHASE[p.phase];
      const schema = schemaSortie(p.agent, p.phase, "api");
      const system = promptSysteme(p.agent, "api");
      const avecWeb = def.outilsApi.length > 0 && budget.maxSearches + budget.maxFetches > 0;

      if (!avecWeb) {
        const f = await formater(requeteDirecte({ agent: p.agent, phase: p.phase, system, mission: p.mission, schema }), schema);
        const { sortie, inconnues } = recopierCitations(f.sortie, []);
        p.onEvent?.({ type: "agent_status", agent: p.agent, statut: "termine" });
        return { sortie, usage: f.usage, coutUsd: coutUsd(f.usage, def.modele), modele: def.modele, evidence: evidenceVide(), citationsInconnues: inconnues, appels: 1 };
      }

      const req1 = requeteRecherche({ agent: p.agent, phase: p.phase, system, mission: p.mission, pays: p.pays });
      const domaines = req1.tools?.flatMap((t) => t.allowed_domains ?? []) ?? [];
      const recherche = await chercher(req1, p, [...new Set(domaines)]);
      const { texte, evidence } = extraireEvidence(recherche.contenu);

      p.onEvent?.({ type: "agent_status", agent: p.agent, statut: "mise_en_forme" });
      const req2 = requeteMiseEnForme({ agent: p.agent, phase: p.phase, system: promptMiseEnForme(), dossier: texte, citations: evidence.citations, schema });
      const f = await formater(req2, schema);
      const { sortie, inconnues } = recopierCitations(f.sortie, evidence.citations);

      p.onEvent?.({ type: "agent_status", agent: p.agent, statut: "termine" });
      const usage = additionner(recherche.usage, f.usage);
      return {
        sortie,
        usage,
        coutUsd: Math.round((coutUsd(recherche.usage, def.modele) + coutUsd(f.usage, GUARDRAILS.models.miseEnForme)) * 1e6) / 1e6,
        modele: def.modele,
        evidence,
        citationsInconnues: inconnues,
        appels: 2,
      };
    },
  };
}
