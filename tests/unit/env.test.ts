import { describe, expect, it } from "vitest";
import { ErreurEnv, lireEnv, resumeEnv } from "@/lib/env";

const CLE = "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ-secret";
const JETON = "mot-de-passe-long-0123";
const reel = { MOCK_MODE: "false", ANTHROPIC_API_KEY: CLE, TRIBUNAL_ACCESS_TOKEN: JETON };
const echec = (src: Record<string, string | undefined>) => {
  try {
    lireEnv(src);
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurEnv);
    return (e as Error).message;
  }
  throw new Error("lireEnv aurait dû échouer");
};

describe("lireEnv (G13 — src/lib/env.ts)", () => {
  it("défauts : MOCK, port 3000, ./data, aucune clé", () => {
    expect(lireEnv({})).toEqual({ mock: true, cleApiPresente: false, jetonAcces: "", port: 3000, dossierDonnees: "./data" });
  });

  it("des valeurs vides valent « non définie »", () => {
    expect(lireEnv({ MOCK_MODE: "", PORT: " ", DATA_DIR: "" }).mock).toBe(true);
  });

  it("seules « true » et « false » sont acceptées : « flase », « faux », « 0 », « False » arrêtent le démarrage", () => {
    for (const v of ["flase", "faux", "0", "False", "TRUE", "yes"]) expect(echec({ MOCK_MODE: v }), v).toContain("MOCK_MODE");
  });

  it("une valeur douteuse n'est JAMAIS recopiée dans l'erreur", () => {
    expect(echec({ MOCK_MODE: "flase-1234" })).not.toContain("flase-1234");
    expect(echec({ PORT: "abc-secret" })).not.toContain("abc-secret");
  });

  it("PORT : entier entre 1 et 65535", () => {
    expect(lireEnv({ PORT: "8080" }).port).toBe(8080);
    for (const v of ["0", "70000", "3000.5", "http"]) expect(echec({ PORT: v }), v).toContain("PORT");
  });

  it("mode réel sans clé = arrêt ; sans jeton = arrêt ; jeton trop court = arrêt", () => {
    expect(echec({ MOCK_MODE: "false", TRIBUNAL_ACCESS_TOKEN: JETON })).toContain("ANTHROPIC_API_KEY");
    expect(echec({ MOCK_MODE: "false", ANTHROPIC_API_KEY: CLE })).toContain("TRIBUNAL_ACCESS_TOKEN");
    expect(echec({ ...reel, TRIBUNAL_ACCESS_TOKEN: "court" })).toContain("16");
  });

  it("mode réel complet : accepté ; la clé n'est jamais exposée, seulement sa présence", () => {
    const e = lireEnv(reel);
    expect(e).toMatchObject({ mock: false, cleApiPresente: true, jetonAcces: JETON });
    expect(JSON.stringify(e)).not.toContain(CLE);
  });

  it("en mode MOCK, la clé est ignorée et le jeton aussi", () => {
    const e = lireEnv({ MOCK_MODE: "true", ANTHROPIC_API_KEY: CLE, TRIBUNAL_ACCESS_TOKEN: "x" });
    expect(e.mock).toBe(true);
    expect(e.jetonAcces).toBe("");
  });

  it("la clé et le jeton n'apparaissent ni dans le résumé de démarrage ni dans les erreurs", () => {
    expect(resumeEnv(lireEnv(reel))).not.toMatch(/sk-ant|mot-de-passe/);
    expect(resumeEnv(lireEnv(reel))).toContain("clé_api=présente");
    for (const src of [{ ...reel, TRIBUNAL_ACCESS_TOKEN: "court" }, { MOCK_MODE: "flase", ANTHROPIC_API_KEY: CLE }]) {
      const m = echec(src);
      expect(m).not.toContain(CLE);
      expect(m).not.toContain("court");
    }
  });

});
