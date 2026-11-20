import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { piecesDuGreffe, creerSourcesMock } from "@/lib/registry";
import { supprimerChampsPersonnels } from "@/lib/registry/nettoyage";
import { PiecesDuGreffe, Saisie } from "@/lib/schemas";

// G9 — registry-strip : une réponse de registre MOCK avec dirigeants → aucun nom transmis au Greffier.
const FIX = join(process.cwd(), "fixtures/restaurants");
const lire = (f: string) => JSON.parse(readFileSync(join(FIX, f), "utf8"));
const saisie: Saisie = lire("saisie.json");

describe("pièces du greffe : aucune donnée personnelle ne passe", () => {
  it("la fixture brute contient bien des dirigeants (sinon le test ne prouve rien)", () => {
    const brut = JSON.stringify(lire("registre.json"));
    expect(brut).toContain("dirigeants");
    expect(brut).toContain("EXEMPLE");
    expect(brut).toContain("JEAN");
    expect(brut).toContain("Gérant");
  });

  it("les pièces rendues ne contiennent ni dirigeant, ni nom, ni adresse de personne", async () => {
    const pieces = await piecesDuGreffe(saisie, creerSourcesMock());
    const texte = JSON.stringify(pieces);
    for (const interdit of ["dirigeants", "EXEMPLE", "JEAN", "Jean", "Gérant", "RUE EXEMPLE", "1975", "prenoms"]) {
      expect(texte, `« ${interdit} » ne doit pas passer`).not.toContain(interdit);
    }
    expect(PiecesDuGreffe.safeParse(pieces).success).toBe(true);
  });

  it("le résultat est exactement la fixture pieces.json (aucune différence)", async () => {
    expect(await piecesDuGreffe(saisie, creerSourcesMock())).toEqual(lire("pieces.json"));
  });

  it("supprimerChampsPersonnels retire en profondeur les champs de config.ts, sans toucher l'entrée", () => {
    const entree = {
      a: { dirigeants: [{ nom: "X" }], email: "x@y.fr", ok: 1 },
      liste: [{ telephone: "0102030405", elus: [], siege: { adresse: "1 rue", libelle_commune: "LYON" } }],
    };
    const copie = JSON.parse(JSON.stringify(entree));
    const sortie = supprimerChampsPersonnels(entree);
    expect(sortie).toEqual({ a: { ok: 1 }, liste: [{ siege: { libelle_commune: "LYON" } }] });
    expect(entree).toEqual(copie);
  });

  it("même si l'API ajoute un champ personnel inconnu à la correspondance, la liste blanche l'écarte", async () => {
    const sources = creerSourcesMock();
    const brut = (await sources.registre("x")) as { results: Record<string, unknown>[] };
    brut.results[0].telephone = "0601020304";
    brut.results[0].contact = { email: "gerant@exemple.test" };
    const pieces = await piecesDuGreffe(saisie, { registre: async () => brut, commune: sources.commune });
    const texte = JSON.stringify(pieces);
    expect(texte).not.toContain("0601020304");
    expect(texte).not.toContain("gerant@");
  });
});
