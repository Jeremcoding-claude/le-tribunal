import { describe, expect, it } from "vitest";
import { INITIALES_INTERDITES, PRENOMS_AGENTS, sansChiffresHorsHeures, verifierPrenomCliente } from "@/lib/trial/persona-prenom";

// G12 — « Un prénom de Cliente déjà pris, ou à initiale prise, rend la persona invalide » (plan §3.0).
describe("verifierPrenomCliente (G12)", () => {
  it("les initiales prises sont V, L, C, M, N", () => {
    expect([...INITIALES_INTERDITES].sort()).toEqual(["C", "L", "M", "N", "V"]);
  });

  it("accepte Sandrine, le prénom du cas de référence", () => {
    expect(verifierPrenomCliente("Sandrine")).toEqual({ ok: true });
  });

  it("rejette « Nadine » (initiale N, déjà prise par Nadia)", () => {
    const r = verifierPrenomCliente("Nadine");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toContain("initiale N");
  });

  it("rejette « Victoire » (initiale V)", () => {
    expect(verifierPrenomCliente("Victoire").ok).toBe(false);
  });

  it("rejette les cinq prénoms de la salle, accents et casse ignorés", () => {
    for (const prenom of Object.values(PRENOMS_AGENTS)) {
      expect(verifierPrenomCliente(prenom).ok).toBe(false);
      expect(verifierPrenomCliente(prenom.toUpperCase()).ok).toBe(false);
    }
    const r = verifierPrenomCliente("lea");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toContain("déjà le prénom d'un agent");
  });

  it("rejette un prénom vide, trop court ou avec des chiffres", () => {
    expect(verifierPrenomCliente("").ok).toBe(false);
    expect(verifierPrenomCliente("S").ok).toBe(false);
    expect(verifierPrenomCliente("Sandrine2").ok).toBe(false);
  });

  it("accepte des prénoms composés et accentués à initiale libre", () => {
    expect(verifierPrenomCliente("Anne-Sophie")).toEqual({ ok: true });
    expect(verifierPrenomCliente("Élodie")).toEqual({ ok: true });
  });
});

describe("sansChiffresHorsHeures", () => {
  it("accepte les heures de la journée type", () => {
    expect(sansChiffresHorsHeures("Ouverture 9 h, coup de feu midi, compta le dimanche")).toBe(true);
    expect(sansChiffresHorsHeures("Fermeture à 23h30")).toBe(true);
  });
  it("rejette tout autre chiffre", () => {
    expect(sansChiffresHorsHeures("Se méfie des abonnements de plus de 20 €")).toBe(false);
    expect(sansChiffresHorsHeures("Gère 3 restaurants")).toBe(false);
  });
});
