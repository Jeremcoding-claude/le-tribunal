import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculerLedger, entreesDepuisHypotheses, type EntreesLedger, type Hypothese } from "@/lib/trial/ledger";
import { Ledger } from "@/lib/schemas";

const fix = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures/restaurants", f), "utf8"));
const h = (valeur: number | null, ref = "X"): Hypothese => ({ valeur, ref });
const base = (o: Partial<EntreesLedger> = {}): EntreesLedger => ({ prix: h(150), coutVariable: h(50), churnPct: h(4), cac: h(500), chargesFixes: h(1000), objectif: h(2000), sam: h(10000), ...o });
const val = (l: ReturnType<typeof calculerLedger>, id: string) => l.find((x) => x.ligne === id)!;

describe("calculerLedger : valeurs simples calculées à la main", () => {
  it("F = 1 000 et marge = 100 → point mort = 10 clients", () => {
    const l = calculerLedger(base());
    expect(val(l, "L3").valeur).toBe(100);
    expect(val(l, "L10").valeur).toBe(10);
  });

  it("toutes les lignes, avec leurs formules", () => {
    const l = calculerLedger(base());
    expect(l.map((x) => x.valeur)).toEqual([
      150, 50, 100, 25, 2500, 500, 5, 5, 1000, 10, 30, 5000, 0.001, 18_000_000,
    ]);
    expect(l.every((x) => x.statut === "calcule")).toBe(true);
  });

  it("L10 arrondit au client supérieur, sans erreur de virgule flottante", () => {
    expect(val(calculerLedger(base({ chargesFixes: h(1001) })), "L10").valeur).toBe(11);
    expect(val(calculerLedger(base({ prix: h(140), coutVariable: h(50), chargesFixes: h(900) })), "L10").valeur).toBe(10);
    expect(val(calculerLedger(base({ prix: h(0.3), coutVariable: h(0.1), chargesFixes: h(2) })), "L10").valeur).toBe(10);
  });

  it("renvoie toujours 14 lignes L1 à L14 valides pour le schéma", () => {
    const l = calculerLedger(base());
    expect(l.map((x) => x.ligne)).toEqual(Array.from({ length: 14 }, (_, i) => `L${i + 1}`));
    expect(Ledger.safeParse(l).success).toBe(true);
  });
});

describe("« non calculable » : le code n'invente rien", () => {
  it("prix absent : comptes partiels, seules les lignes sans prix restent calculées", () => {
    const l = calculerLedger(base({ prix: h(null, "CASE-prix") }));
    const calculees = l.filter((x) => x.statut === "calcule").map((x) => x.ligne);
    expect(calculees).toEqual(["L2", "L4", "L6", "L9"]);
    expect(val(l, "L1").valeur).toBeNull();
    expect(Ledger.safeParse(l).success).toBe(true);
  });

  it("churn nul ou absent : pas de durée de vie ni de LTV", () => {
    for (const churn of [0, null]) {
      const l = calculerLedger(base({ churnPct: h(churn) }));
      expect(val(l, "L4").statut).toBe("non_calculable");
      expect(val(l, "L5").statut).toBe("non_calculable");
      expect(val(l, "L7").statut).toBe("non_calculable");
      expect(val(l, "L10").statut).toBe("calcule");
    }
  });

  it("marge nulle ou négative : pas de point mort, pas de payback", () => {
    for (const cv of [150, 200]) {
      const l = calculerLedger(base({ coutVariable: h(cv) }));
      for (const id of ["L8", "L10", "L11", "L12", "L13"]) expect(val(l, id).statut, id).toBe("non_calculable");
    }
  });

  it("SAM absent : pas de part du SAM ni de plafond de revenu", () => {
    const l = calculerLedger(base({ sam: h(null, "INV-2") }));
    expect(val(l, "L13").statut).toBe("non_calculable");
    expect(val(l, "L14").statut).toBe("non_calculable");
    expect(val(l, "L10").statut).toBe("calcule");
  });

  it("objectif absent : seule L11 est non calculable", () => {
    const l = calculerLedger(base({ objectif: h(null, "CONFIG") }));
    expect(val(l, "L11").statut).toBe("non_calculable");
    expect(val(l, "L10").statut).toBe("calcule");
  });

  it("chaque ligne garde la trace de ses entrées", () => {
    const l = calculerLedger(base({ prix: h(150, "CASE-prix"), coutVariable: h(50, "CPT-3"), churnPct: h(4, "CPT-5") }));
    expect(val(l, "L3").depuis.sort()).toEqual(["CASE-prix", "CPT-3"]);
    expect(val(l, "L5").depuis.sort()).toEqual(["CASE-prix", "CPT-3", "CPT-5"]);
  });
});

describe("cas de référence (fixtures/restaurants)", () => {
  it("les hypothèses du Comptable et le SAM de l'Investisseur redonnent exactement ledger.json", () => {
    const cpt = fix("instruction/comptable.json");
    const inv = fix("instruction/investisseur.json");
    const sam = inv.affirmations.find((a: { id: string }) => a.id === inv.marche.sam_unites);
    const l = calculerLedger(entreesDepuisHypotheses(cpt.hypotheses, { valeur: sam.valeur, ref: sam.id }));
    const attendu = fix("ledger.json") as { ligne: string; valeur: number }[];
    expect(l).toHaveLength(14);
    for (const a of attendu) expect(val(l, a.ligne).valeur, a.ligne).toBeCloseTo(a.valeur, 4);
  });
});
