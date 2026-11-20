import { describe, expect, it } from "vitest";
import { decouperSaisie, EXEMPLE_SAISIE, FORMAT_SAISIE } from "@/lib/trial/intake";

// G10 — intake-3-parts : moins de 4 éléments (nom, offre, cible, ville) → refus, avec le format et un exemple.
describe("intake : éléments manquants", () => {
  it("3 éléments : refus avec le format, l'exemple et l'élément manquant", () => {
    const r = decouperSaisie("Brigade IA, agents IA, Lyon");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.manque).toEqual(["cible"]);
      expect(r.message).toContain("à qui");
      expect(r.message).toContain(FORMAT_SAISIE);
      expect(r.message).toContain(EXEMPLE_SAISIE);
      expect(r.format).toBe(FORMAT_SAISIE);
      expect(r.exemple).toBe(EXEMPLE_SAISIE);
    }
  });

  it("un prix ne tient pas lieu d'élément : nom, prix, ville → il manque l'offre et la cible", () => {
    const r = decouperSaisie("Brigade IA, 149 € par mois, Lyon");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.manque).toEqual(["offre", "cible"]);
  });

  it("une cible sans offre : « nom, aux restaurants, ville » → il manque l'offre", () => {
    const r = decouperSaisie("Brigade IA, aux restaurants indépendants, Lyon");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.manque).toEqual(["offre"]);
  });

  it("saisie vide ou à un seul élément", () => {
    const vide = decouperSaisie("   ");
    expect(vide.ok).toBe(false);
    if (!vide.ok) expect(vide.manque).toEqual(["nom", "offre", "cible", "ville"]);
    const un = decouperSaisie("Brigade IA");
    expect(un.ok).toBe(false);
    if (!un.ok) expect(un.manque).toEqual(["offre", "cible", "ville"]);
  });

  it("le prix est facultatif : sans prix, la saisie est valide (la question prix_absent sera posée en P1b)", () => {
    const r = decouperSaisie("Brigade IA, agents IA, aux restaurants indépendants, Lyon");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.saisie.prix).toBeNull();
      expect(r.prix).toBeNull();
    }
  });

  it("refuse une saisie de plus de 500 caractères", () => {
    const r = decouperSaisie("Brigade IA, " + "agents ".repeat(100) + ", aux restaurants, Lyon");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("500 caractères");
  });

  it("retire les caractères de contrôle", () => {
    const r = decouperSaisie("Brigade IA,\u0000 agents IA,\n aux restaurants indépendants, Lyon");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.saisie.cible).toBe("restaurants indépendants");
  });
});
