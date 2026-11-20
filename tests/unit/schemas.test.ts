import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import * as S from "@/lib/schemas";

const FIX = join(process.cwd(), "fixtures");
const lire = (chemin: string): unknown => JSON.parse(readFileSync(join(FIX, chemin), "utf8"));
const liste = (dossier: string) => readdirSync(join(FIX, dossier)).filter((f) => f.endsWith(".json"));

const SCHEMAS: Record<string, ZodType> = {
  BriefInvestisseur: S.BriefInvestisseur,
  BriefComptable: S.BriefComptable,
  BriefJuriste: S.BriefJuriste,
  BriefConcurrent: S.BriefConcurrent,
  BriefCliente: S.BriefCliente,
  DebateTurn: S.DebateTurn,
  Revote: S.Revote,
  MiseEnEtat: S.MiseEnEtat,
  CaseFile: S.CaseFile,
  Ruling: S.Ruling,
  TrialEvent: S.TrialEvent,
};

function problemes(schema: ZodType, donnee: unknown) {
  const r = schema.safeParse(donnee);
  if (r.success) return null;
  return r.error.issues.map((i) => ({ chemin: i.path.join("."), message: i.message }));
}

describe("fixtures valides du cas de référence (restaurants)", () => {
  const cas: [string, ZodType][] = [
    ["restaurants/saisie.json", S.Saisie],
    ["restaurants/pieces.json", S.PiecesDuGreffe],
    ["restaurants/greffier-enquete.json", S.EnqueteGreffier],
    ["restaurants/greffier-redaction.json", S.MiseEnEtat],
    ["restaurants/instruction/investisseur.json", S.BriefInvestisseur],
    ["restaurants/instruction/comptable.json", S.BriefComptable],
    ["restaurants/instruction/juriste.json", S.BriefJuriste],
    ["restaurants/instruction/concurrent.json", S.BriefConcurrent],
    ["restaurants/instruction/cliente.json", S.BriefCliente],
    ["restaurants/instruction-api/investisseur.json", S.BriefInvestisseurApi],
    ["restaurants/instruction-api/comptable-hypotheses.json", S.ComptableHypotheses],
    ["restaurants/instruction-api/comptable-lecture.json", S.ComptableLecture],
    ["restaurants/instruction-api/juriste.json", S.BriefJuristeApi],
    ["restaurants/instruction-api/concurrent.json", S.BriefConcurrentApi],
    ["restaurants/instruction-api/cliente.json", S.BriefClienteApi],
    ["restaurants/ledger.json", S.Ledger],
    ["restaurants/ruling.json", S.Ruling],
  ];
  for (const [chemin, schema] of cas) {
    it(`${chemin} est valide`, () => {
      expect(problemes(schema, lire(chemin))).toBeNull();
    });
  }

  for (const tour of ["tour-1", "tour-2"]) {
    for (const f of liste(`restaurants/debat/${tour}`)) {
      it(`debat/${tour}/${f} est valide`, () => {
        expect(problemes(S.DebateTurn, lire(`restaurants/debat/${tour}/${f}`))).toBeNull();
      });
    }
  }
  for (const f of liste("restaurants/revote")) {
    it(`revote/${f} est valide`, () => {
      expect(problemes(S.Revote, lire(`restaurants/revote/${f}`))).toBeNull();
    });
  }

  it("il y a un dossier, deux tours de débat et un revote par juré", () => {
    expect(liste("restaurants/instruction")).toHaveLength(5);
    expect(liste("restaurants/debat/tour-1")).toHaveLength(5);
    expect(liste("restaurants/debat/tour-2")).toHaveLength(5);
    expect(liste("restaurants/revote")).toHaveLength(5);
  });

  it("le JurorBrief discriminé accepte chacun des 5 dossiers", () => {
    for (const f of liste("restaurants/instruction")) {
      expect(problemes(S.JurorBrief, lire(`restaurants/instruction/${f}`))).toBeNull();
    }
  });

  it("chaque juré fait une proposition au tour 2 et aucune au tour 1", () => {
    for (const f of liste("restaurants/debat/tour-1")) {
      expect((lire(`restaurants/debat/tour-1/${f}`) as { proposition: unknown }).proposition).toBeNull();
    }
    for (const f of liste("restaurants/debat/tour-2")) {
      expect((lire(`restaurants/debat/tour-2/${f}`) as { proposition: unknown }).proposition).not.toBeNull();
    }
  });
});

