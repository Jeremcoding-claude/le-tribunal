// P0 — découpage déterministe de la saisie (plan v3.0, §3.3.1). Aucun LLM : le code lit « Nom, offre, cible, prix, ville[, car problème] ».
// Les deux formes du cas de référence donnent la même saisie :
//   « Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon »
//   « Brigade IA, agents IA, aux restaurants indépendants, 149 € par mois, Lyon »
// Le Greffier confirmera ensuite le découpage, et le code vérifiera que chaque champ est un extrait de la saisie.

import { GUARDRAILS } from "../guardrails/config";
import { estUnPrix, lirePrix, retirerPrix, type PrixLu } from "../guardrails/numbers";
import { Saisie } from "../schemas";

export const FORMAT_SAISIE = "Nom, ce qu'il vend, à qui, à quel prix, dans quelle ville[, car le problème réglé]";
export const EXEMPLE_SAISIE = "Brigade IA, agents IA qui gèrent réservations et avis, aux restaurants indépendants, 149 € par mois, Lyon";

export type ElementManquant = "nom" | "offre" | "cible" | "ville";

export type ResultatSaisie =
  | { ok: true; saisie: Saisie; prix: PrixLu | null }
  | { ok: false; manque: ElementManquant[]; message: string; format: string; exemple: string };

const LIBELLE: Record<ElementManquant, string> = { nom: "le nom", offre: "ce qu'il vend", cible: "à qui", ville: "la ville" };

const PAYS: Record<string, string> = {
  france: "FR", belgique: "BE", suisse: "CH", luxembourg: "LU", canada: "CA", espagne: "ES", italie: "IT",
  allemagne: "DE", portugal: "PT", "royaume-uni": "GB", "pays-bas": "NL", maroc: "MA", tunisie: "TN", algerie: "DZ",
};
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function refus(manque: ElementManquant[], detail?: string): ResultatSaisie {
  const quoi = manque.length ? `Il manque : ${manque.map((m) => LIBELLE[m]).join(", ")}.` : "";
  return {
    ok: false,
    manque,
    message: [detail, quoi, `Format : ${FORMAT_SAISIE}`, `Exemple : ${EXEMPLE_SAISIE}`].filter(Boolean).join(" "),
    format: FORMAT_SAISIE,
    exemple: EXEMPLE_SAISIE,
  };
}

const commencePar = (element: string, marqueurs: readonly string[]) => {
  const e = element.toLowerCase();
  return marqueurs.find((m) => e.startsWith(m.toLowerCase()));
};

export function decouperSaisie(texte: string): ResultatSaisie {
  const net = texte.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (net.length === 0) return refus(["nom", "offre", "cible", "ville"], "La saisie est vide.");
  if (net.length > GUARDRAILS.input.maxChars) return refus([], `La saisie dépasse ${GUARDRAILS.input.maxChars} caractères.`);

  let elements = net.split(",").map((e) => e.trim()).filter(Boolean);

  // Le problème (« car… », « parce que… », « problème : … ») : il court jusqu'à la fin, virgules comprises.
  let probleme: string | null = null;
  const iProb = elements.findIndex((e, i) => i >= 2 && commencePar(e, GUARDRAILS.input.marqueursProbleme));
  if (iProb >= 0) {
    const marqueur = commencePar(elements[iProb], GUARDRAILS.input.marqueursProbleme)!;
    const reste = [elements[iProb].slice(marqueur.length).trim(), ...elements.slice(iProb + 1)].filter(Boolean);
    probleme = reste.join(", ") || null;
    elements = elements.slice(0, iProb);
  }

  const manque: ElementManquant[] = [];
  if (elements.length < 2) return refus(elements.length === 0 ? ["nom", "offre", "cible", "ville"] : ["offre", "cible", "ville"]);

  const nom = elements[0];
  let villeBrute = elements[elements.length - 1];
  const milieu = elements.slice(1, -1);

  // Ville et pays : « Bruxelles (Belgique) » → Bruxelles, BE.
  let pays = "FR";
  const mp = villeBrute.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (mp) {
    const p = mp[2].trim();
    const code = /^[A-Za-z]{2}$/.test(p) ? p.toUpperCase() : PAYS[sansAccent(p)];
    if (!code) return refus(["ville"], `Pays inconnu : « ${p} ».`);
    villeBrute = mp[1].trim();
    pays = code;
  }

  // Les éléments du milieu : prix seul d'abord (même s'il commence par « à »), puis cible, le reste est l'offre.
  const restant = [...milieu];
  let prix: PrixLu | null = null;
  const iPrix = restant.findIndex(estUnPrix);
  if (iPrix >= 0) {
    prix = lirePrix(restant[iPrix]);
    restant.splice(iPrix, 1);
  }

  let cible = "";
  let iCible = restant.findIndex((e) => commencePar(e, GUARDRAILS.input.marqueursCible) !== undefined);
  if (iCible < 0 && restant.length >= 2) iCible = restant.length - 1; // ordre naturel : nom, offre, cible
  if (iCible >= 0) {
    const m = commencePar(restant[iCible], GUARDRAILS.input.marqueursCible);
    cible = (m ? restant[iCible].slice(m.length) : restant[iCible]).trim();
    restant.splice(iCible, 1);
  }

  let offre = restant.join(", ").trim();
  // Un prix écrit DANS l'offre est extrait aussi ; l'offre garde le reste (« agents IA à 149 € par mois » → « agents IA »).
  if (!prix && offre) {
    const dedans = lirePrix(offre);
    if (dedans) {
      prix = dedans;
      offre = retirerPrix(offre);
    }
  }

  if (!nom) manque.push("nom");
  if (!offre) manque.push("offre");
  if (!cible) manque.push("cible");
  if (!villeBrute) manque.push("ville");
  if (manque.length) return refus(manque);

  const r = Saisie.safeParse({ nom, offre, cible, prix: prix?.texte ?? null, ville: villeBrute, pays, probleme });
  if (!r.success) return refus([], `Saisie non valide : ${r.error.issues[0]?.path.join(".")} (${r.error.issues[0]?.message}).`);
  return { ok: true, saisie: r.data, prix };
}
