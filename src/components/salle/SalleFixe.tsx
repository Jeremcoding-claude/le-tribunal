// Repli SANS 3D : une scène 2D fixe (SVG). Utilisée sans WebGL, avec prefers-reduced-motion ou sur un appareil faible (§12.4).
// Aucun accessoire détaillé, aucune animation : le journal d'audience porte toute l'information.

import type { EtatSalle, StatutActeur } from "./etat";
import { AMBRE, nomAffiche, OR, PERSONNAGES } from "./personnages";

const COULEUR_STATUT: Record<StatutActeur, string> = { attente: "#6b5a48", recherche: AMBRE, verification: "#fbbf24", vote_scelle: "#b3261e", parle: "#fde68a", termine: "#6b5a48", absent: "#3a2f26" };
const LIBELLE: Record<StatutActeur, string> = { attente: "attend", recherche: "cherche", verification: "vérifie", vote_scelle: "a voté", parle: "parle", termine: "a fini", absent: "absent" };

export default function SalleFixe({ etat }: { etat: EtatSalle }) {
  return (
    <svg viewBox="0 0 600 360" role="img" aria-label="Salle d'audience : six personnages autour d'une table ronde" className="h-full w-full">
      <rect width="600" height="360" fill="#120c08" />
      <ellipse cx="300" cy="200" rx="105" ry="52" fill="#4a2f1c" stroke="#2a1a0e" strokeWidth="3" />
      <ellipse cx="300" cy="190" rx="38" ry="16" fill={OR} opacity={etat.verdict?.verdict === "NO-GO" ? 0.25 : 0.9} />
      {PERSONNAGES.map((p) => {
        const a = etat.acteurs[p.acteur];
        const x = 300 + p.place[0] * 85;
        const y = 205 + p.place[1] * 52;
        return (
          <g key={p.acteur}>
            <rect x={x - 22} y={y - 28} width="44" height="40" rx="6" fill={p.couleur} />
            <rect x={x - 17} y={y - 52} width="34" height="26" rx="5" fill="#1b1410" stroke={COULEUR_STATUT[a.statut]} strokeWidth="2" />
            <circle cx={x - 7} cy={y - 40} r="3.5" fill={COULEUR_STATUT[a.statut]} />
            <circle cx={x + 7} cy={y - 40} r="3.5" fill={COULEUR_STATUT[a.statut]} />
            <text x={x} y={y + 28} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff4e0">
              {nomAffiche(p, etat.prenomCliente)}
            </text>
            <text x={x} y={y + 42} textAnchor="middle" fontSize="10.5" fill="#c9b79e">
              {LIBELLE[a.statut]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
