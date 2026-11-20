import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { avecRelances, creerClientReel, SuiviStream, type AnthropicLike, type EvenementStream, type MessageLike, type StreamLike } from "@/lib/llm/client";
import { LlmError, type LlmEvent } from "@/lib/llm/types";
import { coutUsd } from "@/lib/llm/usage";
import type { RequeteMessages } from "@/lib/llm/requetes";
import { construireMission } from "@/lib/prompts/loader";
import { GUARDRAILS } from "@/lib/guardrails/config";

const fixture = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures/restaurants", f), "utf8")) as Record<string, unknown>;
const URL_INSEE = "https://exemple.test/insee-restauration";
const PASSAGE = "160 000 établissements de restauration indépendants";

// ─────────── Un faux SDK : enregistre les requêtes, rejoue des réponses ───────────
interface Faux {
  sdk: AnthropicLike;
  streams: RequeteMessages[];
  parses: RequeteMessages[];
}
function fauxSdk(o: { streams?: { evenements?: EvenementStream[]; message: MessageLike }[]; parses?: (MessageLike | { erreur: unknown })[] }): Faux {
  const streams: RequeteMessages[] = [];
  const parses: RequeteMessages[] = [];
  let iS = 0;
  let iP = 0;
  const sdk: AnthropicLike = {
    messages: {
      stream(params): StreamLike {
        streams.push(params);
        const r = o.streams?.[iS++] ?? o.streams?.at(-1);
        if (!r) throw new Error("stream non prévu");
        return {
          async *[Symbol.asyncIterator]() {
            for (const e of r.evenements ?? []) yield e;
          },
          finalMessage: async () => r.message,
        };
      },
      async parse(params) {
        parses.push(params);
        const r = o.parses?.[iP++] ?? o.parses?.at(-1);
        if (!r) throw new Error("parse non prévu");
        if ("erreur" in r) throw r.erreur;
        return r;
      },
    },
  };
  return { sdk, streams, parses };
}

const sleepNul = async () => {};

