import { describe, expect, it } from "vitest";
import { decouperSaisie } from "@/lib/trial/intake";

// G10 — intake-commas : une virgule dans l'offre → découpage correct (le Greffier confirmera ensuite).
describe("intake : virgule dans l'offre", () => {
  it("les éléments en trop s'ajoutent à l'offre", () => {
    const r = decouperSaisie("Brigade IA, agents IA, réservations et avis, aux restaurants indépendants, 149 € par mois, Lyon");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.saisie.offre).toBe("agents IA, réservations et avis");
      expect(r.saisie.cible).toBe("restaurants indépendants");
      expect(r.saisie.prix).toBe("149 € par mois");
      expect(r.saisie.ville).toBe("Lyon");
    }
  });

  it("sans marqueur de cible, le dernier élément du milieu est la cible (ordre naturel : nom, offre, cible)", () => {
    const r = decouperSaisie("Brigade IA, agents IA, restaurants indépendants, Lyon");
    expect(r.ok && r.saisie).toMatchObject({ offre: "agents IA", cible: "restaurants indépendants" });
  });

  it("chaque champ du découpage est un extrait de la saisie (le Greffier ne peut rien ajouter)", () => {
    const texte = "Brigade IA, agents IA, réservations et avis, pour les restaurants indépendants, 149 € par mois, Lyon";
    const r = decouperSaisie(texte);
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const champ of [r.saisie.nom, r.saisie.offre, r.saisie.cible, r.saisie.ville]) {
        for (const morceau of champ.split(", ")) expect(texte).toContain(morceau);
      }
    }
  });
});
