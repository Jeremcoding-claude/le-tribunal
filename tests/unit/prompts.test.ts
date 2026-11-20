import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_IDS,
  AGENTS,
  BUDGET_PAR_PHASE,
  PHASES_PAR_AGENT,
  schemaSortie,
  type AgentId,
  type Mode,
  type Phase,
} from "../../prompts/agents.config";
import { formatPourPrompt, formatsPourAgent } from "@/lib/prompts/format";
import { construireMission, promptMiseEnForme, promptSysteme, PromptError, traiterMarqueurs } from "@/lib/prompts/loader";
import * as S from "@/lib/schemas";
import { GUARDRAILS } from "@/lib/guardrails/config";

const FIX = join(process.cwd(), "fixtures/restaurants");
const lire = (f: string): unknown => JSON.parse(readFileSync(join(FIX, f), "utf8"));

describe("traiterMarqueurs", () => {
  const source = "avant\n<!-- MODE:API -->\nbloc api\n<!-- /MODE -->\n<!-- MODE:PLUGIN -->\nbloc plugin\n<!-- FORMAT -->\n<!-- /MODE -->\naprès\n";

  it("garde le bloc API et retire le bloc plugin en mode API", () => {
    const t = traiterMarqueurs("avant\n<!-- MODE:API -->\nbloc api\n<!-- /MODE -->\n<!-- MODE:PLUGIN -->\nbloc plugin\n<!-- /MODE -->\naprès\n", { mode: "api" });
    expect(t).toContain("bloc api");
    expect(t).not.toContain("bloc plugin");
  });

  it("garde le bloc plugin et remplace <!-- FORMAT --> en mode plugin", () => {
    const t = traiterMarqueurs(source, { mode: "plugin", format: "FORMAT-GÉNÉRÉ" });
    expect(t).toContain("bloc plugin");
    expect(t).toContain("FORMAT-GÉNÉRÉ");
    expect(t).not.toContain("bloc api");
    expect(t).not.toContain("<!--");
  });

  it("refuse un <!-- FORMAT --> sans format, et hors d'un bloc plugin en mode API", () => {
    expect(() => traiterMarqueurs(source, { mode: "plugin" })).toThrow(PromptError);
    expect(() => traiterMarqueurs("<!-- FORMAT -->\n", { mode: "api" })).toThrow(PromptError);
  });

  it("refuse un marqueur inconnu", () => {
    expect(() => traiterMarqueurs("texte <!-- VARIABLE --> texte", { mode: "api" })).toThrow(/Marqueur non traité/);
  });
});

describe("promptSysteme", () => {
  const modes: Mode[] = ["api", "plugin"];

  for (const agent of AGENT_IDS) {
    for (const mode of modes) {
      it(`${agent} (${mode}) : aucun marqueur ne survit`, () => {
        const p = promptSysteme(agent, mode);
        expect(p).not.toMatch(/<!--/);
        expect(p.length).toBeGreaterThan(200);
      });
    }
  }

  it("est identique d'un appel à l'autre : le prompt système ne contient aucune donnée de procès", () => {
    for (const agent of AGENT_IDS) {
      expect(promptSysteme(agent, "api")).toBe(promptSysteme(agent, "api"));
      expect(promptSysteme(agent, "api")).not.toContain("Brigade IA");
    }
  });

  it("les jurés reçoivent les règles communes, pas les greffiers ni le Juge", () => {
    for (const agent of AGENT_IDS) {
      const aCommun = promptSysteme(agent, "api").includes("Règles communes du Tribunal");
      expect(aCommun, agent).toBe(AGENTS[agent].commun);
    }
  });

  it("le texte des preuves dépend du mode (le greffe recopie le passage en mode API)", () => {
    expect(promptSysteme("investisseur", "api")).toContain("Le greffe garde");
    expect(promptSysteme("investisseur", "api")).not.toContain("copié\n   mot pour mot");
    expect(promptSysteme("investisseur", "plugin")).toContain("`source_url` + `extrait`");
    expect(promptSysteme("investisseur", "plugin")).not.toContain("Le greffe garde");
  });

  it("le mode plugin porte un format par phase ; le mode API n'en porte aucun", () => {
    const plugin = promptSysteme("investisseur", "plugin");
    expect(plugin).toContain("### Format de la phase INSTRUCTION");
    expect(plugin).toContain("### Format de la phase DEBAT");
    expect(plugin).toContain("### Format de la phase REVOTE");
    expect(plugin).toContain('"marche"');
    expect(promptSysteme("investisseur", "api")).not.toContain("```json");
    expect(promptSysteme("comptable", "plugin")).toContain("### Format de la phase LECTURE");
  });

  it("les règles v3.0 sont dans les prompts (propositions au tour 2, source des changements du Juge)", () => {
    expect(promptSysteme("cliente", "api")).toContain("proposition d'amélioration");
    const juge = promptSysteme("juge", "api");
    expect(juge).toContain("`source` = son id");
    expect(juge).toContain("zone, modele");
    expect(juge).toContain("Tu n'annonces ni note ni verdict");
  });

  it("la mise en forme du mode API est un prompt sans outil ni marqueur", () => {
    const p = promptMiseEnForme();
    expect(p).toContain("citation: \"C3\"");
    expect(p).not.toMatch(/<!--/);
  });
});

