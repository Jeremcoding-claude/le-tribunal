import { describe, expect, it } from "vitest";
import { AGENTS_JURES } from "@/lib/schemas";
import { runTrial } from "@/lib/trial/run";
import { tally } from "@/lib/trial/tally";
import { clientTest, fix, SAISIE_REFERENCE, sourcesMock } from "../helpers";

// Le cas de référence va jusqu'au verdict en MOCK, sans réseau. La note n'est PAS codée en dur : elle est égale à tally(fixtures).
describe("procès complet en MOCK : restaurants à 149 €", () => {
  it("de la phrase au verdict, en moins de 10 s", async () => {
    const debut = Date.now();
    const client = clientTest();
    const r = await runTrial(SAISIE_REFERENCE, { client, sources: sourcesMock(), id: "e2e" });
    expect(Date.now() - debut).toBeLessThan(10_000);
    expect(r.statut).toBe("termine");

    // La note vient de tally(fixtures), pas d'un nombre écrit dans le test.
    const v1 = AGENTS_JURES.map((a) => fix(`instruction/${a}.json`).vote);
    const v2 = AGENTS_JURES.map((a) => fix(`revote/${a}.json`).vote);
    const attendu = tally(v1, v2);
    expect(r.etat!.resultat).toMatchObject({ noteAvant: attendu.noteAvant, noteApres: attendu.noteApres, verdictJury: attendu.verdictJury, phrase: attendu.phrase });
    console.log(`note avant ${attendu.noteAvant} → après ${attendu.noteApres} /10 · ${attendu.verdictJury} · « ${attendu.phrase} »`);
    console.log(r.etat!.resultat!.texte);
  });

  it("enchaîne P0 → P6 dans l'ordre, sans phase sautée", async () => {
    const r = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), id: "e2e-phases" });
    const phases = r.evenements.filter((e) => e.type === "phase_started").map((e) => (e as { phase: string }).phase);
    expect(phases).toEqual(["P0", "P1a", "P1b", "P1c", "P2", "P3", "P4", "P5", "P6"]);
  });

  it("les 5 jurés votent sous scellés, puis les notes s'ouvrent au début de P4 (G14)", async () => {
    const r = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), id: "e2e-scelles" });
    const types = r.evenements.map((e) => e.type);
    expect(types.filter((t) => t === "vote_sealed")).toHaveLength(5);
    const ouverture = types.indexOf("vote1_ouvert");
    expect(ouverture).toBeGreaterThan(types.lastIndexOf("vote_sealed"));
    // Avant l'ouverture, aucune note n'apparaît dans le flux d'événements.
    const avant = JSON.stringify(r.evenements.slice(0, ouverture));
    expect(avant).not.toMatch(/"note"/);
    expect(avant).not.toMatch(/"verdict"/);
    expect(types.indexOf("revote_ouvert")).toBeGreaterThan(types.indexOf("ruling"));
  });

  it("les numéros d'événements se suivent, sans trou", async () => {
    const r = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), id: "e2e-seq" });
    r.evenements.forEach((e, i) => expect(e.seq).toBe(i));
  });

  it("le débat a 2 tours de 5 jurés, et des propositions seulement au tour 2", async () => {
    const r = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), id: "e2e-debat" });
    const tours = r.etat!.debat!;
    expect(tours.filter((t) => t.tour === 1)).toHaveLength(5);
    expect(tours.filter((t) => t.tour === 2)).toHaveLength(5);
    expect(tours.filter((t) => t.tour === 1).every((t) => t.proposition === null)).toBe(true);
    expect(tours.filter((t) => t.tour === 2).every((t) => t.proposition !== null)).toBe(true);
  });

  it("Nadia part des propositions : chaque changement a pour source une proposition du tour 2", async () => {
    const r = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), id: "e2e-ruling" });
    const props = new Set(r.etat!.debat!.map((t) => t.proposition?.id).filter(Boolean));
    for (const c of r.etat!.ruling!.plan_corrige.changements) expect(props.has(c.source) || c.source === "juge").toBe(true);
  });

  it("le tableau du Comptable est calculé par le code (L10 = 9) et le coût est suivi", async () => {
    const r = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), id: "e2e-ledger" });
    expect(r.etat!.ledger!.find((l) => l.ligne === "L10")!.valeur).toBe(9);
    expect(r.etat!.coutUsd).toBeGreaterThan(0);
    expect(r.evenements.some((e) => e.type === "cost_update")).toBe(true);
  });

  it("les jurés ne voient jamais le texte brut de l'utilisateur (G3)", async () => {
    const client = clientTest();
    const brut = "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon";
    await runTrial(brut, { client, sources: sourcesMock(), id: "e2e-brut" });
    for (const a of client.appels.filter((x) => ["investisseur", "comptable", "juriste", "concurrent", "cliente", "juge"].includes(x.agent))) {
      expect(a.mission, a.agent).not.toContain(brut);
      expect(a.mission, a.agent).not.toContain("à 149 € par mois, restaurants");
    }
  });

  it("une saisie incomplète n'ouvre pas de procès", async () => {
    const r = await runTrial("Brigade IA, agents IA, Lyon", { client: clientTest(), sources: sourcesMock(), id: "e2e-incomplet" });
    expect(r.statut).toBe("saisie_incomplete");
    expect(r.message).toContain("Format");
  });
});
