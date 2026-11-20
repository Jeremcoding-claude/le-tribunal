// Sources MOCK des pièces du greffe : lisent fixtures/<cas>/registre.json (format brut des vraies API). Aucun réseau.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourcesRegistre } from "./fr";

export function creerSourcesMock(opts: { racine?: string; cas?: string } = {}): SourcesRegistre {
  const fichier = join(opts.racine ?? process.cwd(), "fixtures", opts.cas ?? "restaurants", "registre.json");
  const lire = () => JSON.parse(readFileSync(fichier, "utf8")) as { registre: unknown; commune: unknown };
  return {
    registre: async () => lire().registre,
    commune: async () => lire().commune,
  };
}
