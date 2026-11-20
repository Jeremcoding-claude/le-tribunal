import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// config.ts lit MOCK_MODE à l'import : on le recharge pour chaque cas.
async function chargerConfig() {
  vi.resetModules();
  return (await import("@/lib/guardrails/config")).GUARDRAILS;
}

describe("GUARDRAILS.mock", () => {
  const avant = process.env.MOCK_MODE;
  beforeEach(() => {
    delete process.env.MOCK_MODE;
  });
  afterEach(() => {
    if (avant === undefined) delete process.env.MOCK_MODE;
    else process.env.MOCK_MODE = avant;
  });

  it("vaut true quand MOCK_MODE n'est pas défini", async () => {
    expect((await chargerConfig()).mock).toBe(true);
  });

  it("vaut true quand MOCK_MODE=true", async () => {
    process.env.MOCK_MODE = "true";
    expect((await chargerConfig()).mock).toBe(true);
  });

  it("ne vaut false que si MOCK_MODE=false", async () => {
    process.env.MOCK_MODE = "false";
    expect((await chargerConfig()).mock).toBe(false);
  });
});

describe("GUARDRAILS.tally (règle v1, plan section 4.2)", () => {
  it("porte les seuils du plan v3.0", async () => {
    const t = (await chargerConfig()).tally;
    expect(t.quorum).toBe(4);
    expect(t.goMin).toBe(6);
    expect(t.nogoMax).toBe(4.5);
    expect(t.divise).toBe(1.5);
    expect(t.consensusSuspect).toBe(0.5);
  });
});
