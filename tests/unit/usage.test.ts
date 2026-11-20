import { describe, expect, it } from "vitest";
import {
  additionner,
  coutUsd,
  FACTEUR_CACHE_LECTURE,
  ModeleInconnu,
  PRIX_RECHERCHE_USD,
  SuiviUsage,
  TARIFS,
  usageDepuisReponse,
  usageVide,
} from "@/lib/llm/usage";
import { GUARDRAILS } from "@/lib/guardrails/config";

const M = 1_000_000;

describe("tarifs (vérifiés le 16/11/2026, §10.1)", () => {
  it("Sonnet 5.5 : 2 $ / 10 $ ; Opus 5.5 : 4 $ / 20 $ ; Haiku 5.5 : 0,10 $ / 0,50 $", () => {
    expect(TARIFS["claude-sonnet-5-5"]).toEqual({ entree: 2, sortie: 10 });
    expect(TARIFS["claude-opus-5-5"]).toEqual({ entree: 4, sortie: 20 });
    expect(TARIFS["claude-haiku-5-5"]).toEqual({ entree: 0.1, sortie: 0.5 });
  });

  it("chaque modèle de config.ts a un tarif", () => {
    for (const m of Object.values(GUARDRAILS.models)) expect(TARIFS[m], m).toBeDefined();
  });
});

describe("coutUsd", () => {
  const u = (p: Partial<ReturnType<typeof usageVide>>) => ({ ...usageVide(), ...p });

  it("calcule entrée et sortie par million de tokens", () => {
    expect(coutUsd(u({ entree: M }), "claude-sonnet-5-5")).toBe(2);
    expect(coutUsd(u({ sortie: M }), "claude-sonnet-5-5")).toBe(10);
    expect(coutUsd(u({ entree: M, sortie: M }), "claude-opus-5-5")).toBe(24);
  });

  it("la lecture du cache coûte 0,05 × le prix d'entrée", () => {
    expect(FACTEUR_CACHE_LECTURE).toBe(0.05);
    expect(coutUsd(u({ cacheLecture: M }), "claude-sonnet-5-5")).toBe(0.1);
  });

  it("une recherche web coûte 0,01 $ ; le web fetch ne coûte rien en soi", () => {
    expect(PRIX_RECHERCHE_USD).toBe(0.01);
    expect(coutUsd(u({ recherches: 5 }), "claude-sonnet-5-5")).toBe(0.05);
    expect(coutUsd(u({ lectures: 10 }), "claude-sonnet-5-5")).toBe(0);
  });

  it("additionne tous les postes", () => {
    const c = coutUsd(u({ entree: 6000, sortie: 2500, recherches: 3 }), "claude-sonnet-5-5");
    expect(c).toBeCloseTo((6000 * 2) / M + (2500 * 10) / M + 0.03, 6);
  });

  it("refuse un modèle sans tarif au lieu de compter 0", () => {
    expect(() => coutUsd(usageVide(), "claude-inconnu")).toThrow(ModeleInconnu);
  });
});

describe("usage", () => {
  it("lit les champs du champ `usage` de l'API", () => {
    const x = usageDepuisReponse({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 10,
      cache_read_input_tokens: 20,
      server_tool_use: { web_search_requests: 2, web_fetch_requests: 1 },
    });
    expect(x).toEqual({ entree: 100, sortie: 50, cacheEcriture: 10, cacheLecture: 20, recherches: 2, lectures: 1 });
    expect(usageDepuisReponse(undefined)).toEqual(usageVide());
  });

  it("additionne deux usages", () => {
    const a = { ...usageVide(), entree: 1, recherches: 2 };
    const b = { ...usageVide(), entree: 3, sortie: 4 };
    expect(additionner(a, b)).toMatchObject({ entree: 4, sortie: 4, recherches: 2 });
  });

  it("SuiviUsage : total du procès et coût par phase", () => {
    const s = new SuiviUsage();
    s.ajouter("investisseur", "INSTRUCTION", "claude-sonnet-5-5", { ...usageVide(), entree: M });
    s.ajouter("juriste", "INSTRUCTION", "claude-sonnet-5-5", { ...usageVide(), entree: M });
    s.ajouter("juge", "CORRECTION", "claude-opus-5-5", { ...usageVide(), sortie: M });
    expect(s.total().coutUsd).toBe(2 + 2 + 20);
    expect(s.total().usage.entree).toBe(2 * M);
    expect(s.parPhase()).toEqual({ INSTRUCTION: 4, CORRECTION: 20 });
  });
});
