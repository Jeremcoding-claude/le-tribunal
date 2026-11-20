import { describe, expect, it } from "vitest";
import { AGENT_IDS, PHASES_PAR_AGENT, schemaSortie, type AgentId, type Phase } from "../../prompts/agents.config";
import { getClient } from "@/lib/llm";
import { fichierFixture, creerClientMock } from "@/lib/llm/mock";
import type { LlmEvent } from "@/lib/llm/types";
import { construireMission } from "@/lib/prompts/loader";
import { GUARDRAILS } from "@/lib/guardrails/config";

const mock = creerClientMock();

function mission(agent: AgentId, phase: Phase, tour?: 1 | 2) {
  const apresPersona = !["IDENTIFICATION", "IDENTIFICATION_COMPLEMENT", "MISE_EN_ETAT"].includes(phase);
  return construireMission({ agent, phase, tour, mode: "api", donnees: { exemple: true }, ...(apresPersona && { prenomCliente: "Sandrine" }) });
}

describe("sélection du client", () => {
  it("MOCK par défaut (MOCK_MODE n'est pas « false »)", () => {
    expect(GUARDRAILS.mock).toBe(true);
    expect(getClient().mode).toBe("mock");
    expect(getClient({ mock: true }).mode).toBe("mock");
    expect(getClient({ mock: false, reel: { anthropic: { messages: { stream: () => { throw new Error("x"); }, parse: async () => { throw new Error("x"); } } } } }).mode).toBe("reel");
  });
});

describe("client MOCK : rejoue les fixtures du cas de référence", () => {
  for (const agent of AGENT_IDS) {
    for (const phase of PHASES_PAR_AGENT[agent]) {
      const tours = phase === "DEBAT" ? ([1, 2] as const) : ([undefined] as const);
      for (const tour of tours) {
        it(`${agent} / ${phase}${tour ? ` / tour ${tour}` : ""} : sortie valide, usage et coût non nuls`, async () => {
          if (agent === "greffier-enquete" && phase === "IDENTIFICATION_COMPLEMENT") return; // même fixture que IDENTIFICATION
          const r = await mock.callAgent({ agent, phase, tour, mission: mission(agent, phase, tour) });
          expect(schemaSortie(agent, phase, "plugin").safeParse(r.sortie).success).toBe(true);
          expect(r.usage.entree).toBeGreaterThan(0);
          expect(r.usage.sortie).toBeGreaterThan(0);
          expect(r.coutUsd).toBeGreaterThan(0);
          expect(r.citationsInconnues).toEqual([]);
          expect(r.modele).toMatch(/^claude-/);
        });
      }
    }
  }

  it("un agent qui cherche sur le web fait 2 appels et rend les preuves des outils", async () => {
    const r = await mock.callAgent({ agent: "investisseur", phase: "INSTRUCTION", mission: mission("investisseur", "INSTRUCTION") });
    expect(r.appels).toBe(2);
    expect(r.evidence.urlsRenvoyees).toContain("https://exemple.test/insee-restauration");
    const c = r.evidence.citations.find((x) => x.url === "https://exemple.test/insee-restauration");
    expect(c?.passage).toContain("160 000");
    expect(r.usage.recherches).toBeGreaterThan(0);
    expect(r.usage.recherches).toBeLessThanOrEqual(GUARDRAILS.search.instruction.maxSearches);
  });

  it("un agent sans recherche fait 1 appel et n'a aucune preuve web", async () => {
    for (const [agent, phase] of [["juge", "CORRECTION"], ["cliente", "REVOTE"], ["greffier-redaction", "MISE_EN_ETAT"]] as const) {
      const r = await mock.callAgent({ agent, phase, mission: mission(agent, phase) });
      expect(r.appels).toBe(1);
      expect(r.evidence.urlsRenvoyees).toEqual([]);
      expect(r.usage.recherches).toBe(0);
    }
  });

  it("simule les événements de recherche en direct, dans la limite du budget", async () => {
    const evenements: LlmEvent[] = [];
    await mock.callAgent({ agent: "concurrent", phase: "INSTRUCTION", mission: mission("concurrent", "INSTRUCTION"), onEvent: (e) => evenements.push(e) });
    const types = evenements.map((e) => e.type);
    expect(types[0]).toBe("agent_status");
    expect(types).toContain("search_performed");
    expect(evenements.filter((e) => e.type === "search_performed").length).toBeLessThanOrEqual(GUARDRAILS.search.instruction.maxSearches);
    expect(types.at(-1)).toBe("agent_status");
  });

  it("le Comptable en INSTRUCTION ne rend ni vote ni arguments (mission 1)", async () => {
    const r = await mock.callAgent({ agent: "comptable", phase: "INSTRUCTION", mission: mission("comptable", "INSTRUCTION") });
    expect(r.sortie).not.toHaveProperty("vote");
    expect(r.sortie).toHaveProperty("hypotheses");
  });

  it("le débat exige un tour", async () => {
    await expect(mock.callAgent({ agent: "cliente", phase: "DEBAT", mission: "x" })).rejects.toThrow(/tour/);
    expect(fichierFixture("cliente", "DEBAT", 2)).toBe("debat/tour-2/cliente.json");
  });

  it("une fixture manquante est une erreur claire, jamais une réponse inventée", async () => {
    const vide = creerClientMock({ cas: "cas-inexistant" });
    await expect(vide.callAgent({ agent: "juge", phase: "CORRECTION", mission: "x" })).rejects.toThrow(/fixture illisible ou manquante/);
  });

  it("ne touche jamais le réseau (fetch est bloqué par tests/setup.ts)", async () => {
    await expect(Promise.resolve().then(() => fetch("https://exemple.test"))).rejects.toThrow(/Réseau interdit/);
  });
});