const messageRecherche: MessageLike = {
  stop_reason: "end_turn",
  usage: { input_tokens: 5000, output_tokens: 1000, cache_read_input_tokens: 2000, server_tool_use: { web_search_requests: 2 } },
  content: [
    { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "restaurants indépendants France nombre" } },
    { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: URL_INSEE, title: "INSEE", page_age: "2025" }] },
    { type: "text", text: "Le pays compte 160 000 restaurants indépendants.", citations: [{ type: "web_search_result_location", url: URL_INSEE, title: "INSEE", cited_text: PASSAGE }] },
  ],
};
const evenementsRecherche: EvenementStream[] = [
  { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", name: "web_search" } },
  { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"query":"restau' } },
  { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: 'rants independants"}' } },
  { type: "content_block_stop", index: 0 },
];
const sortieApi = () => fixture("instruction-api/investisseur.json");
const missionInv = construireMission({ agent: "investisseur", phase: "INSTRUCTION", mode: "api", donnees: { x: 1 }, prenomCliente: "Sandrine" });

describe("callAgent : agent qui cherche sur le web (2 appels)", () => {
  async function appelNominal() {
    const faux = fauxSdk({
      streams: [{ evenements: evenementsRecherche, message: messageRecherche }],
      parses: [{ content: [], usage: { input_tokens: 3000, output_tokens: 1500 }, parsed_output: sortieApi() }],
    });
    const evenements: LlmEvent[] = [];
    const r = await creerClientReel({ anthropic: faux.sdk, sleep: sleepNul }).callAgent({ agent: "investisseur", phase: "INSTRUCTION", mission: missionInv, onEvent: (e) => evenements.push(e) });
    return { faux, r, evenements };
  }

  it("appel 1 : outils web avec max_uses, texte (aucun format JSON) ; appel 2 : format JSON, aucun outil", async () => {
    const { faux } = await appelNominal();
    expect(faux.streams).toHaveLength(1);
    expect(faux.parses).toHaveLength(1);
    const [r1] = faux.streams;
    expect(r1.tools?.map((t) => [t.name, t.max_uses])).toEqual([["web_search", 5], ["web_fetch", 3]]);
    expect(r1.output_config).toBeUndefined(); // sorties structurées et citations sont incompatibles (400)
    const [r2] = faux.parses;
    expect(r2.tools).toBeUndefined();
    expect(r2.output_config?.format).toBeDefined();
    expect(r2.messages[0].content).toContain("C1 — https://exemple.test/insee-restauration");
    expect(r2.model).toBe(GUARDRAILS.models.miseEnForme);
  });

  it("le CODE recopie l'adresse et le passage cité : l'agent ne recopie rien", async () => {
    const { r } = await appelNominal();
    const aff = (r.sortie as { affirmations: Record<string, unknown>[] }).affirmations;
    const inv1 = aff.find((a) => a.id === "INV-1")!;
    expect(inv1.source_url).toBe(URL_INSEE);
    expect(inv1.extrait).toBe(PASSAGE);
    expect(inv1).not.toHaveProperty("citation");
    expect(r.citationsInconnues).toEqual([]);
    expect(r.evidence.urlsRenvoyees).toEqual([URL_INSEE]);
    expect(r.evidence.recherches).toEqual([{ requete: "restaurants indépendants France nombre" }]);
  });

  it("additionne les deux appels et calcule le coût de chacun avec son modèle", async () => {
    const { r } = await appelNominal();
    expect(r.appels).toBe(2);
    expect(r.usage).toMatchObject({ entree: 8000, sortie: 2500, cacheLecture: 2000, recherches: 2 });
    const attendu =
      coutUsd({ entree: 5000, sortie: 1000, cacheLecture: 2000, cacheEcriture: 0, recherches: 2, lectures: 0 }, "claude-sonnet-5-5") +
      coutUsd({ entree: 3000, sortie: 1500, cacheLecture: 0, cacheEcriture: 0, recherches: 0, lectures: 0 }, "claude-sonnet-5-5");
    expect(r.coutUsd).toBeCloseTo(attendu, 6);
  });

  it("émet les événements de recherche en direct, pendant le flux", async () => {
    const { evenements } = await appelNominal();
    expect(evenements).toContainEqual({ type: "agent_status", agent: "investisseur", statut: "recherche" });
    expect(evenements).toContainEqual({ type: "search_performed", agent: "investisseur", requete: "restaurants independants", domaines: [] });
    expect(evenements).toContainEqual({ type: "agent_status", agent: "investisseur", statut: "mise_en_forme" });
    expect(evenements.at(-1)).toEqual({ type: "agent_status", agent: "investisseur", statut: "termine" });
  });

  it("une citation inconnue n'est pas inventée : source et extrait à null, id listé pour le vérificateur", async () => {
    const mauvaise = sortieApi() as { affirmations: Record<string, unknown>[] };
    mauvaise.affirmations[2].citation = "C9"; // INV-3, un fait
    const faux = fauxSdk({
      streams: [{ message: messageRecherche }],
      parses: [{ content: [], parsed_output: mauvaise }],
    });
    const r = await creerClientReel({ anthropic: faux.sdk, sleep: sleepNul }).callAgent({ agent: "investisseur", phase: "INSTRUCTION", mission: missionInv });
    expect(r.citationsInconnues).toEqual(["INV-3:C9"]);
    const inv3 = (r.sortie as { affirmations: Record<string, unknown>[] }).affirmations.find((a) => a.id === "INV-3")!;
    expect(inv3.source_url).toBeNull();
    expect(inv3.extrait).toBeNull();
  });

  it("suit pause_turn : renvoie le contenu déjà produit et reprend", async () => {
    const pause: MessageLike = { stop_reason: "pause_turn", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "text", text: "début " }] };
    const fin: MessageLike = { stop_reason: "end_turn", usage: { input_tokens: 20, output_tokens: 7 }, content: [{ type: "text", text: "fin" }] };
    const faux = fauxSdk({ streams: [{ message: pause }, { message: fin }], parses: [{ content: [], parsed_output: sortieApi() }] });
    const r = await creerClientReel({ anthropic: faux.sdk, sleep: sleepNul }).callAgent({ agent: "investisseur", phase: "INSTRUCTION", mission: missionInv });
    expect(faux.streams).toHaveLength(2);
    expect(faux.streams[1].messages).toHaveLength(2);
    expect(faux.streams[1].messages[1].role).toBe("assistant");
    expect(faux.parses[0].messages[0].content).toContain("début fin");
    expect(r.usage.entree).toBeGreaterThanOrEqual(30);
  });
});

