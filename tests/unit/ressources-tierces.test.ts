import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// L'interface ne charge AUCUNE ressource tierce (polices, CDN, traceurs) : le navigateur ne parle qu'à notre serveur (plan §12.4).
const INTERDITS = /fonts\.googleapis|fonts\.gstatic|next\/font\/google|cdn\.|unpkg\.com|cdn\.jsdelivr|googletagmanager|google-analytics/;

function fichiers(dir: string, ext: RegExp, sortie: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) fichiers(p, ext, sortie);
    else if (ext.test(n)) sortie.push(p);
  }
  return sortie;
}

describe("aucune ressource tierce", () => {
  it("le code source de l'interface (src/app, src/components) n'en référence aucune", () => {
    const sources = [...fichiers(join(process.cwd(), "src/app"), /\.(tsx?|css)$/), ...fichiers(join(process.cwd(), "src/components"), /\.(tsx?|css)$/)];
    expect(sources.length).toBeGreaterThan(10);
    for (const f of sources) expect(readFileSync(f, "utf8"), f).not.toMatch(INTERDITS);
  });

  it("le build, s'il existe, n'embarque aucune adresse de CDN ni de police externe (client)", () => {
    const dir = join(process.cwd(), ".next/static");
    if (!existsSync(dir)) return;
    for (const f of fichiers(dir, /\.(js|css)$/)) expect(readFileSync(f, "utf8"), f).not.toMatch(/fonts\.googleapis|fonts\.gstatic|unpkg\.com|cdn\.jsdelivr/);
  });
});
