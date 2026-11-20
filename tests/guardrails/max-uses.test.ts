import { describe, expect, it } from "vitest";
import { AGENT_IDS, AGENTS, BUDGET_PAR_PHASE, PHASES_PAR_AGENT, schemaSortie } from "../../prompts/agents.config";
import { GUARDRAILS } from "@/lib/guardrails/config";
import { maxTokensPourPhase, requeteDirecte, requeteMiseEnForme, requeteRecherche } from "@/lib/llm/requetes";
import { SCHEMAS_API } from "@/lib/schemas";
import { outilsNatifs } from "@/lib/search/native";
import { LlmError } from "@/lib/llm/types";
import type { ZodType } from "zod";

// G6 — « chaque requête construite contient max_tokens et max_uses » (plan v3.0, §5.2).
const combinaisons = AGENT_IDS.flatMap((agent) => PHASES_PAR_AGENT[agent].map((phase) => ({ agent, phase })));

describe("max_tokens et max_uses sur chaque requête", () => {
  for (const { agent, phase } of combinaisons) {
    it(`${agent} / ${phase} : requête directe avec max_tokens, sans outil`, () => {
      const r = requeteDirecte({ agent, phase, system: "s", mission: "m", schema: schemaSortie(agent, phase, "api") });
      expect(Number.isInteger(r.max_tokens)).toBe(true);
      expect(r.max_tokens).toBe(maxTokensPourPhase(phase));
      expect(r.max_tokens).toBeGreaterThan(0);
      expect(r.tools).toBeUndefined();
      expect(r.model).toBe(AGENTS[agent].modele);
    });

    it(`${agent} / ${phase} : requête de recherche avec max_tokens ; chaque outil web a son max_uses`, () => {
      const r = requeteRecherche({ agent, phase, system: "s", mission: "m", pays: "FR" });
      expect(r.max_tokens).toBe(maxTokensPourPhase(phase));
      expect(r.output_config, "pas de JSON imposé avec des citations (400)").toBeUndefined();
      const budget = BUDGET_PAR_PHASE[phase];
      if (AGENTS[agent].outilsApi.length === 0 || budget.maxSearches + budget.maxFetches === 0) {
        expect(r.tools).toEqual([]);
        return;
      }
      for (const t of r.tools!) {
        expect(Number.isInteger(t.max_uses), `${t.name} sans max_uses`).toBe(true);
        expect(t.max_uses).toBeGreaterThan(0);
        expect(t.max_uses).toBe(t.name === "web_search" ? budget.maxSearches : budget.maxFetches);
        if (t.name === "web_fetch") {
          expect(t.max_content_tokens).toBe(GUARDRAILS.search.fetchMaxContentTokens);
          expect(t.citations).toEqual({ enabled: true });
        }
      }
    });
  }

  it("les budgets du plan : jurés 5 recherches et 3 lectures, greffier-enquêteur 3 et 2, débat 1 et 1, revote 0", () => {
    const inv = requeteRecherche({ agent: "investisseur", phase: "INSTRUCTION", system: "s", mission: "m" });
    expect(inv.tools?.map((t) => [t.name, t.max_uses])).toEqual([["web_search", 5], ["web_fetch", 3]]);
    const gre = requeteRecherche({ agent: "greffier-enquete", phase: "IDENTIFICATION", system: "s", mission: "m" });
    expect(gre.tools?.map((t) => [t.name, t.max_uses])).toEqual([["web_search", 3], ["web_fetch", 2]]);
    const com = requeteRecherche({ agent: "greffier-enquete", phase: "IDENTIFICATION_COMPLEMENT", system: "s", mission: "m" });
    expect(com.tools?.map((t) => [t.name, t.max_uses])).toEqual([["web_search", 2], ["web_fetch", 1]]);
    const deb = requeteRecherche({ agent: "cliente", phase: "DEBAT", system: "s", mission: "m" });
    expect(deb.tools?.map((t) => [t.name, t.max_uses])).toEqual([["web_search", 1], ["web_fetch", 1]]);
    expect(requeteRecherche({ agent: "cliente", phase: "REVOTE", system: "s", mission: "m" }).tools).toEqual([]);
  });

  it("le prompt système est mis en cache sur chaque requête", () => {
    const r = requeteDirecte({ agent: "juge", phase: "CORRECTION", system: "S", mission: "m", schema: schemaSortie("juge", "CORRECTION", "api") });
    expect(r.system).toEqual([{ type: "text", text: "S", cache_control: { type: "ephemeral" } }]);
  });

  it("la mise en forme n'a aucun outil et impose le format JSON", () => {
    const r = requeteMiseEnForme({ agent: "juriste", phase: "INSTRUCTION", system: "s", dossier: "d", citations: [], schema: schemaSortie("juriste", "INSTRUCTION", "api") });
    expect(r.tools).toBeUndefined();
    expect(r.output_config?.format).toBeDefined();
    expect(r.max_tokens).toBe(GUARDRAILS.tokens.jure);
  });
});

describe("le Juriste ne cherche que sur les domaines officiels (G1)", () => {
  it("allowed_domains sur web_search ET web_fetch, jamais blocked_domains en même temps", () => {
    const r = requeteRecherche({ agent: "juriste", phase: "INSTRUCTION", system: "s", mission: "m", pays: "FR" });
    for (const t of r.tools!) {
      expect(t.allowed_domains).toEqual(GUARDRAILS.search.juristeDomains.FR);
      expect(t).not.toHaveProperty("blocked_domains");
    }
  });

  it("refuse un pays sans liste de domaines officiels plutôt que de chercher partout", () => {
    expect(() => outilsNatifs("juriste", "INSTRUCTION", "BE")).toThrow(LlmError);
  });

  it("les autres jurés n'ont aucune restriction de domaine", () => {
    for (const t of outilsNatifs("investisseur", "INSTRUCTION", "FR")) expect(t.allowed_domains).toBeUndefined();
  });
});

describe("le SDK accepte chaque schéma envoyé à l'API (zodOutputFormat)", () => {
  for (const [nom, schema] of Object.entries(SCHEMAS_API)) {
    it(`${nom}`, () => {
      expect(() => requeteDirecte({ agent: "juge", phase: "CORRECTION", system: "s", mission: "m", schema: schema as ZodType })).not.toThrow();
    });
  }
});
