// Nettoyage des pièces du greffe (plan v3.0, §3.3.2 et G9) : AUCUNE donnée personnelle ne passe au Greffier.
// Deux protections cumulées : (1) liste blanche : on ne construit une correspondance qu'à partir de champs choisis ;
// (2) suppression en profondeur des champs de config.ts (registry.champsSupprimes) dans la réponse brute.

import { GUARDRAILS } from "../guardrails/config";
import type { PiecesDuGreffe } from "../schemas";

type Objet = Record<string, unknown>;
export type Correspondance = PiecesDuGreffe["correspondances"][number];

const estObjet = (v: unknown): v is Objet => v !== null && typeof v === "object" && !Array.isArray(v);

/** Champs de l'API Recherche d'entreprises qui désignent une personne (dirigeants, élus, adresses, contacts). */
const CHAMPS_API_PERSONNELS = ["prenoms", "annee_de_naissance", "date_de_naissance", "adresse", "geo_adresse", "numero_voie", "libelle_voie", "type_voie", "coordonnees", "latitude", "longitude"];

/** Supprime en profondeur les champs personnels de la réponse brute. Ne modifie pas l'entrée. */
export function supprimerChampsPersonnels<T>(brut: T, champs: readonly string[] = [...GUARDRAILS.registry.champsSupprimes, "dirigeant", ...CHAMPS_API_PERSONNELS]): T {
  const interdits = new Set(champs);
  const parcourir = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(parcourir);
    if (estObjet(n)) return Object.fromEntries(Object.entries(n).filter(([k]) => !interdits.has(k)).map(([k, v]) => [k, parcourir(v)]));
    return n;
  };
  return parcourir(brut) as T;
}

/** Minuscules, sans accents, tirets et apostrophes en espaces : « Saint-Étienne » = « saint etienne ». */
export function normaliserLieu(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** « LYON » → « Lyon », « SAINT-ÉTIENNE » → « Saint-Étienne », « L'ISLE-ADAM » → « L'Isle-Adam ». */
export function titreCommune(libelle: string): string {
  return libelle.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, l: string) => sep + l.toUpperCase());
}

/** Vrai si la commune de l'établissement est celle de la saisie (« Lyon 3e » compte pour « Lyon »). */
export function memeCommune(communeRegistre: string, ville: string): boolean {
  const a = normaliserLieu(communeRegistre);
  const b = normaliserLieu(ville);
  return a === b || a.startsWith(b + " ");
}

const NAF = /^\d{2}\.\d{2}[A-Z]$/;

/**
 * Une entreprise de l'API Recherche d'entreprises → une correspondance sans donnée personnelle, ou null si elle est
 * inexploitable. Une entreprise individuelle (nature juridique 1xxx : souvent au nom d'une personne) est masquée.
 */
export function normaliserCorrespondance(brut: unknown): Correspondance | null {
  if (!estObjet(brut)) return null;
  const siege = estObjet(brut.siege) ? brut.siege : {};
  const siren = typeof brut.siren === "string" ? brut.siren : "";
  const naf = typeof brut.activite_principale === "string" ? brut.activite_principale : "";
  const libelleCommune = typeof siege.libelle_commune === "string" ? siege.libelle_commune : typeof siege.commune === "string" ? siege.commune : "";
  if (!/^\d{9}$/.test(siren) || !NAF.test(naf) || !libelleCommune) return null;

  const individuelle = typeof brut.nature_juridique === "string" && brut.nature_juridique.startsWith("1");
  const nom = typeof brut.nom_complet === "string" ? brut.nom_complet : "";
  return {
    denomination: individuelle ? "entreprise individuelle" : nom || "dénomination non communiquée",
    siren,
    activite_naf: naf,
    commune: titreCommune(libelleCommune),
    date_creation: typeof brut.date_creation === "string" ? brut.date_creation : "",
    etat: brut.etat_administratif === "A" ? "active" : "cessee",
    source_url: `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}`,
  };
}