describe("callAgent : agent sans recherche (1 appel, JSON imposé)", () => {
  it("le revote de la Cliente : un seul appel, aucun outil, sortie validée par Zod", async () => {
    const faux = fauxSdk({ parses: [{ content: [], usage: { input_tokens: 900, output_tokens: 120 }, parsed_output: fixture("revote/cliente.json") }] });
    const m = construireMission({ agent: "cliente", phase: "REVOTE", mode: "api", donnees: { plan: 1 }, prenomCliente: "Sandrine" });
    const r = await creerClientReel({ anthropic: faux.sdk, sleep: sleepNul }).callAgent({ agent: "cliente", phase: "REVOTE", mission: m });
    expect(faux.streams).toHaveLength(0);
    expect(faux.parses).toHaveLength(1);
    expect(faux.parses[0].tools).toBeUndefined();
    expect(faux.parses[0].max_tokens).toBe(GUARDRAILS.tokens.revote);
    expect(r.appels).toBe(1);
    expect(r.coutUsd).toBeCloseTo(coutUsd({ entree: 900, sortie: 120, cacheLecture: 0, cacheEcriture: 0, recherches: 0, lectures: 0 }, "claude-sonnet-5-5"), 6);
  });

  it("le Juge tourne sur Opus", async () => {
    const faux = fauxSdk({ parses: [{ content: [], parsed_output: fixture("ruling.json") }] });
    const m = construireMission({ agent: "juge", phase: "CORRECTION", mode: "api", donnees: {}, prenomCliente: "Sandrine" });
    const r = await creerClientReel({ anthropic: faux.sdk }).callAgent({ agent: "juge", phase: "CORRECTION", mission: m });
    expect(faux.parses[0].model).toBe("claude-opus-5-5");
    expect(r.modele).toBe("claude-opus-5-5");
  });

  it("revalide la réponse avec Zod : une sortie non conforme est une erreur, pas une donnée", async () => {
    const mauvais = { ...fixture("revote/cliente.json"), vote: { note: 9, verdict: "NO-GO", raison_principale: "x", appuis: ["CLI-1", "CLI-2"] } };
    const faux = fauxSdk({ parses: [{ content: [], parsed_output: mauvais }] });
    const m = construireMission({ agent: "cliente", phase: "REVOTE", mode: "api", donnees: {}, prenomCliente: "Sandrine" });
    await expect(creerClientReel({ anthropic: faux.sdk }).callAgent({ agent: "cliente", phase: "REVOTE", mission: m })).rejects.toThrow(/Sortie non conforme.*incompatible/);
  });

  it("une réponse sans sortie structurée est une erreur", async () => {
    const faux = fauxSdk({ parses: [{ content: [], parsed_output: null }] });
    const m = construireMission({ agent: "cliente", phase: "REVOTE", mode: "api", donnees: {}, prenomCliente: "Sandrine" });
    await expect(creerClientReel({ anthropic: faux.sdk }).callAgent({ agent: "cliente", phase: "REVOTE", mission: m })).rejects.toThrow(LlmError);
  });
});

