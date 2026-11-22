// Coût mesuré des VRAIS procès (jamais ceux du MOCK) : enregistrement, statistiques, section du README. Fonctions pures + lecture de fichier.
// Les enregistrements viennent de `npm run smoke` (.tribunal/couts.jsonl) : un procès MOCK n'y est jamais écrit.

import { existsSync, readFileSync } from "node:fs";

export interface EnregistrementCout {
  id: string;
  date: string; // AAAA-MM-JJ
  coutUsd: number;
  parPhase: Record<string, number>;
  verdict?: string;
  rejets?: Record<string, number>; // règle → taux (0 à 1)
}

export interface StatsCouts {
  n: number;
  moyen: number;
  min: number;
  max: number;
  parPhase: { phase: string; moyen: number; part: number }[];
}

export function lireEnregistrements(chemin: string): EnregistrementCout[] {
  if (!existsSync(chemin)) return [];
  const sortie: EnregistrementCout[] = [];
  for (const l of readFileSync(chemin, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try {
      const e = JSON.parse(l) as EnregistrementCout;
      if (typeof e.id === "string" && Number.isFinite(e.coutUsd) && e.coutUsd > 0) sortie.push(e);
    } catch {
      /* ligne illisible : ignorée */
    }
  }
  return sortie;
}

export function statsCouts(r: EnregistrementCout[]): StatsCouts | null {
  if (!r.length) return null;
  const couts = r.map((x) => x.coutUsd);
  const total = couts.reduce((a, b) => a + b, 0);
  const phases = new Map<string, number>();
  for (const x of r) for (const [p, v] of Object.entries(x.parPhase)) phases.set(p, (phases.get(p) ?? 0) + v);
  const sommePhases = [...phases.values()].reduce((a, b) => a + b, 0) || 1;
  return {
    n: r.length,
    moyen: total / r.length,
    min: Math.min(...couts),
    max: Math.max(...couts),
    parPhase: [...phases.entries()].map(([phase, v]) => ({ phase, moyen: v / r.length, part: v / sommePhases })).sort((a, b) => b.moyen - a.moyen),
  };
}

const usd = (n: number) => `${n.toFixed(2).replace(".", ",")} $`;

export const DEBUT_SECTION = "<!-- COUT-MESURE:DEBUT -->";
export const FIN_SECTION = "<!-- COUT-MESURE:FIN -->";

export function sectionCout(s: StatsCouts | null): string {
  if (!s) return `${DEBUT_SECTION}\nAucun procès réel mesuré pour l'instant (voir l'estimation ci-dessus). Mesure : \`npm run smoke\` puis \`npm run cost\`.\n${FIN_SECTION}`;
  const lignes = s.parPhase.map((p) => `| ${p.phase} | ${usd(p.moyen)} | ${Math.round(p.part * 100)} % |`).join("\n");
  return `${DEBUT_SECTION}\n**Coût mesuré** sur ${s.n} procès réel${s.n > 1 ? "s" : ""} : moyen **${usd(s.moyen)}**, minimum ${usd(s.min)}, maximum ${usd(s.max)}.\n\n| Phase | Coût moyen | Part |\n|---|---|---|\n${lignes}\n${FIN_SECTION}`;
}

/** Remplace la section entre les marqueurs ; la crée à la fin si elle manque. */
export function mettreAJourReadme(readme: string, section: string): string {
  const a = readme.indexOf(DEBUT_SECTION);
  const b = readme.indexOf(FIN_SECTION);
  if (a >= 0 && b > a) return readme.slice(0, a) + section + readme.slice(b + FIN_SECTION.length);
  return `${readme.trimEnd()}\n\n${section}\n`;
}
