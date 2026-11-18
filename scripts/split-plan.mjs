#!/usr/bin/env node
// Découpe docs/PLAN.md en fichiers par section et par étape, dans docs/plan/.
// Usage : node scripts/split-plan.mjs        (relancer après chaque modification de PLAN.md)
// Les fichiers générés ne se modifient pas à la main. Sans dépendance.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const SOURCE = join(RACINE, "docs", "PLAN.md");
const SORTIE = join(RACINE, "docs", "plan");

// Carte de lecture : ce que chaque étape doit lire (identifiants de sections).
// Un identifiant « 4 » désigne 4.1, 4.2… ; « 3.3 » inclut 3.3.1 à 3.3.4.
const LECTURES = {
  1: ["2.2", "5.1", "7"],
  2: ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "4"],
  3: ["2.1", "3.1", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "5.1"],
  4: ["1", "3.3", "5.1", "10.1"],
  5: ["3.5", "5.1", "5.2"],
  6: ["4", "3.9", "5.1"],
  7: ["5.1", "5.2"],
  8: ["8"],
  9: ["2.3", "9.1"],
  10: ["1", "2.4", "5.2"],
  11: ["3.3", "3.9", "4", "8"],
  12: ["9.1", "9.2", "10.1", "10.2", "10.3"],
};
const FICHIERS_EXTERNES = { 3: ["docs/prompts-v3.md"] };

if (!existsSync(SOURCE)) {
  console.error("docs/PLAN.md introuvable. Lance la commande à la racine du projet.");
  process.exit(1);
}
const lignes = readFileSync(SOURCE, "utf8").split(/\r?\n/);

