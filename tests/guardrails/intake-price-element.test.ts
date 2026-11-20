import { describe, expect, it } from "vitest";
import { decouperSaisie } from "@/lib/trial/intake";

// G10 — intake-price-element : « à 149 €/mois » seul est un prix, pas une cible, même s'il commence par « à ».
describe("intake : l'élément prix", () => {
  it("« à 149 €/mois » est lu comme prix et non comme cible", () => {
    const r = decouperSaisie("Brigade IA, agents IA, restaurants indépendants, à 149 €/mois, Lyon");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.saisie.cible).toBe("restaurants indépendants");
      expect(r.saisie.prix).toBe("149 €/mois");
      expect(r.prix).toMatchObject({ montant: 149, periode: "mois" });
    }
  });

  it("« agents IA à 149 € par mois » reste l'offre, le prix est extrait", () => {
    const r = decouperSaisie("Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon");
    expect(r.ok && r.saisie).toMatchObject({ offre: "agents IA", prix: "149 € par mois" });
  });

  it("le prix en premier élément du milieu", () => {
    const r = decouperSaisie("Brigade IA, 30 €/commande, agents IA, aux restaurants, Lyon");
    expect(r.ok && r.saisie).toMatchObject({ offre: "agents IA", cible: "restaurants", prix: "30 €/commande" });
  });

  it("« gratuit » est un prix à 0", () => {
    const r = decouperSaisie("Brigade IA, agents IA, aux restaurants, gratuit, Lyon");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.prix?.montant).toBe(0);
  });
});
