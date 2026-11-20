import { describe, expect, it } from "vitest";
import { piecesDuGreffe } from "@/lib/registry";
import { normaliserCorrespondance } from "@/lib/registry/nettoyage";
import type { Saisie } from "@/lib/schemas";

// G9 — sole-trader-mask : une entreprise individuelle (nom d'une personne) → dénomination masquée.
const saisie: Saisie = { nom: "Atelier Exemple", offre: "ateliers", cible: "particuliers", prix: null, ville: "Lyon", pays: "FR", probleme: null };

const entreprise = (nature: string, nom: string) => ({
  siren: "999000002",
  nom_complet: nom,
  activite_principale: "56.10A",
  date_creation: "2020-01-15",
  etat_administratif: "A",
  nature_juridique: nature,
  siege: { libelle_commune: "LYON" },
  dirigeants: [{ nom: "DUPONT", prenoms: "MARIE", qualite: "Entrepreneur individuel" }],
});

describe("entreprise individuelle : dénomination masquée", () => {
  it("nature juridique 1000 : on garde « entreprise individuelle », l'activité, la commune et l'état", () => {
    const c = normaliserCorrespondance(entreprise("1000", "DUPONT MARIE (FICTIVE)"));
    expect(c).toEqual({
      denomination: "entreprise individuelle",
      siren: "999000002",
      activite_naf: "56.10A",
      commune: "Lyon",
      date_creation: "2020-01-15",
      etat: "active",
      source_url: "https://annuaire-entreprises.data.gouv.fr/entreprise/999000002",
    });
  });

  it("toute la famille 1xxx est masquée (entrepreneur individuel, EIRL…)", () => {
    for (const nature of ["1000", "1100", "1200"]) {
      expect(normaliserCorrespondance(entreprise(nature, "DUPONT MARIE"))?.denomination).toBe("entreprise individuelle");
    }
  });

  it("une société garde sa dénomination", () => {
    expect(normaliserCorrespondance(entreprise("5710", "BRIGADE DU GOURMET (FICTIVE)"))?.denomination).toBe("BRIGADE DU GOURMET (FICTIVE)");
  });

  it("le nom d'une personne n'atteint jamais le Greffier, même avec ses dirigeants", async () => {
    const pieces = await piecesDuGreffe(saisie, {
      registre: async () => ({ results: [entreprise("1000", "DUPONT MARIE (FICTIVE)")] }),
      commune: async () => [{ nom: "Lyon", code: "69123", codeDepartement: "69", population: 500000, departement: { code: "69", nom: "Rhône" } }],
    });
    const texte = JSON.stringify(pieces);
    expect(texte).not.toContain("DUPONT");
    expect(texte).not.toContain("MARIE");
    expect(pieces.correspondances[0].denomination).toBe("entreprise individuelle");
  });
});