// 1. Repérer les titres hors blocs de code.
const titres = []; // { index, niveau, texte }
let fence = null;
lignes.forEach((l, i) => {
  const m = l.match(/^(`{3,}|~{3,})/);
  if (m) {
    if (!fence) fence = m[1];
    else if (m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
    return;
  }
  if (fence) return;
  const h = l.match(/^(#{1,3}) (.+)$/);
  if (h) titres.push({ index: i, niveau: h[1].length, texte: h[2] });
});

// 2. Construire les morceaux.
const sousSection = /^(\d+\.\d+|Étape \d+)\b/;
const morceaux = []; // { id, titre, debut, fin }
const h2 = titres.filter((t) => t.niveau === 2);
const finDoc = lignes.length;

const premierH2 = h2[0].index;
morceaux.push({ id: "tete", titre: "En-tête et historique des versions", debut: 0, fin: premierH2 });

h2.forEach((t, k) => {
  const fin = k + 1 < h2.length ? h2[k + 1].index : finDoc;
  const num = t.texte.match(/^(\d+)\./);
  const id = num ? num[1] : "sources";
  const subs = titres.filter((s) => s.niveau === 3 && s.index > t.index && s.index < fin && sousSection.test(s.texte));
  if (subs.length === 0) {
    morceaux.push({ id, titre: t.texte, debut: t.index, fin });
    return;
  }
  const cle = (s) => (s.texte.match(/^Étape (\d+)/) ? `etape-${String(s.texte.match(/^Étape (\d+)/)[1]).padStart(2, "0")}` : s.texte.match(/^(\d+\.\d+)/)[1]);
  const estEtape = subs[0].texte.startsWith("Étape");
  if (estEtape) {
    morceaux.push({ id: "6", titre: t.texte + " (mode d'emploi)", debut: t.index, fin: subs[0].index });
    subs.forEach((s, j) => morceaux.push({ id: cle(s), titre: s.texte, debut: s.index, fin: j + 1 < subs.length ? subs[j + 1].index : fin }));
  } else {
    subs.forEach((s, j) =>
      morceaux.push({ id: cle(s), titre: s.texte, debut: j === 0 ? t.index : s.index, fin: j + 1 < subs.length ? subs[j + 1].index : fin }),
    );
  }
});

// 3. Noms de fichiers.
const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s) => sansAccent(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36).replace(/-$/, "");
const nomFichier = (m) => {
  if (m.id === "tete") return "00-en-tete.md";
  if (m.id === "sources") return "99-sources.md";
  if (m.id.startsWith("etape-")) return `${m.id}.md`;
  const [a, b] = m.id.split(".");
  const prefixe = b ? `${a.padStart(2, "0")}-${b}` : a.padStart(2, "0");
  return `${prefixe}-${slug(m.titre.replace(/^\d+(\.\d+)?\.?\s*/, ""))}.md`;
};
morceaux.forEach((m) => (m.fichier = nomFichier(m)));
const parId = (id) => morceaux.filter((m) => m.id === id || m.id.startsWith(id + "."));

// 4. Écrire.
rmSync(SORTIE, { recursive: true, force: true });
mkdirSync(SORTIE, { recursive: true });
const ENTETE = "<!-- GÉNÉRÉ par scripts/split-plan.mjs depuis docs/PLAN.md — ne pas modifier -->\n\n";
const REMPLACE_PLAN =
  /docs\/PLAN\.md(?:\s*\([^)]*\)|\s+sections?\s+\d+(?:\.\d+)?(?:(?:,|\s+et)\s+\d+(?:\.\d+)?(?:\s*\([^)]*\))?)*(?:\s+en entier)?)?/g;

const taille = {};
for (const m of morceaux) {
  let corps = lignes.slice(m.debut, m.fin).join("\n").replace(/\n+$/, "") + "\n";
  let avant = "";
  const mEtape = m.id.match(/^etape-(\d+)$/);
  if (mEtape) {
    const n = Number(mEtape[1]);
    const ids = LECTURES[n] ?? [];
    const fichiers = ids.flatMap((id) => {
      const trouves = parId(id);
      if (trouves.length === 0) { console.error(`Section introuvable pour l'étape ${n} : ${id}`); process.exit(1); }
      return trouves.map((x) => `docs/plan/${x.fichier}`);
    });
    const tous = [...new Set([...fichiers, ...(FICHIERS_EXTERNES[n] ?? [])])];
    avant =
      `## À lire (et rien d'autre)\n\n${tous.map((f) => `- \`${f}\``).join("\n")}\n\n` +
      `Ne lis pas \`docs/PLAN.md\` en entier. Les mentions de « docs/PLAN.md » ci-dessous désignent ces fichiers.\n\n---\n\n`;
    corps = corps.replace(REMPLACE_PLAN, "les fichiers de docs/plan/ listés dans « À lire »");
  }
  writeFileSync(join(SORTIE, m.fichier), ENTETE + avant + corps);
  taille[m.fichier] = (ENTETE + avant + corps).length;
}

// 5. Index.
const jetons = (c) => Math.round(c / 3.5);
let idx = ENTETE + "# Index du plan (généré)\n\nPoids estimé : 1 token ≈ 3,5 caractères (estimation).\n\n";
idx += "| Fichier | Contenu | Poids estimé |\n|---|---|---|\n";
for (const m of morceaux) idx += `| \`${m.fichier}\` | ${m.titre.replace(/\|/g, "/")} | ≈ ${jetons(taille[m.fichier]).toLocaleString("fr-FR")} tokens |\n`;
idx += "\n## Lecture par étape\n\n| Étape | Fichiers à lire | Poids estimé |\n|---|---|---|\n";
for (let n = 1; n <= 12; n++) {
  const f = LECTURES[n].flatMap((id) => parId(id)).map((x) => x.fichier);
  const u = [...new Set(f)];
  const p = u.reduce((s, x) => s + (taille[x] ?? 0), 0) + (taille[`etape-${String(n).padStart(2, "0")}.md`] ?? 0);
  idx += `| ${n} | \`etape-${String(n).padStart(2, "0")}.md\` + ${u.length} fichier(s)${FICHIERS_EXTERNES[n] ? " + prompts-v3.md" : ""} | ≈ ${jetons(p).toLocaleString("fr-FR")} tokens |\n`;
}
writeFileSync(join(SORTIE, "INDEX.md"), idx);
console.log(`${morceaux.length} fichiers générés dans docs/plan/ (voir INDEX.md).`);
