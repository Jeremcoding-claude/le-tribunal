// npm run smoke — UN vrai procès (payant, MANUEL) sur le cas de référence, en mode API. Il refuse de partir sans MOCK_MODE=false
// et sans clé. Il vérifie : verdict produit, coût sous le plafond, aucun chiffre non sourcé dans le PDF ; il affiche le taux de
// rejet par règle et signale toute règle au-dessus de GUARDRAILS.rejets.alerteParRegle.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleAnthropicPresente, GUARDRAILS } from "../src/lib/guardrails/config";
import { creerClientReel } from "../src/lib/llm/client";
import { construireRapport, verifierRapport } from "../src/lib/pdf/rapport";
import { genererPdf } from "../src/lib/pdf/Report";
import { creerSourcesReelles } from "../src/lib/registry";
import { creerStoreFichiers } from "../src/lib/store/fichiers";
import { runTrial } from "../src/lib/trial/run";
import { tauxDeRejet } from "../src/lib/trial/stats";

const SAISIE = "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon";

async function main() {
  if (GUARDRAILS.mock) throw new Error("npm run smoke est payant : lance-le avec MOCK_MODE=false (et ANTHROPIC_API_KEY définie).");
  if (!cleAnthropicPresente()) throw new Error("ANTHROPIC_API_KEY n'est pas définie.");
  const racine = join(process.cwd(), ".tribunal");
  const id = `smoke-${Date.now().toString(36)}`;
  const r = await runTrial(SAISIE, { client: creerClientReel(), sources: creerSourcesReelles(), store: creerStoreFichiers(racine), id });
  const echecs: string[] = [];
  if (r.statut !== "termine") echecs.push(`statut « ${r.statut} » : ${r.message ?? ""}`);
  const cout = r.etat?.coutUsd ?? 0;
  if (cout >= GUARDRAILS.budget.maxUsdPerTrial) echecs.push(`coût ${cout} $ ≥ plafond ${GUARDRAILS.budget.maxUsdPerTrial} $`);
  if (r.etat?.resultat) {
    const violations = verifierRapport(construireRapport(r.etat, { date: new Date().toISOString().slice(0, 10) }));
    if (violations.length) echecs.push(`${violations.length} chiffre(s) non sourcé(s) dans le rapport`);
    mkdirSync(join(racine, id), { recursive: true });
    writeFileSync(join(racine, id, "rapport.pdf"), await genererPdf(r.etat));
  }
  console.log(`Verdict : ${r.etat?.resultat?.verdictJury ?? "aucun"} · ${r.etat?.resultat?.phrase ?? ""}`);
  console.log(`Notes : ${r.etat?.resultat?.noteAvant ?? "?"} vers ${r.etat?.resultat?.noteApres ?? "?"} / 10 · coût mesuré : ${cout} $ (plafond ${GUARDRAILS.budget.maxUsdPerTrial} $)`);
  console.log("Taux de rejet par règle :");
  for (const t of tauxDeRejet(r.evenements)) console.log(`  ${t.alerte ? "ALERTE" : "ok    "} ${t.regle} : ${t.rejets}/${t.total} (${Math.round(t.taux * 100)} %)`);
  if (echecs.length) {
    console.error(`SMOKE ÉCHOUÉ :\n- ${echecs.join("\n- ")}`);
    process.exitCode = 1;
  } else console.log(`SMOKE OK · rapport : ${join(racine, id, "rapport.pdf")}`);
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e).replace(/sk-ant-[A-Za-z0-9_-]+/g, "[clé masquée]"));
  process.exit(1);
});
