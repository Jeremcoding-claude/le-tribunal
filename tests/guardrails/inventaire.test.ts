import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// « Un garde-fou ajouté = un test piégé ajouté dans tests/guardrails/ » (CLAUDE.md). Ce test échoue si un fichier de
// src/lib/guardrails/ n'est importé par aucun test. config.ts est exempté ; numbers.ts a son test unitaire (étape 5).
const RACINE = process.cwd();
const testsDe = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? testsDe(join(d, n)) : n.endsWith(".test.ts") ? [join(d, n)] : []));
const tous = testsDe(join(RACINE, "tests"));
const contenu = new Map(tous.map((f) => [f, readFileSync(f, "utf8")]));

describe("inventaire des garde-fous", () => {
  const fichiers = readdirSync(join(RACINE, "src/lib/guardrails")).filter((f) => f.endsWith(".ts") && f !== "config.ts");

  it("la liste attendue des garde-fous existe", () => {
    expect(fichiers.sort()).toEqual(["budget.ts", "consensus.ts", "neutrality.ts", "numbers.ts", "privacy.ts", "redact.ts", "sanitize.ts"]);
  });

  for (const f of ["budget", "consensus", "neutrality", "numbers", "privacy", "redact", "sanitize"]) {
    it(`${f}.ts est testé`, () => {
      const importeurs = [...contenu].filter(([, t]) => t.includes(`guardrails/${f}"`)).map(([n]) => n);
      expect(importeurs.length, `aucun test n'importe guardrails/${f}`).toBeGreaterThan(0);
    });
  }

  it("au moins 18 tests piégés dans tests/guardrails/", () => {
    const piegeges = tous.filter((f) => f.replace(/\\/g, "/").includes("tests/guardrails/") && !f.endsWith("inventaire.test.ts"));
    const nombre = piegeges.reduce((s, f) => s + (contenu.get(f)!.match(/^\s*(?:it|it\.skipIf\([^)]*\))\(/gm)?.length ?? 0), 0);
    expect(nombre).toBeGreaterThanOrEqual(18);
  });

  it("chaque test piégé du tableau 5.2 prévu avant l'étape 8 a son fichier ou son bloc (G1 à G12)", () => {
    const noms = ["invented-number", "extract-mismatch", "value-not-in-extract", "juriste-non-officiel", "sealed-votes", "no-contest", "copycat", "flip-without-reason", "flattering-input", "raw-text-leak", "roleplay-number", "judge-new-number", "ledger-mismatch", "injection-page", "injection-input", "budget-cap", "max-uses", "juror-crash", "two-crashes", "resume", "redact", "client-bundle", "no-public-env", "registry-strip", "sole-trader-mask", "output-pii", "own-site-injection", "intake-3-parts", "intake-commas", "greffier-adds-field", "homonyms", "intake-price-element", "intake-reference", "intake-problem", "missing-price-question", "homonyms-question", "max-questions", "proposal-without-support", "prenoms-prompts", "persona-prenom"];
    const absents = noms.filter((n) => !tous.some((f) => f.replace(/\\/g, "/").includes("tests/guardrails/") && (f.includes(n) || contenu.get(f)!.includes(n))));
    expect(absents).toEqual([]);
  });
});
