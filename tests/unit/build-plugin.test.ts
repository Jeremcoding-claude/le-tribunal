import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_IDS, AGENTS } from "../../prompts/agents.config";
import { genererPlugin } from "../../scripts/build-plugin";

const RACINE = process.cwd();
const lireFichier = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8").replace(/\r\n/g, "\n");

describe("plugin généré depuis prompts/", () => {
  const generes = genererPlugin(RACINE);

  it("est à jour : régénérer ne produit aucune différence avec les fichiers commités", () => {
    for (const [chemin, contenu] of Object.entries(generes)) {
      expect(existsSync(join(RACINE, chemin)), `${chemin} manquant : lance « npm run build:plugin »`).toBe(true);
      expect(lireFichier(chemin), `${chemin} pas à jour : lance « npm run build:plugin »`).toBe(contenu);
    }
  });

  it("ne contient que les 8 agents du plan, et pas mise-en-forme (mode API seulement)", () => {
    expect(Object.keys(generes).sort()).toEqual(AGENT_IDS.map((a) => `plugin/agents/${a}.md`).sort());
    expect(readdirSync(join(RACINE, "plugin/agents")).filter((f) => f.endsWith(".md")).sort()).toEqual(AGENT_IDS.map((a) => `${a}.md`).sort());
    expect(generes).not.toHaveProperty("plugin/agents/mise-en-forme.md");
  });

  for (const agent of AGENT_IDS) {
    it(`${agent} : en-tête YAML conforme (name sans préfixe, outils, modèle, maxTurns)`, () => {
      const t = generes[`plugin/agents/${agent}.md`];
      const m = t.match(/^---\n([\s\S]*?)\n---\n/);
      expect(m, "en-tête YAML").not.toBeNull();
      const champs = Object.fromEntries(m![1].split("\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
      expect(Object.keys(champs).sort()).toEqual(["description", "maxTurns", "model", "name", "tools"]);
      expect(champs.name).toBe(agent);
      expect(champs.name).not.toContain(":");
      expect(champs.tools).toBe(AGENTS[agent].outilsCc.join(", "));
      expect(champs.model).toBe(AGENTS[agent].cc);
      expect(champs.maxTurns).toBe(String(AGENTS[agent].maxTurns));
      expect(champs.description).toContain("/tribunal:juger");
    });

    it(`${agent} : corps sans variable, sans marqueur de mode, avec la consigne Claude Code`, () => {
      const t = generes[`plugin/agents/${agent}.md`];
      expect(t).toContain("<!-- GÉNÉRÉ par scripts/build-plugin.ts depuis prompts/ — ne pas modifier -->");
      expect(t).not.toMatch(/<!-- (MODE|FORMAT|PRENOMS)/);
      expect(t).not.toMatch(/\{\{|\$\{/);
      expect(t).toContain("## Mode Claude Code");
      expect(t).toContain("```json");
    });
  }

  it("les outils : le web pour les jurés et le greffier-enquêteur, rien d'autre pour le rédacteur et le Juge ; Opus pour le Juge", () => {
    expect(generes["plugin/agents/investisseur.md"]).toContain("tools: WebSearch, WebFetch, Read, Write");
    expect(generes["plugin/agents/greffier-enquete.md"]).toContain("tools: WebSearch, WebFetch, Read, Write");
    expect(generes["plugin/agents/greffier-redaction.md"]).toContain("tools: Read, Write");
    expect(generes["plugin/agents/juge.md"]).toContain("tools: Read, Write");
    expect(generes["plugin/agents/juge.md"]).toContain("model: opus");
    expect(generes["plugin/agents/investisseur.md"]).toContain("model: sonnet");
  });

  it("le manifeste du plugin s'appelle tribunal", () => {
    const m = JSON.parse(lireFichier("plugin/.claude-plugin/plugin.json"));
    expect(m.name).toBe("tribunal");
  });
});
