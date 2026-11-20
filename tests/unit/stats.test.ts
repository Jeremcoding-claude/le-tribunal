import { describe, expect, it } from "vitest";
import type { TrialEvent } from "@/lib/schemas";
import { tauxDeRejet } from "@/lib/trial/stats";

const base = { trial_id: "t", ts: "2026-11-20T10:00:00.000Z" };
const ev = (seq: number, o: object) => ({ ...base, seq, ...o }) as TrialEvent;

describe("taux de rejet par règle", () => {
  it("compte les sources rejetées, les nombres libres et les appuis, et signale au-dessus de 20 %", () => {
    const e: TrialEvent[] = [
      ...Array.from({ length: 6 }, (_, i) => ev(i, { type: "source_verified", agent: "investisseur", id: `INV-${i}`, domaine: "exemple.test" })),
      ev(10, { type: "source_rejected", agent: "juriste", id: "JUR-1", raison: "URL absente des résultats des outils" }),
      ev(11, { type: "source_rejected", agent: "juriste", id: "JUR-2", raison: "extrait absent de la page" }),
      ev(12, { type: "error", code: "juré absent", message: "cliente : nombre(s) sans appui : 10", phase: "P2" }),
    ];
    const t = Object.fromEntries(tauxDeRejet(e).map((x) => [x.regle, x]));
    expect(t["source introuvable"]).toMatchObject({ rejets: 2, total: 9, alerte: true });
    expect(t["nombre libre"]).toMatchObject({ rejets: 1, alerte: false });
    expect(t["format"].rejets).toBe(0);
  });
  it("aucun événement : aucun taux, aucune alerte", () => {
    expect(tauxDeRejet([]).every((x) => x.taux === 0 && !x.alerte)).toBe(true);
  });
});
