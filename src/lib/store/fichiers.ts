// Store fichiers : `.tribunal/<id>/etat.json` et `evenements.jsonl` (plugin Claude Code). Jamais de clé API dedans (G8).
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TrialEvent } from "../schemas";
import type { Store } from "./types";

const ID_SUR = /^[A-Za-z0-9_-]{1,64}$/;

export function creerStoreFichiers(racine = join(process.cwd(), ".tribunal")): Store {
  const dossier = (id: string) => {
    if (!ID_SUR.test(id)) throw new Error("Identifiant de procès invalide.");
    const d = join(racine, id);
    mkdirSync(d, { recursive: true });
    return d;
  };
  return {
    async sauvegarder(id, phase, etat) {
      writeFileSync(join(dossier(id), "etat.json"), JSON.stringify({ phase, etat }, null, 2));
    },
    async dernierEtat(id) {
      const f = join(dossier(id), "etat.json");
      return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { phase: string; etat: unknown }) : null;
    },
    async ajouterEvenement(id, e) {
      appendFileSync(join(dossier(id), "evenements.jsonl"), JSON.stringify(e) + "\n");
    },
    async evenements(id) {
      const f = join(dossier(id), "evenements.jsonl");
      if (!existsSync(f)) return [];
      return readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => TrialEvent.parse(JSON.parse(l)));
    },
  };
}
