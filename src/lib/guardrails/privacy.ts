// Données personnelles (plan v3.0, G9) : les sorties du Greffier et des jurés sont scannées. E-mail, numéro de téléphone,
// nom d'un dirigeant : rejet. Le nettoyage des pièces du greffe est dans registry/nettoyage.ts.

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const TELEPHONE = /(?<!\d)(?:\+\d{2}|0)\s?[1-9](?:[\s.-]?\d{2}){4}/;

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => v !== null && typeof v === "object" && !Array.isArray(v);

/** Les noms « Prénom Nom » des dirigeants d'une réponse brute du registre, AVANT leur suppression (jamais stockés). */
export function extraireNomsDirigeants(brut: unknown): string[] {
  const noms: string[] = [];
  const parcourir = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(parcourir);
    if (!estObjet(n)) return;
    if (Array.isArray(n.dirigeants)) {
      for (const d of n.dirigeants) {
        if (estObjet(d) && typeof d.nom === "string") {
          const prenom = typeof d.prenoms === "string" ? d.prenoms.split(/[\s,]+/)[0] : "";
          if (prenom) noms.push(`${prenom} ${d.nom}`, `${d.nom} ${prenom}`);
        }
      }
    }
    Object.values(n).forEach(parcourir);
  };
  parcourir(brut);
  return noms;
}

/** Ce qu'une sortie contient de personnel : « une adresse e-mail », « un numéro de téléphone », « le nom d'un dirigeant ». */
export function donneesPersonnelles(sortie: unknown, nomsProteges: readonly string[] = []): string | null {
  const s = typeof sortie === "string" ? sortie : JSON.stringify(sortie);
  if (EMAIL.test(s)) return "une adresse e-mail";
  if (TELEPHONE.test(s)) return "un numéro de téléphone";
  const bas = s.toLowerCase();
  if (nomsProteges.some((n) => bas.includes(n.toLowerCase()))) return "le nom d'un dirigeant";
  return null;
}
