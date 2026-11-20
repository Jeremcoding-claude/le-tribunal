import { describe, expect, it } from "vitest";
import { creerClientMock } from "@/lib/llm/mock";
import { construireMission } from "@/lib/prompts/loader";
import { creerRechercheMock } from "@/lib/search/mock";
import { AGENTS5, evidenceDe, fix } from "../helpers";
import type { Affirmation, CaseFile, LedgerLine, Ruling } from "@/lib/schemas";
import {
  domaineOfficiel,
  nombresLibres,
  nombresSansAppui,
  verifierChangementsRuling,
  verifierDossierApi,
  verifierDossierParLecture,
  verifierLecture,
  verifierNombresLibres,
  verifierNombresRuling,
  verifierProposition,
} from "@/lib/trial/verifier";

describe("dossiers valides du cas de référence", () => {
  for (const agent of AGENTS5) {
    it(`${agent} : tout est accepté (mode API), nombres libres compris`, async () => {
      const d = fix(`instruction/${agent}.json`);
      const r = await verifierDossierApi(d, evidenceDe(d.affirmations));
      expect(r.rejetees).toEqual([]);
      expect(r.acceptees).toHaveLength(d.affirmations.length);
      expect(r.argumentsInvalides).toEqual([]);
      expect(r.voteValide).toBe(true);
      expect(verifierNombresLibres(d, r.acceptees)).toEqual([]);
    });
  }

  it("le client MOCK donne au vérificateur les mêmes preuves qu'une vraie recherche", async () => {
    const mock = creerClientMock();
    for (const agent of ["investisseur", "juriste", "concurrent", "cliente"] as const) {
      const m = construireMission({ agent, phase: "INSTRUCTION", mode: "api", donnees: {}, prenomCliente: "Sandrine" });
      const res = await mock.callAgent({ agent, phase: "INSTRUCTION", mission: m });
      const r = await verifierDossierApi(res.sortie as never, res.evidence);
      expect(r.rejetees, agent).toEqual([]);
    }
  });

  it("mode lecture : le code relit les pages MOCK et accepte tout", async () => {
    const d = fix("instruction/investisseur.json");
    const r = await verifierDossierParLecture(d, (u) => creerRechercheMock().lire(u));
    expect(r.rejetees).toEqual([]);
  });
});

describe("rejets et propagation", () => {
  it("un fait sans source est rejeté, et l'estimation qui s'appuie dessus aussi, puis l'argument et le vote", async () => {
    const d = fix("instruction/investisseur.json");
    d.affirmations[0].source_url = null; // INV-1
    const r = await verifierDossierApi(d, evidenceDe(d.affirmations));
    expect(r.rejetees.map((x) => x.id).sort()).toEqual(["INV-1", "INV-2"]);
    expect(r.rejetees.find((x) => x.id === "INV-2")?.raison).toContain("INV-1");
    expect(r.argumentsInvalides.map((x) => x.id).sort()).toEqual(["INV-A1", "INV-A2"]);
    expect(r.voteValide).toBe(false);
    expect(r.raisonVote).toContain("1 appui(s) vérifié(s) sur 2");
  });

  it("une base qui cite une estimation rejetée propage le rejet jusqu'au bout", async () => {
    const d = fix("instruction/investisseur.json");
    d.affirmations[0].extrait = "texte sans rapport";
    d.affirmations.push({ id: "INV-9", texte: "estimation de second rang", valeur: 1, unite: "", type: "estimation", base: ["INV-2"], source_url: null, extrait: null });
    const r = await verifierDossierApi(d, evidenceDe(fix("instruction/investisseur.json").affirmations));
    expect(r.rejetees.map((x) => x.id)).toEqual(expect.arrayContaining(["INV-1", "INV-2", "INV-9"]));
  });

  it("un vote à un seul appui vérifié est invalide", async () => {
    const d = fix("instruction/cliente.json");
    d.vote.appuis = ["CLI-1", "CLI-99"];
    const r = await verifierDossierApi(d, evidenceDe(d.affirmations));
    expect(r.voteValide).toBe(false);
  });

  it("une donnée de l'utilisateur et une estimation fondée sont acceptées", async () => {
    const d = fix("instruction/investisseur.json");
    const r = await verifierDossierApi(d, evidenceDe(d.affirmations));
    expect(r.acceptees).toEqual(expect.arrayContaining(["INV-5", "INV-2"]));
  });
});

describe("domaineOfficiel", () => {
  const liste = ["legifrance.gouv.fr", "cnil.fr"];
  it("accepte le domaine et ses sous-domaines, refuse le reste", () => {
    expect(domaineOfficiel("https://www.legifrance.gouv.fr/mock/x", liste)).toBe(true);
    expect(domaineOfficiel("https://cnil.fr/a", liste)).toBe(true);
    expect(domaineOfficiel("https://evil-cnil.fr/a", liste)).toBe(false);
    expect(domaineOfficiel("https://cnil.fr.evil.test/a", liste)).toBe(false);
    expect(domaineOfficiel("pas une url", liste)).toBe(false);
  });
});

