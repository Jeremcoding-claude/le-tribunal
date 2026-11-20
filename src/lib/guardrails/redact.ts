// Jamais de clé API dans un log, une erreur, un événement, un fichier .tribunal/ ou le PDF (plan v3.0, G8).
// Tout texte qui sort du moteur passe par masquerCles / masquerProfond.

const MODELES: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{4,}/g, // clés Anthropic
  /tvly-[A-Za-z0-9_-]{6,}/g, // clés Tavily
  /(?<=ANTHROPIC_API_KEY\s*[=:]\s*)["']?[^\s"',;]{6,}/g, // « ANTHROPIC_API_KEY=… »
  /(?<=TAVILY_API_KEY\s*[=:]\s*)["']?[^\s"',;]{6,}/g,
  /(?<=Bearer\s)[A-Za-z0-9._~+/=-]{12,}/g, // en-tête Authorization
  /(?<=x-api-key["']?\s*[:=]\s*["']?)[A-Za-z0-9._-]{8,}/gi,
];
export const MASQUE = "[clé masquée]";

export function masquerCles(texte: string): string {
  return MODELES.reduce((t, re) => t.replace(re, MASQUE), texte);
}

/** Masque en profondeur les chaînes d'un objet JSON. Ne modifie pas l'entrée. */
export function masquerProfond<T>(valeur: T): T {
  if (typeof valeur === "string") return masquerCles(valeur) as T;
  if (Array.isArray(valeur)) return valeur.map(masquerProfond) as T;
  if (valeur && typeof valeur === "object") {
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, masquerProfond(v)])) as T;
  }
  return valeur;
}

export const contientCle = (texte: string): boolean => masquerCles(texte) !== texte;
