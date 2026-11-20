import { describe, expect, it } from "vitest";
import { classerObjections } from "@/lib/trial/objections";
import { prononcer } from "@/lib/trial/prononce";
import { statsVote, tally, verdictDuTour } from "@/lib/trial/tally";
import type { Vote } from "@/lib/schemas";

type V = Pick<Vote, "note" | "verdict">;
const verdictDe = (n: number): V["verdict"] => (n >= 6 ? "GO" : n <= 4.5 ? "NO-GO" : "PIVOT");
const v = (note: number, verdict: V["verdict"] = verdictDe(note)): V => ({ note, verdict });
const notes = (...n: number[]) => n.map((x) => v(x));

describe("statsVote : moyenne, écart-type, répartition", () => {
  it("moyenne arrondie à 0,1, la moitié vers le haut", () => {
    expect(statsVote(notes(5, 5.5, 6, 6.5, 7)).moyenne).toBe(6);
    expect(statsVote(notes(5.5, 5.5, 5.5, 5.5, 6)).moyenne).toBe(5.6); // 5,6 exactement
    expect(statsVote(notes(3, 3, 3.5)).moyenne).toBe(3.2); // 3,1666… → 3,2
    expect(statsVote(notes(5, 5, 5, 5.5)).moyenne).toBe(5.1); // 5,125 → 5,1
    expect(statsVote(notes(5, 5, 5, 5, 5, 5, 5, 6.5)).moyenne).toBe(5.2); // 5,1875 → 5,2
    expect(statsVote(notes(5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 6)).moyenne).toBe(5.6); // 5,5625 → 5,6
    expect(statsVote(notes(5, 5, 5, 5, 5, 5, 5, 5.5)).moyenne).toBe(5.1); // 5,0625 → 5,1
  });

  it("écart-type de la population", () => {
    expect(statsVote(notes(5, 5, 5, 5, 5)).ecartType).toBe(0);
    expect(statsVote(notes(4, 6)).ecartType).toBe(1);
    expect(statsVote(notes(2, 4, 6, 8, 10)).ecartType).toBe(2.83);
  });

  it("jury divisé : écart-type ≥ 1,5 EXACTEMENT à la borne", () => {
    expect(statsVote(notes(3.5, 6.5)).ecartType).toBe(1.5);
    expect(statsVote(notes(3.5, 6.5)).juryDivise).toBe(true);
    expect(statsVote(notes(3.5, 6)).juryDivise).toBe(false);
    expect(statsVote(notes(3, 6, 3, 6)).juryDivise).toBe(true);
  });

  it("consensus suspect : écart-type ≤ 0,5 EXACTEMENT à la borne", () => {
    expect(statsVote(notes(5, 6)).ecartType).toBe(0.5);
    expect(statsVote(notes(5, 6)).consensusSuspect).toBe(true);
    expect(statsVote(notes(5, 6.5)).consensusSuspect).toBe(false);
    expect(statsVote(notes(5, 5, 5, 5, 5)).consensusSuspect).toBe(true);
  });

  it("verdict de la moyenne : GO ≥ 6, NO-GO ≤ 4,5, PIVOT entre les deux (bornes exactes)", () => {
    expect(statsVote(notes(6, 6, 6, 6)).verdictMoyenne).toBe("GO");
    expect(statsVote(notes(5.5, 6.5, 5.5, 6.5)).verdictMoyenne).toBe("GO");
    expect(statsVote(notes(5.5, 6, 5.5, 6)).verdictMoyenne).toBe("PIVOT"); // 5,75
    expect(statsVote(notes(4.5, 4.5, 4.5, 4.5)).verdictMoyenne).toBe("NO-GO");
    expect(statsVote(notes(4.5, 5, 4.5, 4.5)).verdictMoyenne).toBe("PIVOT"); // 4,625
  });

  it("aucun vote : rien n'est calculé", () => {
    expect(statsVote([])).toMatchObject({ n: 0, moyenne: null, ecartType: null, verdictMoyenne: null, verdictMajorite: null });
  });
});

