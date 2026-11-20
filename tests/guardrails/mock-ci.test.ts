import { describe, expect, it } from "vitest";
import { GUARDRAILS } from "@/lib/guardrails/config";

// « Les tests échouent si MOCK_MODE=false est détecté en CI » (plan, étape 4) : zéro appel API payant en dev et en CI.
describe("MOCK_MODE en CI", () => {
  it("MOCK_MODE=false est interdit quand CI est défini", () => {
    if (process.env.CI) expect(GUARDRAILS.mock, "MOCK_MODE=false détecté en CI").toBe(true);
    expect(true).toBe(true);
  });

  it("la CI n'a aucune clé API Anthropic", () => {
    if (process.env.CI) expect(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY présente en CI").toBeFalsy();
    expect(true).toBe(true);
  });

  it("les tests tournent en MOCK : MOCK_MODE n'est pas « false »", () => {
    expect(process.env.MOCK_MODE).not.toBe("false");
    expect(GUARDRAILS.mock).toBe(true);
  });
});
