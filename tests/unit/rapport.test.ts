import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ecrirePdf, genererPdf, RapportInvalide } from "@/lib/pdf/Report";
import { AVERTISSEMENT, construireRapport, texteSur, verifierRapport, type ModeleRapport } from "@/lib/pdf/rapport";
import type { Etat } from "@/lib/trial/phases/contexte";
import { runTrial } from "@/lib/trial/run";
import { clientTest, SAISIE_REFERENCE, sourcesMock } from "../helpers";

let etat: Etat;
let modele: ModeleRapport;
const DATE = "2026-11-20";

beforeAll(async () => {
  const r = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), id: "rapport" });
  etat = r.etat!;
  modele = construireRapport(etat, { date: DATE });
});

const texteDe = (m: ModeleRapport) => m.pages.flatMap((p) => [p.titre, ...p.lignes.map((x) => x.texte), ...(p.tableau?.lignes.flatMap((r) => r.cellules) ?? [])]).join("\n");

describe("règle d'or : aucun nombre sans numéro de source ou ligne du Comptable", () => {
  it("le rapport du cas de référence n'a aucune violation", () => {
    expect(verifierRapport(modele)).toEqual([]);
  });

  it("un nombre sans référence est détecté", () => {
    const m: ModeleRapport = { sources: [], pages: [{ titre: "x", lignes: [{ texte: "Le marché compte 160 000 restaurants.", refs: [] }] }] };
    const v = verifierRapport(m);
    expect(v).toHaveLength(1);
    expect(v[0].raison).toContain("nombre(s) sans source : 160 000");
  });

  it("une référence à une source absente de l'annexe A, ou à une ligne inconnue, est détectée", () => {
    const m: ModeleRapport = { sources: [], pages: [{ titre: "x", lignes: [{ texte: "42 %", refs: ["S9"] }, { texte: "3", refs: ["L15"] }, { texte: "5", refs: ["inventé"] }] }] };
    expect(verifierRapport(m).map((x) => x.raison)).toEqual(["source S9 absente de l'annexe A", "ligne L15 inconnue", "référence invalide « inventé »"]);
  });

  it("les ids et « Ligne N » ne comptent pas comme des nombres", () => {
    const m: ModeleRapport = { sources: [], pages: [{ titre: "x", lignes: [{ texte: "INV-3 et la ligne 10 : L10", refs: [] }] }] };
    expect(verifierRapport(m)).toEqual([]);
  });

  it("chaque chiffre de la couverture vient du code (tally, usage) ; chaque fait cité a son numéro de source", () => {
    const couv = modele.pages[0].lignes;
    expect(couv.find((x) => x.texte.startsWith("Note finale"))!.refs).toEqual(["tally"]);
    expect(couv.find((x) => x.texte.startsWith("Coût"))!.refs).toEqual(["usage"]);
    const inv = modele.pages.find((p) => p.titre.startsWith("Victor"))!;
    const fait = inv.lignes.find((x) => x.texte.startsWith("INV-1 "))!;
    expect(fait.refs).toHaveLength(1);
    expect(fait.refs[0]).toMatch(/^S\d+$/);
    expect(fait.texte).toContain("fait sourcé");
  });

  it("une estimation est affichée comme telle, avec les sources de sa base", () => {
    const inv = modele.pages.find((p) => p.titre.startsWith("Victor"))!;
    const est = inv.lignes.find((x) => x.texte.startsWith("INV-2 "))!;
    expect(est.texte).toContain("ESTIMATION");
    expect(est.refs.length).toBeGreaterThanOrEqual(2);
  });
});

describe("structure du rapport (plan §8)", () => {
  it("a toutes les pages prévues, dans l'ordre", () => {
    expect(modele.pages.map((p) => p.titre)).toEqual([
      "Verdict",
      "En bref",
      "Le dossier",
      "Victor, l'investisseur",
      "Léa, le comptable",
      "Claire, le juriste",
      "Marco, le concurrent",
      `${etat.prenomCliente}, la cliente`,
      "Les comptes de Léa, ligne par ligne",
      "Claire : les risques signalés",
      "Le débat",
      "L'arbitrage de Nadia",
      "Méthode",
      "Annexe A : sources",
      "Annexe B : transparence",
      "Avertissement",
    ]);
  });

  it("la couverture : phrase finale, note avant et après, quorum, coût", () => {
    const t = modele.pages[0].lignes.map((x) => x.texte).join("\n");
    expect(t).toContain(etat.resultat!.phrase);
    expect(t).toMatch(/Note finale : 4,8 vers 5,7 \/ 10/);
    expect(t).toContain("Quorum : 5/5 votes valides.");
    expect(t).toMatch(/Coût du procès : [\d,]+ \$ \(estimation\)/);
    expect(t).not.toContain("Prix non communiqué");
  });

  it("le tableau du Comptable a les 14 lignes L1 à L14 avec leurs entrées", () => {
    const p = modele.pages.find((x) => x.titre.startsWith("Les comptes"))!;
    expect(p.tableau!.lignes.map((r) => r.cellules[0])).toEqual(Array.from({ length: 14 }, (_, i) => `L${i + 1}`));
    expect(p.tableau!.lignes[9].cellules[4]).toBe("9");
    expect(p.tableau!.lignes[9].refs).toEqual(["L10"]);
    expect(p.lignes[0].texte).toContain("saisie par l'utilisateur");
  });

  it("la page du Juriste est un signalement, pas un avis", () => {
    const p = modele.pages.find((x) => x.titre.startsWith("Claire : "))!;
    expect(p.lignes[0].texte).toContain("pas un avis juridique");
    expect(p.tableau!.lignes.length).toBeGreaterThan(0);
  });

  it("l'arbitrage montre le plan avant et après, avec la source de chaque changement", () => {
    const p = modele.pages.find((x) => x.titre.startsWith("L'arbitrage"))!;
    expect(p.tableau!.entetes).toEqual(["Champ", "Avant", "Après", "Source du changement"]);
    expect(p.tableau!.lignes.map((r) => r.cellules[3])).toEqual(["CLI-P1", "INV-P1", "JUR-P1"]);
    expect(p.lignes.some((x) => x.texte.startsWith("Par ces motifs"))).toBe(true);
  });

  it("l'annexe A liste chaque source, numérotée, avec URL, date de consultation et extrait", () => {
    const a = modele.pages.find((x) => x.titre.startsWith("Annexe A"))!;
    expect(a.lignes).toHaveLength(modele.sources.length);
    expect(a.lignes[0].texte).toMatch(/^S1 : .+, https?:\/\/.+, consulté le 2026-11-20\. « .+ »$/);
    expect(modele.sources.every((s) => s.consulteLe === DATE && s.extrait && s.url)).toBe(true);
  });

  it("la dernière page est l'avertissement fixe", () => {
    const p = modele.pages.at(-1)!;
    expect(p.lignes[0].texte).toBe(AVERTISSEMENT);
    expect(AVERTISSEMENT).toContain("ni un conseil financier, ni un conseil juridique");
  });

  it("aucun caractère que la police du PDF ne sait dessiner", () => {
    expect(texteDe(modele)).not.toMatch(/[^ -ÿ€…—«»\n]/);
    expect(texteSur("⌈F / m⌉ ≥ 3 → ok − 1 ≠ 2")).toBe("plafond(F / m) >= 3 vers ok - 1 different de 2");
  });

  it("jamais de clé API dans le rapport", () => {
    expect(texteDe(modele)).not.toMatch(/sk-ant|tvly-|api[_-]?key/i);
  });
});

