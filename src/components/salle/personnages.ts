// Les personnages de la salle : prénoms (source unique : prompts/salle.ts), rôles, accessoires, couleurs et places.
// ACCESSOIRES, COULEURS ET DÉCOR VIVENT ICI et nulle part dans un prompt (plan v3.0, §12.4).

import { SALLE } from "../../../prompts/salle";
import type { AgentJure } from "../../lib/schemas";

export type Acteur = AgentJure | "juge";
export type Accessoire = "perruque" | "haut-de-forme" | null;

export interface Personnage {
  acteur: Acteur;
  /** Prénom fixe ; la Cliente n'en a pas : il vient des événements du procès. */
  prenom: string | null;
  role: string;
  couleur: string;
  accessoire: Accessoire;
  /** Place autour de la table : x, z (la scène est vue de face, Nadia au fond). */
  place: [number, number];
}

export const PERSONNAGES: Personnage[] = [
  { acteur: "juge", prenom: SALLE.JUG.prenom, role: "Le Juge", couleur: "#6b4f3a", accessoire: "perruque", place: [0, -2.7] },
  { acteur: "investisseur", prenom: SALLE.INV.prenom, role: "L'Investisseur", couleur: "#3f6b8f", accessoire: "haut-de-forme", place: [-2.6, -1] },
  { acteur: "comptable", prenom: SALLE.CPT.prenom, role: "La Comptable", couleur: "#5f8f6b", accessoire: null, place: [2.6, -1] },
  { acteur: "juriste", prenom: SALLE.JUR.prenom, role: "La Juriste", couleur: "#8f5f8a", accessoire: null, place: [-1.9, 1.7] },
  { acteur: "concurrent", prenom: SALLE.CON.prenom, role: "Le Concurrent", couleur: "#8f4f4f", accessoire: null, place: [1.9, 1.7] },
  { acteur: "cliente", prenom: null, role: "La Cliente", couleur: "#9a7b3f", accessoire: null, place: [0, 2.6] },
];

export const AMBRE = "#f59e0b";
export const OR = "#e8b84a";
export const nomAffiche = (p: Personnage, prenomCliente: string | null): string => p.prenom ?? prenomCliente ?? "La Cliente";
