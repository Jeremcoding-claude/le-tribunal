// npm run cost — lit .tribunal/couts.jsonl (vrais procès enregistrés par `npm run smoke`), affiche coût moyen / min / max et la
// répartition par phase, et met à jour la section « Coût mesuré » du README. Aucun appel réseau, aucun coût.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lireEnregistrements, mettreAJourReadme, sectionCout, statsCouts } from "../src/lib/trial/couts";

const racine = process.cwd();
const stats = statsCouts(lireEnregistrements(join(racine, ".tribunal", "couts.jsonl")));
if (!stats) {
  console.log("Aucun procès réel enregistré (.tribunal/couts.jsonl). Lance « MOCK_MODE=false npm run smoke » (payant) d'abord.");
} else {
  const usd = (n: number) => `${n.toFixed(2)} $`;
  console.log(`${stats.n} procès réel(s) · moyen ${usd(stats.moyen)} · min ${usd(stats.min)} · max ${usd(stats.max)}`);
  for (const p of stats.parPhase) console.log(`  ${p.phase.padEnd(6)} ${usd(p.moyen)}  (${Math.round(p.part * 100)} %)`);
}
const readme = join(racine, "README.md");
if (existsSync(readme)) {
  writeFileSync(readme, mettreAJourReadme(readFileSync(readme, "utf8"), sectionCout(stats)));
  console.log("README.md : section « Coût mesuré » mise à jour.");
}
