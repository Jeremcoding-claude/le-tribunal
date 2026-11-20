import { describe, expect, it } from "vitest";
import { comparer, contientValeur, estUnPrix, extraireNombres, lirePrix, retirerPrix } from "@/lib/guardrails/numbers";

const valeurs = (t: string) => extraireNombres(t).map((n) => n.valeur);

describe("extraireNombres (formats français)", () => {
  it("lit « 1 234,5 », « 160 000 » et les espaces insécables", () => {
    expect(valeurs("Un total de 1 234,5 unités")).toEqual([1234.5]);
    expect(valeurs("160 000 établissements")).toEqual([160000]);
    expect(valeurs("1 234 567")).toEqual([1234567]);
  });

  it("lit les pourcentages et les devises", () => {
    const [p] = extraireNombres("croissance de 12 % par an");
    expect(p.valeur).toBe(12);
    expect(p.unite).toBe("%");
    const [e] = extraireNombres("149 €/mois");
    expect(e.valeur).toBe(149);
    expect(e.unite).toBe("€");
  });

  it("applique les multiplicateurs : « 1,2 Md€ », « 3 k », « 3 M€ »", () => {
    expect(valeurs("levée de 1,2 Md€")).toEqual([1.2e9]);
    expect(valeurs("environ 3 k clients")).toEqual([3000]);
    expect(valeurs("3 M€ levés")).toEqual([3e6]);
  });

  it("ne multiplie pas « mois » ni « minutes » et lit plusieurs nombres dans l'ordre", () => {
    expect(valeurs("12 mois puis 10 minutes")).toEqual([12, 10]);
  });

  it("ne lit pas un numéro de ligne ou d'identifiant collé à une lettre (L10, A12)", () => {
    expect(valeurs("Ligne L10 et le code A12")).toEqual([]);
  });

  it("garde la position et le texte lu", () => {
    const [n] = extraireNombres("prix : 149 € par mois");
    expect(n.texte).toBe("149 €");
    expect(n.debut).toBe(7);
  });
});

describe("comparer (tolérance ±1 %)", () => {
  it("accepte l'égalité et un écart de 1 % au plus", () => {
    expect(comparer(42, 42)).toBe(true);
    expect(comparer(100, 100.9)).toBe(true);
    expect(comparer(100, 102)).toBe(false);
    expect(comparer(0, 0)).toBe(true);
  });
  it("refuse 42 face à 24 (value-not-in-extract)", () => {
    expect(comparer(42, 24)).toBe(false);
  });
  it("accepte une tolérance explicite", () => {
    expect(comparer(100, 105, 10)).toBe(true);
  });
  it("contientValeur cherche un nombre dans un texte", () => {
    expect(contientValeur("42 % des entreprises", 42)).toBe(true);
    expect(contientValeur("24 % des entreprises", 42)).toBe(false);
  });
});

describe("prix", () => {
  it("lirePrix : montant, devise, période, HT/TTC", () => {
    expect(lirePrix("149 € par mois")).toMatchObject({ montant: 149, devise: "EUR", periode: "mois", htOuTtc: "inconnu", texte: "149 € par mois" });
    expect(lirePrix("à 30 €/commande")).toMatchObject({ montant: 30, periode: "commande", texte: "30 €/commande" });
    expect(lirePrix("49 € HT par mois")).toMatchObject({ montant: 49, htOuTtc: "ht", periode: "mois" });
    expect(lirePrix("gratuit")).toMatchObject({ montant: 0 });
    expect(lirePrix("agents IA pour restaurants")).toBeNull();
  });

  it("estUnPrix : l'élément entier n'est qu'un prix", () => {
    expect(estUnPrix("149 € par mois")).toBe(true);
    expect(estUnPrix("à 149 €/mois")).toBe(true);
    expect(estUnPrix("gratuit")).toBe(true);
    expect(estUnPrix("agents IA à 149 € par mois")).toBe(false);
    expect(estUnPrix("Lyon")).toBe(false);
  });

  it("retirerPrix : le reste de l'élément, sans le prix", () => {
    expect(retirerPrix("agents IA à 149 € par mois")).toBe("agents IA");
    expect(retirerPrix("logiciel de paie pour 29 €/mois")).toBe("logiciel de paie");
    expect(retirerPrix("agents IA")).toBe("agents IA");
  });
});
