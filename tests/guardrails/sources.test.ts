import { describe, expect, it } from "vitest";
import { creerRechercheMock } from "@/lib/search/mock";
import type { Affirmation, CaseFile, LedgerLine, Ruling } from "@/lib/schemas";
import { verifierDossierApi, verifierDossierParLecture, verifierLecture, verifierNombresLibres, verifierNombresRuling, verifierProposition } from "@/lib/trial/verifier";
import { AGENTS5, evidenceDe, fix, piege } from "../helpers";

// Tests piégés de l'étape 5 (plan §5.2) : G1 (chiffres inventés), G4 (jeu de rôle ≠ preuve), G11 (proposition sans appui).
// Chaque fixture piégée est VALIDE pour le schéma (étape 2) : c'est le vérificateur qui la rejette.

describe("G1 · invented-number : URL absente des résultats de l'appel → rejet", () => {
  it("un fait dont l'URL n'a jamais été renvoyée par les outils est rejeté, avec ce qui s'appuie dessus", async () => {
    const d = fix("instruction/investisseur.json");
    const evidence = evidenceDe(d.affirmations);
    evidence.urlsRenvoyees = evidence.urlsRenvoyees.filter((u) => u !== "https://exemple.test/insee-restauration");
    const r = await verifierDossierApi(d, evidence);
    expect(r.rejetees.find((x) => x.id === "INV-1")?.raison).toBe("URL absente des résultats des outils");
    expect(r.rejetees.map((x) => x.id)).toContain("INV-2");
    expect(r.voteValide).toBe(false);
  });
});

describe("G1 · extract-mismatch : extrait absent de la page / du passage cité → rejet", () => {
  it("mode API : l'extrait n'est dans aucun passage cité", async () => {
    const d = fix("instruction/investisseur.json");
    const evidence = evidenceDe(d.affirmations);
    d.affirmations[0].extrait = "160 000 établissements de restauration inventés par l'agent";
    const r = await verifierDossierApi(d, evidence);
    expect(r.rejetees.find((x) => x.id === "INV-1")?.raison).toBe("extrait absent des passages cités par l'API");
  });

  it("mode lecture : l'extrait n'est pas dans la page relue par le code", async () => {
    const d = fix("instruction/investisseur.json");
    d.affirmations[0].extrait = "160 000 établissements de restauration inventés par l'agent";
    const r = await verifierDossierParLecture(d, (u) => creerRechercheMock().lire(u));
    expect(r.rejetees.find((x) => x.id === "INV-1")?.raison).toBe("extrait absent de la page");
    expect(r.rejetees.map((x) => x.id)).toContain("INV-2");
  });

  it("mode lecture : une page introuvable rejette le fait", async () => {
    const d = fix("instruction/investisseur.json");
    d.affirmations[0].source_url = "https://exemple.test/page-inconnue";
    const r = await verifierDossierParLecture(d, (u) => creerRechercheMock().lire(u));
    expect(r.rejetees.find((x) => x.id === "INV-1")?.raison).toBe("page illisible ou introuvable");
  });

  it("mode lecture : une citation inconnue (source et extrait à null) est rejetée", async () => {
    const d = fix("instruction/investisseur.json");
    d.affirmations[2].source_url = null;
    d.affirmations[2].extrait = null;
    const r = await verifierDossierParLecture(d, (u) => creerRechercheMock().lire(u));
    expect(r.rejetees.find((x) => x.id === "INV-3")?.raison).toContain("sans source");
  });
});

describe("G1 · value-not-in-extract : 42 % annoncé, l'extrait dit 24 % → rejet", () => {
  it("fixture piégée", async () => {
    const p = piege("value-not-in-extract");
    const r = await verifierDossierApi(p.donnee, evidenceDe(p.donnee.affirmations));
    expect(r.rejetees).toContainEqual({ id: "INV-1", raison: "la valeur 42 n'est pas dans l'extrait" });
    expect(r.rejetees.map((x) => x.id)).toContain("INV-2");
  });
  it("à la tolérance près : 160 000 pour « 160 500 » passe, pour « 150 000 » non", async () => {
    const d = fix("instruction/investisseur.json");
    d.affirmations[0].extrait = "160 500 établissements de restauration indépendants";
    expect((await verifierDossierApi(d, evidenceDe(d.affirmations))).rejetees).toEqual([]);
    d.affirmations[0].extrait = "150 000 établissements de restauration indépendants";
    expect((await verifierDossierApi(d, evidenceDe(d.affirmations))).rejetees.map((x) => x.id)).toContain("INV-1");
  });
});

describe("G1 · juriste-non-officiel : source du Juriste hors juristeDomains → rejet", () => {
  it("fixture piégée : un forum juridique", async () => {
    const p = piege("juriste-non-officiel");
    const r = await verifierDossierApi(p.donnee, evidenceDe(p.donnee.affirmations));
    expect(r.rejetees.find((x) => x.id === "JUR-1")?.raison).toContain("hors des domaines officiels");
    expect(r.rejetees.find((x) => x.id === "JUR-1")?.raison).toContain("exemple.test");
  });
  it("le dossier du Juriste de référence (domaine officiel) passe", async () => {
    const d = fix("instruction/juriste.json");
    expect((await verifierDossierApi(d, evidenceDe(d.affirmations))).rejetees).toEqual([]);
  });
  it("la même source n'est pas refusée à un autre juré", async () => {
    const p = piege("juriste-non-officiel");
    const autre = { ...p.donnee, agent: "concurrent" };
    expect((await verifierDossierApi(autre, evidenceDe(autre.affirmations))).rejetees).toEqual([]);
  });
});