describe("cas particuliers", () => {
  it("prix non communiqué : le bandeau « comptes partiels » est affiché, L1 est non calculable", async () => {
    const r = await runTrial("Brigade IA, agents IA, aux restaurants indépendants, Lyon", {
      client: clientTest({
        apres: (p, res) => {
          const s = res.sortie as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (p.phase === "IDENTIFICATION") s.saisie_confirmee.prix = null;
          if (p.phase === "MISE_EN_ETAT") s.case_file.prix = { montant: null, devise: "EUR", periode: "inconnue", ht_ou_ttc: "inconnu", origine: "non_communique" };
          return res;
        },
      }),
      sources: sourcesMock(),
      id: "sans-prix",
    });
    const m = construireRapport(r.etat!, { date: DATE });
    expect(verifierRapport(m)).toEqual([]);
    expect(m.pages[0].lignes.some((x) => x.texte === "Prix non communiqué : comptes partiels.")).toBe(true);
    expect(m.pages.find((p) => p.titre.startsWith("Les comptes"))!.tableau!.lignes[0].cellules[4]).toBe("non calculable");
  });

  it("procès ajourné : rapport partiel, phrase « Procès ajourné. », jurés absents signalés", async () => {
    const r = await runTrial(SAISIE_REFERENCE, {
      client: clientTest({
        avant: (p) => {
          if (p.phase === "INSTRUCTION" && ["juriste", "concurrent"].includes(p.agent)) throw new Error("panne");
        },
      }),
      sources: sourcesMock(),
      id: "ajourne",
    });
    expect(r.statut).toBe("ajourne");
    const m = construireRapport(r.etat!, { date: DATE });
    expect(verifierRapport(m)).toEqual([]);
    expect(m.pages[0].lignes.some((x) => x.texte === "Procès ajourné.")).toBe(true);
    expect(m.pages.filter((p) => p.lignes[0]?.texte.startsWith("Absent du procès"))).toHaveLength(2);
  });
});

describe("PDF", () => {
  it("produit un PDF valide (en-tête %PDF, plusieurs pages)", async () => {
    const buf = await genererPdf(etat, { date: DATE });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(10_000);
    expect(buf.subarray(-6).toString("latin1")).toContain("%%EOF");
    const pages = buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
    expect(pages).toBeGreaterThanOrEqual(modele.pages.length);
  });

  it("l'écrit dans un fichier", async () => {
    const f = join(mkdtempSync(join(tmpdir(), "rapport-")), "rapport.pdf");
    const taille = await ecrirePdf(etat, f, { date: DATE });
    expect(statSync(f).size).toBe(taille);
    expect(readFileSync(f).subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("REFUSE de produire un PDF dont un nombre n'a pas de source", async () => {
    const mauvais = structuredClone(etat);
    mauvais.miseEnEtat!.persona_cliente.journee_type = "Ouverture 9 h";
    mauvais.miseEnEtat!.case_file.cible = "Restaurants indépendants (160 000 en France) à Lyon";
    // la cible est citée avec la référence « dossier » : on retire cette référence en corrompant la ligne via un état sans cible neutre
    const m = construireRapport(mauvais, { date: DATE });
    m.pages[0].lignes[2].refs = [];
    expect(verifierRapport(m).length).toBeGreaterThan(0);
    // et genererPdf lève RapportInvalide dès qu'un modèle est invalide
    await expect(genererPdf({ ...mauvais, miseEnEtat: undefined, resultat: { ...mauvais.resultat!, phrase: "Note 7 sur 10." } as never }, { date: DATE })).rejects.toThrow(RapportInvalide);
  });
});
