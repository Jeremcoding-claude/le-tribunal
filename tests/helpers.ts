import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ToolEvidence } from "@/lib/llm/types";
import type { Affirmation } from "@/lib/schemas";

/** Lit une fixture du cas de référence. */
export const fix = (f: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures/restaurants", f), "utf8"));
/** Lit une fixture piégée. */
export const piege = (nom: string) => JSON.parse(readFileSync(join(process.cwd(), "fixtures/pieges", `${nom}.json`), "utf8"));
export const AGENTS5 = ["investisseur", "comptable", "juriste", "concurrent", "cliente"] as const;

/** Les « preuves des outils » correspondant exactement aux faits d'un dossier. */
export function evidenceDe(affs: Affirmation[]): ToolEvidence {
  const faits = affs.filter((a) => a.type === "fait" && a.source_url && a.extrait);
  return {
    urlsRenvoyees: [...new Set(faits.map((a) => a.source_url!))],
    citations: faits.map((a, i) => ({ id: `C${i + 1}`, type: "recherche" as const, url: a.source_url!, titre: null, passage: a.extrait! })),
    recherches: [],
    lectures: [],
  };
}
