import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Le CLI EMPAQUETÉ (plugin/bin/tribunal.mjs, un seul fichier, dépendances incluses) tourne dans un dossier qui n'est pas le dépôt.
const bin = join(process.cwd(), "plugin/bin/tribunal.mjs");

describe.skipIf(!existsSync(bin))("plugin/bin/tribunal.mjs", () => {
  const dossier = () => {
    const d = mkdtempSync(join(tmpdir(), "tribunal-bin-"));
    cpSync(join(process.cwd(), "fixtures"), join(d, "fixtures"), { recursive: true });
    return d;
  };
  const lancer = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8", timeout: 60_000 });

  it("run --mock produit le PDF sans dépôt ni node_modules, avec les prompts embarqués", () => {
    const cwd = dossier();
    const r = lancer(cwd, "run", "--mock", "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon");
    expect(r.status, r.stderr).toBe(0);
    const sortie = JSON.parse(r.stdout);
    expect(sortie.status).toBe("done");
    expect(sortie.phrase).toBe("Modifie ton plan.");
    expect(readFileSync(sortie.pdf).subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(statSync(sortie.pdf).size).toBeGreaterThan(10_000);
  });

  it("start refuse une saisie à 3 éléments avec le format", () => {
    const r = lancer(dossier(), "start", "Brigade IA, agents IA, Lyon");
    expect(JSON.parse(r.stdout)).toMatchObject({ status: "saisie_incomplete", manque: ["cible"] });
  });

  it("une erreur sort en JSON, sans clé", () => {
    const r = lancer(dossier(), "run", "Brigade IA, agents IA, aux restaurants, Lyon");
    expect(JSON.parse(r.stdout).status).toBe("erreur");
    expect(r.stdout + r.stderr).not.toMatch(/sk-ant/);
  });
});
