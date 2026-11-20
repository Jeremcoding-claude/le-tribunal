import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decouperSaisie } from "@/lib/trial/intake";

// G10 — intake-reference : les deux formes du cas de référence donnent la même saisie (plan §3.3.1).
const attendu = JSON.parse(readFileSync(join(process.cwd(), "fixtures/restaurants/saisie.json"), "utf8"));

describe("intake : cas de référence", () => {
  it("« Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon » : le prix dans l'offre est extrait", () => {
    const r = decouperSaisie("Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.saisie).toEqual(attendu);
      expect(r.prix).toMatchObject({ montant: 149, devise: "EUR", periode: "mois" });
    }
  });

  it("« Brigade IA, agents IA, aux restaurants indépendants, 149 € par mois, Lyon » : prix à part, marqueur « aux » retiré", () => {
    const r = decouperSaisie("Brigade IA, agents IA, aux restaurants indépendants, 149 € par mois, Lyon");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.saisie).toEqual(attendu);
  });

  it("le texte de la fixture saisie.txt donne la saisie de saisie.json", () => {
    const txt = readFileSync(join(process.cwd(), "fixtures/restaurants/saisie.txt"), "utf8");
    const r = decouperSaisie(txt);
    expect(r.ok && r.saisie).toEqual(attendu);
  });

  it("l'exemple long du plan, avec le problème", () => {
    const r = decouperSaisie("Brigade IA, agents IA qui gèrent réservations et avis, aux restaurants indépendants, 149 € par mois, Lyon, car les gérants perdent du temps sur l'administratif");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.saisie).toMatchObject({
        nom: "Brigade IA",
        offre: "agents IA qui gèrent réservations et avis",
        cible: "restaurants indépendants",
        prix: "149 € par mois",
        ville: "Lyon",
        pays: "FR",
        probleme: "les gérants perdent du temps sur l'administratif",
      });
    }
  });
});
