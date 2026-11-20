// Anti-consensus artificiel (plan v3.0, G2) : arguments recopiés d'un juré à l'autre, unanimité suspecte.
// Le vote 1 scellé et la réplique « conteste » obligatoire sont appliqués ailleurs (phases/debat.ts, schémas).

/** Similarité de Jaccard entre les trigrammes de caractères de deux textes (0 à 1). */
export function similarite(a: string, b: string): number {
  const A = trigrammes(a);
  const B = trigrammes(b);
  if (A.size === 0 || B.size === 0) return 0;
  let commun = 0;
  for (const t of A) if (B.has(t)) commun++;
  return commun / (A.size + B.size - commun);
}

function trigrammes(texte: string): Set<string> {
  const t = ` ${texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
  const s = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) s.add(t.slice(i, i + 3));
  return s;
}

export const SEUIL_COPIE = 0.6;

export interface ArgumentSimple {
  agent: string;
  id: string;
  these: string;
}

/** Les paires d'arguments de jurés DIFFÉRENTS qui se ressemblent trop (> 0,6) : « argument recopié ». */
export function detecterArgumentsRecopies(args: ArgumentSimple[], seuil = SEUIL_COPIE): { a: string; b: string; similarite: number }[] {
  const copies: { a: string; b: string; similarite: number }[] = [];
  for (let i = 0; i < args.length; i++) {
    for (let j = i + 1; j < args.length; j++) {
      if (args[i].agent === args[j].agent) continue;
      const s = similarite(args[i].these, args[j].these);
      if (s > seuil) copies.push({ a: args[i].id, b: args[j].id, similarite: Math.round(s * 100) / 100 });
    }
  }
  return copies;
}