describe("G4 · roleplay-number : « en 10 minutes » sans source → rejet", () => {
  it("fixture piégée : la réplique de la Cliente", async () => {
    const p = piege("roleplay-number");
    const r = await verifierDossierApi(p.donnee, evidenceDe(p.donnee.affirmations));
    expect(verifierNombresLibres(p.donnee, r.acceptees)).toEqual([{ id: "replique", raison: "nombre(s) sans appui : 10" }]);
  });
  it("accepté avec une affirmation sourcée (valeur et unité)", async () => {
    const d = fix("instruction/cliente.json");
    d.affirmations.push({ id: "CLI-7", texte: "Un gérant passe 10 minutes par jour sur ses avis.", valeur: 10, unite: "minutes", type: "fait", base: [], source_url: "https://exemple.test/enquete-gerants", extrait: "10 minutes par jour sur ses avis" });
    d.replique = "Je peux le faire moi-même en 10 minutes le dimanche.";
    const r = await verifierDossierApi(d, evidenceDe(d.affirmations));
    expect(verifierNombresLibres(d, r.acceptees)).toEqual([]);
  });
  it("accepté avec une estimation fondée sur des faits sourcés", async () => {
    const d = fix("instruction/cliente.json");
    d.affirmations.push({ id: "CLI-8", texte: "Estimation : 10 minutes par semaine.", valeur: 10, unite: "minutes", type: "estimation", base: ["CLI-3"], source_url: null, extrait: null });
    d.replique = "Je peux le faire moi-même en 10 minutes le dimanche.";
    const r = await verifierDossierApi(d, evidenceDe(d.affirmations));
    expect(verifierNombresLibres(d, r.acceptees)).toEqual([]);
  });
  it("sans la source, la phrase « Je peux le faire moi-même le dimanche » passe", async () => {
    const d = fix("instruction/cliente.json");
    const r = await verifierDossierApi(d, evidenceDe(d.affirmations));
    expect(verifierNombresLibres(d, r.acceptees)).toEqual([]);
  });
});

describe("G4 · ledger-mismatch : « Ligne 10 : 80 clients » alors que L10 = 9 → rejet", () => {
  it("fixture piégée", () => {
    const p = piege("ledger-mismatch");
    const r = verifierLecture(p.donnee.lecture, fix("ledger.json") as LedgerLine[]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("L10");
    expect(r[0].raison).toContain("80 ≠ la valeur de L10 (9)");
  });
});

describe("G4 · judge-new-number : le Juge n'a aucun outil, un chiffre sans id connu est rejeté", () => {
  const connues = [
    ...AGENTS5.flatMap((a) => (fix(`instruction/${a}.json`).affirmations as Affirmation[]).map((x) => x.valeur).filter((v): v is number => v !== null)),
    ...(fix("ledger.json") as LedgerLine[]).map((l) => l.valeur).filter((v): v is number => v !== null),
  ];
  it("fixture piégée : « un prix de 55 € par mois »", () => {
    const p = piege("judge-new-number");
    const r = verifierNombresRuling(p.donnee as Ruling, connues);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "par_ces_motifs" });
    expect(r[0].raison).toContain("55");
  });
  it("un nouveau prix fondé sur une estimation sourcée (79) est permis", () => {
    expect(verifierNombresRuling(fix("ruling.json") as Ruling, connues)).toEqual([]);
  });
  it("le Juge ne peut pas non plus glisser un nombre dans une condition", () => {
    const r = structuredClone(fix("ruling.json")) as Ruling;
    r.conditions_pour_lancer[0].condition = "Obtenir 37 restaurants pilotes payants";
    expect(verifierNombresRuling(r, connues)).toEqual([{ id: "conditions[0]", raison: "nombre(s) sans appui : 37" }]);
  });
});

describe("G11 · proposal-without-support : proposition sans appui vérifié ou avec un nombre inventé → rejet", () => {
  const acceptees = new Map<string, number | null>([["CLI-1", 4], ["CLI-2", 120], ["CLI-4", 79]]);
  it("fixture piégée : appuis vides", () => {
    const p = piege("proposition-sans-appui").donnee.proposition;
    expect(verifierProposition(p, acceptees)).toEqual([{ id: "CLI-P1", raison: "proposition sans appui" }]);
  });
  it("appui rejeté par le vérificateur (absent des affirmations acceptées)", () => {
    expect(verifierProposition({ id: "CLI-P1", texte: "t", appuis: ["CLI-3"] }, acceptees)[0].raison).toContain("CLI-3");
  });
  it("nombre inventé dans le texte", () => {
    expect(verifierProposition({ id: "CLI-P1", texte: "Un prix de 45 € par mois.", appuis: ["CLI-2", "CLI-4"] }, acceptees)[0].raison).toContain("45");
  });
  it("les propositions de référence passent toutes", () => {
    const toutes = new Map<string, number | null>();
    for (const a of AGENTS5) for (const x of fix(`instruction/${a}.json`).affirmations as Affirmation[]) toutes.set(x.id, x.valeur);
    for (const a of AGENTS5) {
      const p = fix(`debat/tour-2/${a}.json`).proposition;
      expect(verifierProposition(p, toutes), p.id).toEqual([]);
    }
  });
});

describe("cohérence du cas de référence", () => {
  it("le tableau de référence, la fixture du Comptable et le case file sont cohérents", () => {
    const caseFile = fix("greffier-redaction.json").case_file as CaseFile;
    expect(caseFile.prix.montant).toBe(149);
    expect((fix("ruling.json") as Ruling).plan_corrige.case_file_v2.prix.montant).toBe(79);
  });
});
