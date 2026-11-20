import { describe, expect, it } from "vitest";
import { creerStoreSqlite, ouvrirBase } from "@/lib/store/sqlite";
import { runTrial } from "@/lib/trial/run";
import { clientTest, SAISIE_REFERENCE, sourcesMock } from "../helpers";

const nouveau = () => creerStoreSqlite(ouvrirBase(":memory:"));
const ev = (seq: number, o: object = {}) => ({ trial_id: "t1", seq, ts: "2026-11-20T10:00:00.000Z", type: "phase_started", phase: "P0", ...o }) as never;

describe("store SQLite : même interface Store que la mémoire et les fichiers", () => {
  it("les migrations créent les 5 tables", () => {
    const s = ouvrirBase(":memory:");
    const tables = s.$client.prepare("select name from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '\\_\\_%' escape '\\'").all().map((r) => (r as { name: string }).name);
    expect(tables.sort()).toEqual(["artifacts", "events", "phases", "trials", "usage"]);
  });

  it("garde le dernier état sauvegardé", async () => {
    const { store } = nouveau();
    expect(await store.dernierEtat("t1")).toBeNull();
    await store.sauvegarder("t1", "P1a", { a: 1 });
    await store.sauvegarder("t1", "P1b", { a: 2 });
    expect(await store.dernierEtat("t1")).toEqual({ phase: "P1b", etat: { a: 2 } });
  });

  it("rend les événements dans l'ordre de seq, et seulement ceux qui suivent un numéro (Last-Event-ID)", async () => {
    const s = nouveau();
    for (const n of [2, 0, 1, 3]) await s.store.ajouterEvenement("t1", ev(n));
    expect((await s.store.evenements("t1")).map((e) => e.seq)).toEqual([0, 1, 2, 3]);
    expect(s.evenementsApres("t1", 1).map((e) => e.seq)).toEqual([2, 3]);
    expect(s.evenementsApres("t1", 3)).toEqual([]);
    expect(s.evenementsApres("autre", -1)).toEqual([]);
  });

  it("refuse deux événements de même numéro pour un procès (seq croissant, unique)", async () => {
    const { store } = nouveau();
    await store.ajouterEvenement("t1", ev(0));
    await expect(store.ajouterEvenement("t1", ev(0))).rejects.toThrow(/UNIQUE/);
    await expect(store.ajouterEvenement("t2", ev(0))).resolves.toBeUndefined();
  });

  it("masque une clé API avant d'écrire (G8)", async () => {
    const s = nouveau();
    await s.store.sauvegarder("t1", "P1a", { note: "clé sk-ant-api03-FAUSSECLE123456 ici" });
    await s.store.ajouterEvenement("t1", ev(0, { type: "error", code: "x", message: "401 sk-ant-api03-FAUSSECLE123456", phase: null }));
    const brut = JSON.stringify(s.store === undefined ? null : [await s.store.dernierEtat("t1"), await s.store.evenements("t1")]);
    expect(brut).not.toContain("FAUSSECLE");
    expect(JSON.stringify(s.usage("t1"))).not.toContain("FAUSSECLE");
  });

  it("procès : création, statut, liste, suppression complète", async () => {
    const s = nouveau();
    s.creerTrial("t1", "idée", "FR");
    s.majStatut("t1", "echec", "clé sk-ant-api03-FAUSSECLE123456");
    expect(s.trial("t1")).toMatchObject({ id: "t1", statut: "echec", pays: "FR" });
    expect(s.trial("t1")!.message).not.toContain("FAUSSECLE");
    expect(s.listerTrials()).toHaveLength(1);
    await s.store.sauvegarder("t1", "P0", {});
    await s.store.ajouterEvenement("t1", ev(0));
    s.ecrireArtefact("t1", "rapport.pdf", "AAA");
    s.supprimerTrial("t1");
    expect(s.trial("t1")).toBeUndefined();
    expect(await s.store.dernierEtat("t1")).toBeNull();
    expect(await s.store.evenements("t1")).toEqual([]);
    expect(s.artefact("t1", "rapport.pdf")).toBeUndefined();
  });

  it("artefacts : lecture et remplacement", () => {
    const s = nouveau();
    expect(s.artefact("t1", "x")).toBeUndefined();
    s.ecrireArtefact("t1", "x", "un");
    s.ecrireArtefact("t1", "x", "deux");
    expect(s.artefact("t1", "x")).toBe("deux");
  });

  it("un procès complet y tient : événements, point de sauvegarde par phase, usage par phase", async () => {
    const s = nouveau();
    s.creerTrial("e2e", SAISIE_REFERENCE, "FR");
    const r = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), store: s.store, id: "e2e" });
    expect(r.statut).toBe("termine");
    expect((await s.store.dernierEtat("e2e"))?.phase).toBe("TERMINE");
    const evs = await s.store.evenements("e2e");
    evs.forEach((e, i) => expect(e.seq).toBe(i));
    const usage = s.usage("e2e");
    expect(usage.find((u) => u.phase === "TOTAL")!.coutUsd).toBeGreaterThan(0);
    expect(usage.map((u) => u.phase)).toEqual(expect.arrayContaining(["IDENTIFICATION", "INSTRUCTION", "CORRECTION", "REVOTE"]));
  });
});