describe("nombres libres (G4)", () => {
  it("ignore les ids et les numéros de ligne, lit le reste", () => {
    expect(nombresLibres("Voir INV-3 et Ligne 10 : il faut 9 clients, soit 12 %").map((n) => n.valeur)).toEqual([9, 12]);
  });
  it("nombresSansAppui : tolérance ±1 %", () => {
    expect(nombresSansAppui("environ 160 000 restaurants", [160_500])).toEqual([]);
    expect(nombresSansAppui("environ 10 minutes", [4, 120])).toEqual(["10"]);
  });
  it("un nombre venu d'une affirmation rejetée n'est plus autorisé", async () => {
    const d = fix("instruction/investisseur.json");
    d.replique = "Le marché compte 160 000 établissements.";
    expect(verifierNombresLibres(d, ["INV-1"])).toEqual([]);
    expect(verifierNombresLibres(d, [])).toEqual([{ id: "replique", raison: "nombre(s) sans appui : 160 000" }]);
  });
});

describe("lecture du Comptable", () => {
  const ledger = fix("ledger.json") as LedgerLine[];
  it("accepte les phrases de la fixture", () => {
    expect(verifierLecture(fix("instruction/comptable.json").lecture, ledger)).toEqual([]);
  });
  it("accepte un nombre arrondi tel qu'affiché (« 5,19 » pour 5,1923)", () => {
    expect(verifierLecture([{ ligne: "L7", phrase: "Ligne 7 : le ratio vaut 5,19." }], ledger)).toEqual([]);
    expect(verifierLecture([{ ligne: "L7", phrase: "Ligne 7 : le ratio vaut 5,3." }], ledger)).toHaveLength(1);
    expect(verifierLecture([{ ligne: "L7", phrase: "Ligne 7 : le ratio vaut 5,2." }], ledger)).toEqual([]);
  });
  it("refuse la mauvaise ligne citée et une ligne inconnue", () => {
    expect(verifierLecture([{ ligne: "L10", phrase: "Ligne 3 : il faut 9 clients." }], ledger)[0].raison).toContain("cite la ligne 3");
    expect(verifierLecture([{ ligne: "L15", phrase: "x" }], ledger)[0].raison).toBe("ligne inconnue");
  });
  it("une ligne non calculable se lit sans nombre", () => {
    const partiel = ledger.map((l) => (l.ligne === "L10" ? { ...l, valeur: null, statut: "non_calculable" as const } : l));
    expect(verifierLecture([{ ligne: "L10", phrase: "Ligne 10 : le point mort n'est pas calculable." }], partiel)).toEqual([]);
    expect(verifierLecture([{ ligne: "L10", phrase: "Ligne 10 : il faut 9 clients." }], partiel)).toHaveLength(1);
  });
});

describe("Ruling de Nadia", () => {
  const ruling = fix("ruling.json") as Ruling;
  const caseFile = fix("greffier-redaction.json").case_file as CaseFile;
  const connues = [
    ...AGENTS5.flatMap((a) => (fix(`instruction/${a}.json`).affirmations as Affirmation[]).map((x) => x.valeur).filter((v): v is number => v !== null)),
    ...(fix("ledger.json") as LedgerLine[]).map((l) => l.valeur).filter((v): v is number => v !== null),
  ];
  const propositions = new Set(["INV-P1", "CPT-P1", "JUR-P1", "CON-P1", "CLI-P1"]);

  it("le Ruling de référence passe : nombres connus, changements annoncés, sources connues", () => {
    expect(verifierNombresRuling(ruling, connues)).toEqual([]);
    expect(verifierChangementsRuling(ruling, caseFile, propositions)).toEqual([]);
  });

  it("un champ modifié sans être annoncé est rejeté", () => {
    const r = structuredClone(ruling);
    r.plan_corrige.case_file_v2.zone = "Paris (Île-de-France), FR";
    expect(verifierChangementsRuling(r, caseFile, propositions)[0]).toMatchObject({ id: "case_file_v2.zone" });
  });

  it("un changement annoncé mais absent du case_file_v2 est rejeté", () => {
    const r = structuredClone(ruling);
    r.plan_corrige.case_file_v2.prix = caseFile.prix;
    expect(verifierChangementsRuling(r, caseFile, propositions).some((x) => x.id === "changement:prix")).toBe(true);
  });

  it("une source qui n'est ni « juge » ni une proposition du tour 2 est rejetée", () => {
    expect(verifierChangementsRuling(ruling, caseFile, new Set(["INV-P1"])).map((x) => x.id)).toEqual(["changement:prix", "changement:offre"]);
  });
});

describe("propositions (G11)", () => {
  const acceptees = new Map<string, number | null>([["CLI-2", 120], ["CLI-4", 79]]);
  it("une proposition appuyée par des faits vérifiés passe", () => {
    expect(verifierProposition({ id: "CLI-P1", texte: "Un prix d'entrée sous mon budget logiciel actuel.", appuis: ["CLI-2", "CLI-4"] }, acceptees)).toEqual([]);
    expect(verifierProposition({ id: "CLI-P1", texte: "Passer à 79 € par mois.", appuis: ["CLI-4"] }, acceptees)).toEqual([]);
  });
  it("sans appui, appui inconnu ou nombre sans affirmation : rejet", () => {
    expect(verifierProposition({ id: "X-P1", texte: "t", appuis: [] }, acceptees)[0].raison).toBe("proposition sans appui");
    expect(verifierProposition({ id: "X-P1", texte: "t", appuis: ["CLI-99"] }, acceptees)[0].raison).toContain("CLI-99");
    expect(verifierProposition({ id: "X-P1", texte: "Passer à 45 € par mois.", appuis: ["CLI-4"] }, acceptees)[0].raison).toContain("45");
  });
});
