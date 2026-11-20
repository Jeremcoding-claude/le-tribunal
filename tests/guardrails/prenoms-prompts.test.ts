import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_IDS, AGENTS, PRENOMS_AGENTS, SALLE } from "../../prompts/agents.config";
import { construireMission, promptMiseEnForme, promptSysteme } from "@/lib/prompts/loader";

// G12 — prénoms et accessoires (plan v3.0, §3.0 et §12.4).
// (a) injection des prénoms depuis agents.config.ts ; (b) aucun accessoire dans prompts/ ;
// (c) le prénom de la Cliente est dans la MISSION et absent du prompt système.

const RACINE = process.cwd();
const dossier = join(RACINE, "prompts");
const fichiers = readdirSync(dossier).filter((f) => /\.(md|ts)$/.test(f));
const brut = (f: string) => readFileSync(join(dossier, f), "utf8");

const PRENOMS = Object.values(PRENOMS_AGENTS);
const motPrenom = (p: string) => new RegExp(`(?<![\\p{L}])${p}(?![\\p{L}])`, "u");

// Accessoires, couleurs et décors de la salle : ils vivent dans src/components/salle/personnages.ts.
const ACCESSOIRES = [
  "perruque",
  "haut-de-forme",
  "chapeau",
  "robot",
  "écran-visage",
  "table ronde",
  "pile de pièces",
  "enveloppe",
  "estrade",
  "yeux orange",
  "lumière chaude",
];
const motAccessoire = (a: string) => new RegExp(`(?<![\\p{L}])${a}(?![\\p{L}])`, "iu");

describe("(a) injection des prénoms depuis agents.config.ts", () => {
  it("agents.config.ts porte les 5 prénoms fixes (source unique) ; la Cliente n'a pas de prénom fixe", () => {
    expect(PRENOMS).toEqual(["Nadia", "Victor", "Léa", "Claire", "Marco"]);
    expect(AGENTS.juge.prenom).toBe(SALLE.JUG.prenom);
    expect(AGENTS.investisseur.prenom).toBe(SALLE.INV.prenom);
    expect(AGENTS.comptable.prenom).toBe(SALLE.CPT.prenom);
    expect(AGENTS.juriste.prenom).toBe(SALLE.JUR.prenom);
    expect(AGENTS.concurrent.prenom).toBe(SALLE.CON.prenom);
    expect(AGENTS.cliente.prenom).toBeNull();
  });

  it("aucun prénom n'est écrit en dur dans prompts/*.md", () => {
    for (const f of fichiers.filter((x) => x.endsWith(".md"))) {
      for (const p of PRENOMS) expect(brut(f), `${f} contient « ${p} »`).not.toMatch(motPrenom(p));
    }
  });

  it("le marqueur <!-- PRENOMS --> est dans les règles communes, le rédacteur et le Juge", () => {
    for (const f of ["_commun.md", "greffier-redaction.md", "juge.md"]) expect(brut(f)).toContain("<!-- PRENOMS -->");
  });

  for (const mode of ["api", "plugin"] as const) {
    it(`les prompts assemblés (${mode}) contiennent les 5 prénoms, injectés à la place du marqueur`, () => {
      for (const agent of AGENT_IDS) {
        const p = promptSysteme(agent, mode);
        expect(p).not.toContain("<!-- PRENOMS -->");
        const attendu = AGENTS[agent].commun || ["greffier-redaction", "juge"].includes(agent);
        for (const prenom of PRENOMS) {
          if (attendu) expect(p, `${agent} (${mode}) sans « ${prenom} »`).toMatch(motPrenom(prenom));
          else expect(p, `${agent} (${mode}) contient « ${prenom} »`).not.toMatch(motPrenom(prenom));
        }
      }
    });
  }

  it("la règle d'initiale est donnée au rédacteur qui crée la Cliente", () => {
    const m = promptSysteme("greffier-redaction", "api").match(/une initiale ([A-Z](?:, [A-Z])+)\)/);
    expect(m, "règle d'initiale absente").not.toBeNull();
    expect(m![1].split(", ").sort()).toEqual(["C", "L", "M", "N", "V"]);
  });

  it("la salle injectée dit qu'un prénom n'est jamais une preuve", () => {
    expect(promptSysteme("investisseur", "api")).toContain("un prénom n'est jamais une preuve");
  });
});

describe("(b) aucun accessoire dans prompts/", () => {
  for (const f of fichiers) {
    it(`${f} ne mentionne aucun accessoire, couleur ou décor de la salle`, () => {
      for (const a of ACCESSOIRES) expect(brut(f), `${f} contient « ${a} »`).not.toMatch(motAccessoire(a));
    });
  }

  it("les prompts assemblés non plus (jurés, greffiers, Juge, mise en forme)", () => {
    const textes = [
      promptMiseEnForme(),
      ...AGENT_IDS.flatMap((a) => [promptSysteme(a, "api"), promptSysteme(a, "plugin")]),
    ];
    for (const t of textes) for (const a of ACCESSOIRES) expect(t).not.toMatch(motAccessoire(a));
  });

  it("le test sait détecter un accessoire (test du test)", () => {
    expect("Nadia porte une perruque blanche").toMatch(motAccessoire("perruque"));
    expect("L'expert-comptable est méticuleux").not.toMatch(motAccessoire("table ronde"));
  });
});

describe("(c) le prénom de la Cliente est dans la MISSION, jamais dans le prompt système", () => {
  const prenoms = ["Sandrine", "Béatrice", "Aurélie"];

  it("le prénom est dans le message MISSION de chaque phase où la persona existe", () => {
    for (const prenom of prenoms) {
      const m = construireMission({ agent: "cliente", phase: "INSTRUCTION", mode: "api", donnees: { x: 1 }, prenomCliente: prenom });
      expect(m).toContain(`prenom_cliente: ${prenom}`);
      const d = construireMission({ agent: "investisseur", phase: "DEBAT", tour: 1, mode: "api", donnees: { x: 1 }, prenomCliente: prenom });
      expect(d).toContain(`prenom_cliente: ${prenom}`);
    }
  });

  it("aucun prompt système (8 agents, 2 modes) ni la mise en forme ne contient un prénom de Cliente", () => {
    const textes = [promptMiseEnForme(), ...AGENT_IDS.flatMap((a) => [promptSysteme(a, "api"), promptSysteme(a, "plugin")])];
    for (const t of textes) for (const prenom of prenoms) expect(t).not.toMatch(motPrenom(prenom));
  });

  it("le prompt système ne change pas d'un procès à l'autre : seul le message MISSION porte le prénom", () => {
    const avant = promptSysteme("cliente", "api");
    construireMission({ agent: "cliente", phase: "INSTRUCTION", mode: "api", donnees: {}, prenomCliente: "Sandrine" });
    expect(promptSysteme("cliente", "api")).toBe(avant);
  });
});
