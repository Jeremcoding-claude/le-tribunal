// Neutralité (plan v3.0, G3) : les mots publicitaires sont retirés par le code AVANT l'appel, puis revérifiés APRÈS.
// Les jurés ne voient que le dossier neutre : « Mon idée révolutionnaire et unique » et sa version neutre donnent le même CaseFile.

const L = "\\p{L}";
// « unique » reste permis dans « paiement unique », « achat unique », « prix unique », « licence unique » (un prix, pas un slogan).
const UNIQUE = `(?<!(?:paiement|achat|prix|licence|tarif|frais)\\s)unique`;
const MOTS = [
  "révolutionnaire", "disruptif", "disruptive", "énorme", "incroyable", "exceptionnel", "exceptionnelle", "extraordinaire",
  "meilleur", "meilleure", "inégalé", "inégalée", "incontournable", "leader", "number one", "numéro 1", "garanti",
];
const FORMES = [...MOTS.map((m) => `${m}(?:e|s|es)?`), `${UNIQUE}(?:s)?`, "uniques"];
const RE_MOTS = new RegExp(`(?<!${L})(?:${FORMES.join("|")})(?!${L})`, "giu");

/** Les mots publicitaires présents dans un texte (sans les retirer). */
export function trouverMotsPublicitaires(texte: string): string[] {
  return [...new Set([...texte.matchAll(RE_MOTS)].map((m) => m[0].toLowerCase()))];
}

const MOT = `(?<!${L})(?:${FORMES.join("|")})(?!${L})`;
const CONJ = "(?:et|ou)";
// Un bloc de mots publicitaires, avec les « et » qui les relient ou les bordent (« révolutionnaires et uniques », « incroyable et »).
const RE_BLOC = new RegExp(
  `(?:(?<!${L})${CONJ}\\s+)?${MOT}(?:\\s+${CONJ}\\s+${MOT})*(?:\\s+${CONJ}(?=\\s+${L}))?`,
  "giu",
);

/** Retire les mots publicitaires et recolle la phrase (« révolutionnaires et uniques » ne laisse pas un « et » orphelin). */
export function retirerSuperlatifs(texte: string): { texte: string; retires: string[] } {
  const retires = trouverMotsPublicitaires(texte);
  if (retires.length === 0) return { texte, retires };
  const net = texte
    .replace(RE_BLOC, " ")
    .replace(/(?<![\p{L}])(?:et|ou)\s*$/giu, "")
    .replace(/\s+([,;.])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { texte: net, retires };
}

/** Revérification APRÈS l'appel : aucun mot publicitaire ne doit rester dans la sortie du Greffier. */
export function reverifierNeutralite(texte: string): string[] {
  return trouverMotsPublicitaires(texte);
}
