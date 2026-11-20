// Enregistre les événements du procès MOCK du cas de référence dans fixtures/restaurants/events.json (« Voir la démo »).
// Identifiant et dates sont normalisés : le fichier est déterministe. Usage : npx tsx scripts/gen-events.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { creerClientMock } from "../src/lib/llm/mock";
import { creerSourcesMock } from "../src/lib/registry";
import { creerStoreMemoire } from "../src/lib/store/memoire";
import { runTrial } from "../src/lib/trial/run";

export const SAISIE_DEMO = "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon";
const DEBUT = Date.parse("2026-11-20T10:00:00.000Z");

export async function evenementsDemo() {
  const r = await runTrial(SAISIE_DEMO, { client: creerClientMock(), sources: creerSourcesMock(), store: creerStoreMemoire(), id: "demo" });
  if (r.statut !== "termine") throw new Error(`Le procès de démonstration a échoué : ${r.message}`);
  return r.evenements.map((e) => ({ ...e, trial_id: "demo", ts: new Date(DEBUT + e.seq * 1000).toISOString() }));
}

if (process.argv[1]?.endsWith("gen-events.ts")) {
  const evs = await evenementsDemo();
  writeFileSync(join(process.cwd(), "fixtures/restaurants/events.json"), JSON.stringify(evs, null, 1) + "\n");
  console.log(`${evs.length} événements enregistrés.`);
}