describe("tally : règle v1 du plan v3.0", () => {
  const avant = notes(6, 5.5, 5, 4, 3.5);

  it("majorité stricte : 3 voix sur 5 l'emporte", () => {
    const r = tally(avant, [v(6.5), v(6), v(6), v(5), v(4.5)]);
    expect(r.verdictJury).toBe("GO");
    expect(r.regleAppliquee).toBe("majorite");
    expect(r.repartition).toEqual({ GO: 3, PIVOT: 1, "NO-GO": 1 });
  });

  it("3 voix sur 4 l'emporte ; 2-2 avec 4 votes est une égalité départagée par la moyenne", () => {
    expect(tally(avant, [v(6.5), v(6), v(6), v(5)]).regleAppliquee).toBe("majorite");
    const egalite = tally(avant, [v(6.5), v(6), v(5), v(5)]); // 2 GO, 2 PIVOT, moyenne 5,625
    expect(egalite.regleAppliquee).toBe("egalite_moyenne");
    expect(egalite.verdictJury).toBe("PIVOT");
    expect(egalite.noteApres).toBe(5.6);
  });

  it("égalité 2 GO, 2 PIVOT, 1 NO-GO : la moyenne tranche", () => {
    const r = tally(avant, [v(6.5), v(7), v(5), v(5.5), v(4)]); // 2 GO, 2 PIVOT, 1 NO-GO ; moyenne 5,6
    expect(r.regleAppliquee).toBe("egalite_moyenne");
    expect(r.verdictJury).toBe("PIVOT");
  });

  it("égalité départagée par la moyenne à ≥ 6 → GO, à ≤ 4,5 → NO-GO", () => {
    expect(tally(avant, [v(8), v(8, "PIVOT"), v(3.5, "NO-GO"), v(8), v(7, "PIVOT")]).verdictJury).toBe("GO");
    expect(tally(avant, [v(3, "PIVOT"), v(3, "PIVOT"), v(4, "NO-GO"), v(4, "NO-GO"), v(5.5, "PIVOT")].slice(0, 4)).verdictJury).toBe("NO-GO");
  });

  it("divergence : 3 GO notés 3,2 chacun… impossible ; 3 GO à 6 et 2 NO-GO à 0 → verdict GO, moyenne 3,6 → PIVOT, divergence signalée", () => {
    const r = tally(avant, [v(6), v(6), v(6), v(0), v(0)]);
    expect(r.verdictJury).toBe("GO");
    expect(r.regleAppliquee).toBe("majorite");
    expect(r.noteApres).toBe(3.6);
    expect(r.divergence).toBe(true);
    expect(prononcer(r)).toContain("la moyenne des notes diverge");
  });

  it("3 GO avec moyenne exactement 6,0 : pas de divergence", () => {
    const r = tally(avant, [v(6), v(6), v(6), v(6), v(6)]);
    expect(r.divergence).toBe(false);
    expect(r.noteApres).toBe(6);
  });

  it("quorum : 3 votes valides sur 5 → pas de verdict pour ce tour", () => {
    expect(verdictDuTour(statsVote(notes(6, 6, 6))).verdict).toBe("AJOURNE");
    const r = tally(notes(6, 6, 6), notes(6, 6, 6, 6, 6));
    expect(r.verdictJury).toBe("AJOURNE");
    expect(r.phrase).toBe("Procès ajourné.");
    expect(r.noteAvant).toBeNull();
    expect(r.quorumAvant).toBe(false);
  });

  it("revote sans quorum : le verdict se fonde sur le vote 1, mention « revote sans quorum »", () => {
    const r = tally(notes(5, 5.5, 5.5, 5, 6), notes(6, 6));
    expect(r.revoteSansQuorum).toBe(true);
    expect(r.noteApres).toBeNull();
    expect(r.verdictJury).toBe("PIVOT");
    expect(r.phrase).toBe("Modifie ton plan.");
    expect(prononcer(r)).toContain("revote n'a pas réuni le quorum");
  });

  it("phrase finale : les 4 cas du plan", () => {
    const go = [v(6), v(6.5), v(7), v(6), v(6)];
    const pivot = notes(5, 5, 5, 5, 5);
    const nogo = notes(3, 3, 3, 3, 3);
    expect(tally(go, go).phrase).toBe("Lance.");
    expect(tally(pivot, go).phrase).toBe("Modifie ton plan : la version corrigée peut être lancée.");
    expect(tally(nogo, go).phrase).toBe("Modifie ton plan : la version corrigée peut être lancée.");
    expect(tally(go, pivot).phrase).toBe("Modifie ton plan.");
    expect(tally(go, nogo).phrase).toBe("Ne lance pas.");
  });

  it("note finale = moyenne du revote, et la même fonction donne la note du vote 1 (avant → après)", () => {
    const r = tally(notes(3, 3.5, 3.5, 3, 4), notes(5.5, 6, 5.5, 5.5, 6));
    expect(r.noteAvant).toBe(3.4);
    expect(r.noteApres).toBe(5.7);
  });
});

