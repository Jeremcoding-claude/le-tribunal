"use client";

// « Voir la démo » : rejoue le procès enregistré du cas de référence (fixtures/restaurants/events.json). Zéro appel payant.
import { useEffect, useState } from "react";
import type { TrialEvent } from "../../lib/schemas";
import Audience from "./Audience";

export default function Demo() {
  const [evs, setEvs] = useState<TrialEvent[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/demo")
      .then(async (r) => (r.ok ? ((await r.json()) as { evenements: TrialEvent[] }).evenements : Promise.reject(((await r.json()) as { erreur: string }).erreur)))
      .then(setEvs)
      .catch((e: unknown) => setErreur(String(e)));
  }, []);
  if (erreur) return <p role="alert" className="p-8 text-red-300">{erreur}</p>;
  if (!evs) return <p className="p-8 text-stone-400">Chargement de la démo…</p>;
  return <Audience source={{ mode: "rejeu", evenements: evs }} />;
}