describe("fixtures piégées (rejet pour la bonne raison)", () => {
  interface Piege {
    piege: string;
    schema: string;
    donnee: unknown;
    attendu_message?: string;
    attendu_chemin?: string;
    rejet_a_l_etape?: number;
    rejet_par?: string;
  }
  const fichiers = liste("pieges").filter((f) => f !== "INDEX.json");

  it("il existe des fixtures piégées", () => {
    expect(fichiers.length).toBeGreaterThanOrEqual(25);
  });

  for (const f of fichiers) {
    const p = lire(`pieges/${f}`) as Piege;
    const schema = SCHEMAS[p.schema];

    if (p.rejet_a_l_etape !== undefined) {
      it(`${p.piege} : valide pour le schéma, rejet à l'étape ${p.rejet_a_l_etape} (${p.rejet_par})`, () => {
        expect(schema, `schéma inconnu ${p.schema}`).toBeDefined();
        expect(problemes(schema, p.donnee)).toBeNull();
        expect(p.rejet_par).toBeTruthy();
      });
    } else {
      it(`${p.piege} est rejeté par ${p.schema}`, () => {
        expect(schema, `schéma inconnu ${p.schema}`).toBeDefined();
        const pb = problemes(schema, p.donnee);
        expect(pb, "la donnée piégée aurait dû être rejetée").not.toBeNull();
        if (p.attendu_message) {
          expect(pb!.some((i) => i.message.includes(p.attendu_message!)), `message attendu « ${p.attendu_message} », reçu ${JSON.stringify(pb)}`).toBe(true);
        }
        if (p.attendu_chemin) {
          expect(pb!.some((i) => i.chemin.startsWith(p.attendu_chemin!)), `chemin attendu ${p.attendu_chemin}, reçu ${JSON.stringify(pb)}`).toBe(true);
        }
      });
    }
  }

  it("un GO noté 3/10 est rejeté avec un message clair", () => {
    const p = lire("pieges/go-note-3.json") as Piege;
    const pb = problemes(S.BriefInvestisseur, p.donnee)!;
    expect(pb.map((i) => i.message)).toContain("Verdict GO incompatible avec la note 3 : GO exige une note de 6 à 10.");
  });

  it("l'index des tests piégés ne renvoie qu'à des fixtures qui existent", () => {
    const index = lire("pieges/INDEX.json") as { test: string; fixture: string | null }[];
    const presents = new Set(liste("pieges").map((f) => f.replace(/\.json$/, "")));
    for (const e of index) {
      if (e.fixture === null) continue;
      const nom = e.fixture.replace(/\.(json|txt)$/, "").replace(/^\.\.\/restaurants\//, "");
      const existe = presents.has(nom) || ["registre", "saisie"].includes(nom);
      expect(existe, `${e.test} → ${e.fixture}`).toBe(true);
    }
  });
});

describe("règles de forme (plan §3.2, §4.1)", () => {
  const investisseur = () => lire("restaurants/instruction/investisseur.json") as Record<string, unknown>;

  it("refuse une note qui n'est pas un multiple de 0,5", () => {
    const b = investisseur() as { vote: { note: number } };
    b.vote.note = 6.3;
    expect(problemes(S.BriefInvestisseur, b)).not.toBeNull();
  });

  it("refuse moins de 3 affirmations", () => {
    const b = investisseur() as { affirmations: unknown[] };
    b.affirmations = b.affirmations.slice(0, 2);
    expect(problemes(S.BriefInvestisseur, b)).not.toBeNull();
  });

  it("accepte GO à 6, NO-GO à 4,5 et PIVOT de 3 à 7,5 aux bornes", () => {
    const vote = (note: number, verdict: string) => ({ note, verdict, raison_principale: "x", appuis: ["INV-1", "INV-2"] });
    expect(problemes(S.Vote, vote(6, "GO"))).toBeNull();
    expect(problemes(S.Vote, vote(5.5, "GO"))).not.toBeNull();
    expect(problemes(S.Vote, vote(4.5, "NO-GO"))).toBeNull();
    expect(problemes(S.Vote, vote(5, "NO-GO"))).not.toBeNull();
    expect(problemes(S.Vote, vote(3, "PIVOT"))).toBeNull();
    expect(problemes(S.Vote, vote(7.5, "PIVOT"))).toBeNull();
    expect(problemes(S.Vote, vote(8, "PIVOT"))).not.toBeNull();
  });

  it("accepte une phrase du Comptable seulement sur une ligne L1 à L14", () => {
    expect(problemes(S.LectureLigne, { ligne: "L10", phrase: "Ligne 10 : ..." })).toBeNull();
    expect(problemes(S.LectureLigne, { ligne: "L15", phrase: "Ligne 15 : ..." })).not.toBeNull();
  });

  it("le tableau du Comptable a 14 lignes et « non calculable » ⇔ valeur null", () => {
    const ledger = lire("restaurants/ledger.json") as { statut: string; valeur: number | null }[];
    expect(ledger).toHaveLength(14);
    const l = { ...ledger[0], statut: "non_calculable" };
    expect(problemes(S.LedgerLine, l)).not.toBeNull();
    expect(problemes(S.LedgerLine, { ...l, valeur: null })).toBeNull();
  });

  it("le tableau de référence est cohérent avec les hypothèses du Comptable (calcul à la main)", () => {
    const l = Object.fromEntries((lire("restaurants/ledger.json") as { ligne: string; valeur: number }[]).map((x) => [x.ligne, x.valeur]));
    expect(l.L3).toBe(108); // 149 − 41
    expect(l.L10).toBe(9); // ⌈900 / 108⌉
    expect(l.L11).toBe(32); // ⌈(900 + 2500) / 108⌉
    expect(l.L12).toBe(9 * 520);
    expect(l.L14).toBe(48000 * 149 * 12);
    const lecture = (lire("restaurants/instruction/comptable.json") as { lecture: { ligne: string; phrase: string }[] }).lecture;
    for (const { ligne, phrase } of lecture) expect(phrase).toContain(String(l[ligne]));
  });

  it("les événements « scellés » n'ont jamais de note (G14)", () => {
    const base = { trial_id: "t1", seq: 1, ts: "2026-11-20T10:00:00.000Z" };
    expect(problemes(S.TrialEvent, { ...base, type: "vote_sealed", agent: "cliente" })).toBeNull();
    expect(problemes(S.TrialEvent, { ...base, type: "revote", agent: "cliente" })).toBeNull();
    expect(problemes(S.TrialEvent, { ...base, type: "revote", agent: "cliente", note: 5 })).not.toBeNull();
    expect(
      problemes(S.TrialEvent, { ...base, type: "vote1_ouvert", notes: [{ agent: "cliente", note: 3.5, verdict: "PIVOT" }], moyenne: 3.5, ecart_type: 0 }),
    ).toBeNull();
  });
});

describe("pages web MOCK du cas de référence", () => {
  const pages = lire("restaurants/pages/index.json") as Record<string, string>;
  const briefs = liste("restaurants/instruction").map((f) => lire(`restaurants/instruction/${f}`) as { affirmations: { id: string; type: string; source_url: string | null; extrait: string | null }[] });

  it("chaque fait cité a sa page, et la page contient l'extrait et la mention fictive", () => {
    for (const b of briefs) {
      for (const a of b.affirmations.filter((x) => x.type === "fait")) {
        const fichier = pages[a.source_url!];
        expect(fichier, `${a.id} : page manquante pour ${a.source_url}`).toBeDefined();
        const texte = readFileSync(join(FIX, "restaurants/pages", fichier), "utf8");
        expect(texte).toContain("DONNÉE FICTIVE DE TEST");
        expect(texte).toContain(a.extrait!);
      }
    }
  });

  it("toutes les URL sont fictives (exemple.test) ; seul le Juriste emploie un domaine officiel, avec un chemin « mock »", () => {
    for (const b of briefs) {
      for (const a of b.affirmations.filter((x) => x.type === "fait")) {
        const u = new URL(a.source_url!);
        const fictive = u.hostname === "exemple.test";
        const officielMock = u.hostname === "www.legifrance.gouv.fr" && u.pathname.startsWith("/mock/");
        expect(fictive || officielMock, `${a.id} : ${a.source_url}`).toBe(true);
      }
    }
  });
});