describe("construireMission", () => {
  const donnees = { case_file: { nom: "Brigade IA" } };
  const base = { agent: "investisseur", phase: "INSTRUCTION", mode: "api", donnees, prenomCliente: "Sandrine" } as const;

  it("assemble phase, budget, prénom de la Cliente, données et RAPPEL", () => {
    const m = construireMission(base);
    expect(m).toMatch(/^MISSION\nphase: INSTRUCTION\nagent: investisseur\n/);
    expect(m).toContain(`budget: recherches=${GUARDRAILS.search.instruction.maxSearches} lectures=${GUARDRAILS.search.instruction.maxFetches}`);
    expect(m).toContain("pays: FR · langue: fr");
    expect(m).toContain("prenom_cliente: Sandrine");
    expect(m).toContain("DONNÉES\n");
    expect(m).toContain('"nom": "Brigade IA"');
    expect(m).toContain("RAPPEL — ce qui fait rejeter ta réponse\n1. Un chiffre sans source vérifiable.");
    expect(m.trimEnd().split("\n").slice(-3)).toHaveLength(3);
  });

  it("le débat exige un tour ; le tour n'existe qu'au débat", () => {
    expect(() => construireMission({ ...base, phase: "DEBAT" })).toThrow(/tour/);
    expect(construireMission({ ...base, phase: "DEBAT", tour: 2 })).toContain("tour: 2");
    expect(() => construireMission({ ...base, tour: 1 })).toThrow(/Le tour n'existe qu'en phase DEBAT/);
  });

  it("refuse une donnée manquante", () => {
    expect(() => construireMission({ ...base, donnees: undefined })).toThrow(/Donnée manquante : donnees/);
    expect(() => construireMission({ ...base, donnees: null })).toThrow(/Donnée manquante : donnees/);
    expect(() => construireMission({ ...base, prenomCliente: undefined })).toThrow(/Donnée manquante : prenomCliente/);
  });

  it("mode plugin : les fichiers d'entrée et de sortie remplacent les données", () => {
    const m = construireMission({ agent: "juriste", phase: "INSTRUCTION", mode: "plugin", prenomCliente: "Sandrine", fichierEntree: ".tribunal/t1/p2/juriste.input.json", fichierSortie: ".tribunal/t1/p2/juriste.output.json" });
    expect(m).toContain("fichier_entree: .tribunal/t1/p2/juriste.input.json");
    expect(m).toContain("fichier_sortie: .tribunal/t1/p2/juriste.output.json");
    expect(() => construireMission({ agent: "juriste", phase: "INSTRUCTION", mode: "plugin", prenomCliente: "Sandrine", fichierEntree: "x" })).toThrow(/fichierSortie/);
  });

  it("refuse un prénom de Cliente invalide, ou donné avant que la persona existe", () => {
    expect(() => construireMission({ ...base, prenomCliente: "Nadine" })).toThrow(/initiale N/);
    expect(() => construireMission({ ...base, prenomCliente: "Victor" })).toThrow(/prénom d'un agent/);
    expect(() => construireMission({ agent: "greffier-redaction", phase: "MISE_EN_ETAT", mode: "api", donnees, prenomCliente: "Sandrine" })).toThrow(/n'existe pas encore/);
  });

  it("refuse une phase que l'agent ne joue pas", () => {
    expect(() => construireMission({ ...base, agent: "juge", phase: "DEBAT", tour: 1 })).toThrow(/ne joue pas la phase/);
  });

  it("le budget de recherche vient de GUARDRAILS : le Juge n'a aucune recherche", () => {
    expect(BUDGET_PAR_PHASE.CORRECTION).toEqual({ maxSearches: 0, maxFetches: 0 });
    expect(construireMission({ agent: "juge", phase: "CORRECTION", mode: "api", donnees, prenomCliente: "Sandrine" })).toContain("budget: recherches=0 lectures=0");
  });
});

describe("formats générés depuis Zod", () => {
  it("formatPourPrompt rend un bloc JSON valide, avec les .describe() des champs", () => {
    const f = formatPourPrompt(S.Revote);
    const json = JSON.parse(f.replace(/^```json\n/, "").replace(/\n```$/, ""));
    expect(json.properties).toHaveProperty("a_change_d_avis");
    expect(f).toContain("Changement ou id qui motive le nouvel avis");
    expect(f).not.toContain("additionalProperties");
  });

  it("chaque agent a un format par phase distincte", () => {
    for (const agent of AGENT_IDS) {
      const f = formatsPourAgent(agent);
      expect(f).toContain("```json");
    }
  });
});

describe("schémas de sortie par agent et par phase", () => {
  const modes: Mode[] = ["api", "plugin"];
  it("existent pour chaque combinaison jouée, dans les deux modes ; refusés sinon", () => {
    for (const agent of AGENT_IDS) {
      for (const phase of PHASES_PAR_AGENT[agent]) {
        for (const mode of modes) expect(() => schemaSortie(agent, phase, mode), `${agent}/${phase}/${mode}`).not.toThrow();
      }
    }
    expect(() => schemaSortie("juge", "DEBAT", "plugin")).toThrow();
    expect(() => schemaSortie("investisseur", "LECTURE", "api")).toThrow();
  });

  const ok = (agent: AgentId, phase: Phase, mode: Mode, donnee: unknown) => {
    const r = schemaSortie(agent, phase, mode).safeParse(donnee);
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues.slice(0, 2))).toBe(true);
  };

  it("acceptent les fixtures du cas de référence (mode plugin)", () => {
    ok("greffier-enquete", "IDENTIFICATION", "plugin", lire("greffier-enquete.json"));
    ok("greffier-redaction", "MISE_EN_ETAT", "plugin", lire("greffier-redaction.json"));
    for (const a of ["investisseur", "juriste", "concurrent", "cliente"] as const) ok(a, "INSTRUCTION", "plugin", lire(`instruction/${a}.json`));
    const c = lire("instruction/comptable.json") as Record<string, unknown>;
    ok("comptable", "INSTRUCTION", "plugin", { agent: "comptable", affirmations: c.affirmations, hypotheses: c.hypotheses, lacunes: c.lacunes, alertes: c.alertes });
    ok("comptable", "LECTURE", "plugin", lire("instruction-api/comptable-lecture.json"));
    for (const a of ["investisseur", "comptable", "juriste", "concurrent", "cliente"] as const) {
      ok(a, "DEBAT", "plugin", lire(`debat/tour-1/${a}.json`));
      ok(a, "DEBAT", "plugin", lire(`debat/tour-2/${a}.json`));
      ok(a, "REVOTE", "plugin", lire(`revote/${a}.json`));
    }
    ok("juge", "CORRECTION", "plugin", lire("ruling.json"));
  });

  it("acceptent les fixtures « mise en forme » du cas de référence (mode API)", () => {
    for (const a of ["investisseur", "juriste", "concurrent", "cliente"] as const) ok(a, "INSTRUCTION", "api", lire(`instruction-api/${a}.json`));
    ok("comptable", "INSTRUCTION", "api", lire("instruction-api/comptable-hypotheses.json"));
  });
});
