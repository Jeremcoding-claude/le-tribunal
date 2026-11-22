import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEBUT_SECTION, FIN_SECTION, lireEnregistrements, mettreAJourReadme, sectionCout, statsCouts } from "@/lib/trial/couts";

const e = (id: string, coutUsd: number, parPhase: Record<string, number>) => ({ id, date: "2026-11-22", coutUsd, parPhase });

describe("coût mesuré (npm run cost)", () => {
  it("moyenne, minimum, maximum et répartition par phase", () => {
    const s = statsCouts([e("a", 1, { P2: 0.6, P3: 0.4 }), e("b", 3, { P2: 2, P3: 1 })])!;
    expect(s).toMatchObject({ n: 2, moyen: 2, min: 1, max: 3 });
    expect(s.parPhase[0]).toMatchObject({ phase: "P2", moyen: 1.3 });
    expect(s.parPhase.reduce((a, p) => a + p.part, 0)).toBeCloseTo(1);
  });
  it("aucun enregistrement = pas de statistiques, et la section le dit sans inventer de chiffre", () => {
    expect(statsCouts([])).toBeNull();
    expect(sectionCout(null)).toContain("Aucun procès réel mesuré");
  });
  it("lecture du fichier : ignore les lignes illisibles et les coûts nuls (MOCK)", () => {
    const f = join(mkdtempSync(join(tmpdir(), "cout-")), "couts.jsonl");
    writeFileSync(f, [JSON.stringify(e("ok", 1.5, { P2: 1.5 })), "pas du json", JSON.stringify(e("mock", 0, {}))].join("\n"));
    expect(lireEnregistrements(f).map((x) => x.id)).toEqual(["ok"]);
    expect(lireEnregistrements(join(tmpdir(), "absent-xyz.jsonl"))).toEqual([]);
  });
  it("met à jour la section du README entre les marqueurs, sans toucher le reste, et la crée si absente", () => {
    const s = sectionCout(statsCouts([e("a", 2, { P2: 2 })]));
    expect(s).toContain("2,00 $");
    const readme = `# T\n\navant\n${DEBUT_SECTION}\nvieux\n${FIN_SECTION}\napres\n`;
    const m = mettreAJourReadme(readme, s);
    expect(m).toContain("avant");
    expect(m).toContain("apres");
    expect(m).not.toContain("vieux");
    expect(mettreAJourReadme(m, s)).toBe(m);
    expect(mettreAJourReadme("# T\n", s)).toContain(DEBUT_SECTION);
  });
});
