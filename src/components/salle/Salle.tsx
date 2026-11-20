"use client";

// La salle : 3D si l'appareil et les préférences le permettent, sinon la scène 2D fixe. La 3D est chargée côté client
// seulement (import dynamique, pas de rendu serveur) pour ne pas alourdir la page.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { EtatSalle } from "./etat";
import SalleFixe from "./SalleFixe";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: () => null });

/** WebGL disponible, mouvement autorisé, appareil pas trop faible ? */
export function peutAfficherLa3D(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if ((navigator.hardwareConcurrency ?? 4) < 2) return false;
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Salle({ etat, force }: { etat: EtatSalle; force?: "2d" | "3d" }) {
  const [mode, setMode] = useState<"?" | "2d" | "3d">("?");
  useEffect(() => {
    // Détection WebGL : possible seulement côté navigateur, après le premier rendu (évite un écart d hydratation).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(force ?? (peutAfficherLa3D() ? "3d" : "2d"));
  }, [force]);
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-amber-900/40 bg-[#120c08]" data-testid="salle" data-mode={mode}>
      {mode === "3d" ? <Scene3D etat={etat} /> : mode === "2d" ? <SalleFixe etat={etat} /> : null}
    </div>
  );
}
