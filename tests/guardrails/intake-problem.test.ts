import { describe, expect, it } from "vitest";
import { decouperSaisie } from "@/lib/trial/intake";

// G10 — intake-problem : « car … » → problème ; la ville reste le dernier élément.
describe("intake : le problème réglé (facultatif)", () => {
  for (const marqueur of ["car", "parce que", "problème :"]) {
    it(`« ${marqueur} … » est le problème, la ville reste Lyon`, () => {
      const r = decouperSaisie(`Brigade IA, agents IA, aux restaurants indépendants, 149 € par mois, Lyon, ${marqueur} les gérants perdent du temps`);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.saisie.ville).toBe("Lyon");
        expect(r.saisie.probleme).toBe("les gérants perdent du temps");
        expect(r.saisie.cible).toBe("restaurants indépendants");
      }
    });
  }

  it("une virgule dans le problème ne casse pas la ville", () => {
    const r = decouperSaisie("Brigade IA, agents IA, aux restaurants, 149 € par mois, Lyon, car les gérants perdent du temps, de l'argent et des clients");
    expect(r.ok && r.saisie).toMatchObject({ ville: "Lyon", probleme: "les gérants perdent du temps, de l'argent et des clients" });
  });

  it("sans problème, il vaut null", () => {
    const r = decouperSaisie("Brigade IA, agents IA, aux restaurants, Lyon");
    expect(r.ok && r.saisie.probleme).toBeNull();
  });

  it("le pays entre parenthèses est extrait de la ville", () => {
    const r = decouperSaisie("Brigade IA, agents IA, aux restaurants, 149 € par mois, Bruxelles (Belgique)");
    expect(r.ok && r.saisie).toMatchObject({ ville: "Bruxelles", pays: "BE" });
    const iso = decouperSaisie("Brigade IA, agents IA, aux restaurants, Genève (CH)");
    expect(iso.ok && iso.saisie).toMatchObject({ ville: "Genève", pays: "CH" });
  });

  it("un pays inconnu est refusé, pas deviné", () => {
    const r = decouperSaisie("Brigade IA, agents IA, aux restaurants, Quelquepart (Atlantide)");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("Pays inconnu");
  });

  it("« en ligne » et « France entière » sont des villes valides", () => {
    for (const v of ["en ligne", "France entière"]) {
      const r = decouperSaisie(`Brigade IA, agents IA, aux restaurants, 149 € par mois, ${v}`);
      expect(r.ok && r.saisie.ville).toBe(v);
    }
  });
});