describe("tally : test exhaustif (toutes les combinaisons de 4 et 5 notes, par pas de 0,5)", () => {
  const valeurs = Array.from({ length: 21 }, (_, i) => i / 2);
  const combinaisons: number[][] = [];
  const gen = (reste: number, depart: number, acc: number[]) => {
    if (reste === 0) return void combinaisons.push([...acc]);
    for (let i = depart; i < valeurs.length; i++) gen(reste - 1, i, [...acc, valeurs[i]]);
  };
  gen(4, 0, []);
  gen(5, 0, []);

  it(`${combinaisons.length} combinaisons : les verdicts, la moyenne et les bornes tiennent`, () => {
    for (const n of combinaisons) {
      const votes = n.map((x) => v(x));
      const s = statsVote(votes);
      const exact = n.reduce((a, b) => a + b, 0) / n.length;
      // la moyenne arrondie est à 0,05 près de la moyenne exacte
      expect(Math.abs(s.moyenne! - exact)).toBeLessThanOrEqual(0.0500001);
      // verdict de la moyenne exact, sans erreur de virgule flottante
      const attendu = exact >= 6 ? "GO" : exact <= 4.5 ? "NO-GO" : "PIVOT";
      expect(s.verdictMoyenne, n.join(",")).toBe(attendu);
      // écart-type : mêmes bornes que la définition
      const sd = Math.sqrt(n.reduce((a, b) => a + (b - exact) ** 2, 0) / n.length);
      if (Math.abs(sd - 1.5) > 1e-9) expect(s.juryDivise, n.join(",")).toBe(sd > 1.5);
      if (Math.abs(sd - 0.5) > 1e-9) expect(s.consensusSuspect, n.join(",")).toBe(sd < 0.5);
      // une majorité stricte existe si et seulement si un verdict a plus de la moitié des voix
      const max = Math.max(...Object.values(s.repartition));
      expect(s.verdictMajorite !== null).toBe(2 * max > n.length);
    }
  });

  it("toujours un verdict à 4 ou 5 votes valides, et la divergence n'existe qu'avec une majorité", () => {
    for (const n of combinaisons) {
      const r = tally(notes(5, 5, 5, 5, 5), n.map((x) => v(x)));
      expect(["GO", "PIVOT", "NO-GO"]).toContain(r.verdictJury);
      if (r.divergence) expect(r.regleAppliquee).toBe("majorite");
    }
  });
});

describe("objections : classement pour le Juge", () => {
  const dossiers = [
    { agent: "investisseur" as const, arguments: [{ id: "INV-A1", sens: "pour", these: "p" }, { id: "INV-A2", sens: "contre", these: "échelle" }] },
    { agent: "cliente" as const, arguments: [{ id: "CLI-A1", sens: "contre", these: "marge" }], objections: [{ id: "CLI-O1", citation: "le dimanche" }] },
    { agent: "concurrent" as const, arguments: [{ id: "CON-A1", sens: "contre", these: "prix" }] },
  ];
  const votes1 = { investisseur: { verdict: "GO" as const }, cliente: { verdict: "PIVOT" as const }, concurrent: { verdict: "NO-GO" as const } };

  it("ne garde que les arguments « contre » et les objections de la Cliente", () => {
    const r = classerObjections({ dossiers, debats: [], votes1 });
    expect(r.map((o) => o.id).sort()).toEqual(["CLI-A1", "CLI-O1", "CON-A1", "INV-A2"]);
  });

  it("score = somme des poids des soutiens (NO-GO 2, PIVOT 1,5, GO 1) ; un juré qui concède soutient", () => {
    const debats = [{ agent: "concurrent" as const, repliques: [{ type: "concede" as const, vise: "INV-A2", texte: "", appuis: ["CON-1"] }] }];
    const r = classerObjections({ dossiers, debats, votes1 });
    expect(r[0]).toMatchObject({ id: "INV-A2", score: 3, soutiens: ["investisseur", "concurrent"] }); // 1 + 2
    expect(r.find((o) => o.id === "CON-A1")?.score).toBe(2);
    expect(r.find((o) => o.id === "CLI-O1")?.score).toBe(1.5);
  });

  it("une réplique qui conteste ne soutient pas ; au plus 5 objections, départage par id", () => {
    const debats = [{ agent: "concurrent" as const, repliques: [{ type: "conteste" as const, vise: "INV-A2", texte: "", appuis: ["CON-1"] }] }];
    expect(classerObjections({ dossiers, debats, votes1 }).find((o) => o.id === "INV-A2")?.score).toBe(1);
    expect(classerObjections({ dossiers, debats: [], votes1, max: 2 })).toHaveLength(2);
  });
});