describe("relances 429 / 529 / 5xx", () => {
  const erreur = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

  it("relance avec un délai qui double, puis réussit", async () => {
    const delais: number[] = [];
    let n = 0;
    const r = await avecRelances(
      async () => {
        if (++n < 3) throw erreur(n === 1 ? 429 : 529);
        return "ok";
      },
      { sleep: async (ms) => void delais.push(ms) },
    );
    expect(r).toBe("ok");
    expect(n).toBe(3);
    expect(delais).toEqual([GUARDRAILS.retries.baseDelayMs, GUARDRAILS.retries.baseDelayMs * 2]);
  });

  it("s'arrête après 2 relances", async () => {
    let n = 0;
    await expect(avecRelances(async () => { n++; throw erreur(503); }, { sleep: sleepNul })).rejects.toThrow("HTTP 503");
    expect(n).toBe(1 + GUARDRAILS.retries.max);
  });

  it("ne relance pas une erreur du client (400, 401)", async () => {
    for (const s of [400, 401, 404]) {
      let n = 0;
      await expect(avecRelances(async () => { n++; throw erreur(s); }, { sleep: sleepNul })).rejects.toThrow();
      expect(n).toBe(1);
    }
  });

  it("relance une erreur de connexion", async () => {
    let n = 0;
    const r = await avecRelances(async () => { if (++n < 2) throw Object.assign(new Error("réseau"), { name: "APIConnectionError" }); return 1; }, { sleep: sleepNul });
    expect(r).toBe(1);
  });

  it("callAgent relance l'appel de mise en forme sur un 529", async () => {
    const faux = fauxSdk({
      streams: [{ message: messageRecherche }],
      parses: [{ erreur: Object.assign(new Error("surcharge"), { status: 529 }) }, { content: [], parsed_output: sortieApi() }],
    });
    const r = await creerClientReel({ anthropic: faux.sdk, sleep: sleepNul }).callAgent({ agent: "investisseur", phase: "INSTRUCTION", mission: missionInv });
    expect(faux.parses).toHaveLength(2);
    expect(r.appels).toBe(2);
  });
});

describe("SuiviStream", () => {
  it("émet une recherche à la fin du bloc d'outil, avec les domaines autorisés", () => {
    const e: LlmEvent[] = [];
    const s = new SuiviStream("juriste", (x) => e.push(x), ["cnil.fr"]);
    for (const ev of evenementsRecherche) s.traiter(ev);
    expect(e).toEqual([
      { type: "agent_status", agent: "juriste", statut: "recherche" },
      { type: "search_performed", agent: "juriste", requete: "restaurants independants", domaines: ["cnil.fr"] },
    ]);
  });

  it("émet une lecture de page", () => {
    const e: LlmEvent[] = [];
    const s = new SuiviStream("concurrent", (x) => e.push(x));
    s.traiter({ type: "content_block_start", index: 2, content_block: { type: "server_tool_use", name: "web_fetch" } });
    s.traiter({ type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '{"url":"https://exemple.test/a"}' } });
    s.traiter({ type: "content_block_stop", index: 2 });
    expect(e.at(-1)).toEqual({ type: "fetch_performed", agent: "concurrent", url: "https://exemple.test/a" });
  });

  it("ignore un bloc de texte et un JSON d'entrée illisible", () => {
    const e: LlmEvent[] = [];
    const s = new SuiviStream("cliente", (x) => e.push(x));
    s.traiter({ type: "content_block_start", index: 0, content_block: { type: "text" } });
    s.traiter({ type: "content_block_stop", index: 0 });
    s.traiter({ type: "content_block_start", index: 1, content_block: { type: "server_tool_use", name: "web_search" } });
    s.traiter({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{pas du json" } });
    s.traiter({ type: "content_block_stop", index: 1 });
    expect(e.map((x) => x.type)).toEqual(["agent_status"]);
  });
});

describe("erreurs : jamais de clé API (G8)", () => {
  it("une clé dans un message d'erreur est masquée", () => {
    const e = new LlmError("401 : clé sk-ant-api03-ABCDEF123456_xyz refusée");
    expect(e.message).not.toContain("sk-ant-api03");
    expect(e.message).toContain("sk-ant-…masquée");
  });
});
