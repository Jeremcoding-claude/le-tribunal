"use client";

// L'audience : la salle (3D ou 2D) et le journal, alimentés par les MÊMES événements, en direct (SSE) ou en rejeu.
// Direct et rejeu partagent le même code d'affichage : « Voir la démo » et « Mes audiences » relisent des événements enregistrés.
// Aucun import d'exécution de schemas.ts ici : le client ne doit contenir ni configuration serveur ni clé (G8).

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TrialEvent } from "../../lib/schemas";
import { appliquer, etatInitial, type EtatSalle } from "../salle/etat";
import Salle from "../salle/Salle";
import { NOMS_EVENEMENTS } from "./evenements";
import Journal from "./Journal";

export type SourceAudience = { mode: "direct"; id: string } | { mode: "rejeu"; evenements: TrialEvent[]; vitesseMs?: number };

export default function Audience({ source }: { source: SourceAudience }) {
  const [etat, setEtat] = useState<EtatSalle>(etatInitial);
  const [statut, setStatut] = useState<string | null>(null);
  const [rejeuFini, setRejeuFini] = useState(false);
  const rejeuRef = useRef<{ i: number; stop: boolean }>({ i: 0, stop: false });

  const direct = source.mode === "direct" ? source.id : null;
  const evenements = source.mode === "rejeu" ? source.evenements : null;
  const vitesse = source.mode === "rejeu" ? (source.vitesseMs ?? 140) : 0;

  // Direct : EventSource reprend tout seul avec Last-Event-ID après une coupure.
  useEffect(() => {
    if (!direct) return;
    const es = new EventSource(`/api/trials/${direct}/stream`);
    const recevoir = (m: MessageEvent) => {
      const ev = JSON.parse(m.data) as TrialEvent;
      setEtat((s) => appliquer(s, ev));
      if (ev.type === "verdict" || (ev.type === "error" && (ev.code === "echec" || ev.code === "budget_depasse"))) {
        es.close();
        void fetch(`/api/trials/${direct}`).then((r) => r.json()).then((j: { statut: string }) => setStatut(j.statut));
      }
    };
    for (const n of NOMS_EVENEMENTS) es.addEventListener(n, recevoir as EventListener);
    return () => es.close();
  }, [direct]);

  // Rejeu : un événement toutes les `vitesse` ms ; « Tout afficher » les applique d'un coup.
  useEffect(() => {
    if (!evenements) return;
    const r = rejeuRef.current;
    r.i = 0;
    r.stop = false;
    // Remise à zéro volontaire au (re)lancement du rejeu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEtat(etatInitial());
    setRejeuFini(false);
    const t = setInterval(() => {
      if (r.stop || r.i >= evenements.length) {
        clearInterval(t);
        setRejeuFini(true);
        return;
      }
      const ev = evenements[r.i++];
      setEtat((s) => appliquer(s, ev));
    }, vitesse);
    return () => {
      r.stop = true;
      clearInterval(t);
    };
  }, [evenements, vitesse]);

  const toutAfficher = useCallback(() => {
    if (!evenements) return;
    rejeuRef.current.stop = true;
    setEtat(evenements.reduce(appliquer, etatInitial()));
    setRejeuFini(true);
  }, [evenements]);

  const repondre = useCallback(
    async (reponses: { code: string; reponse: string | null }[]) => {
      if (direct) await fetch(`/api/trials/${direct}/answers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reponses }) });
    },
    [direct],
  );

  const reprendre = useCallback(async () => {
    if (!direct) return;
    await fetch(`/api/trials/${direct}/resume`, { method: "POST" });
    window.location.reload();
  }, [direct]);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Salle etat={etat} />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/" className="text-amber-300 underline">
            Nouvelle idée
          </Link>
          {source.mode === "rejeu" && !rejeuFini ? (
            <button type="button" onClick={toutAfficher} className="rounded-md border border-amber-700 px-3 py-1 text-amber-200">
              Tout afficher
            </button>
          ) : null}
          {source.mode === "rejeu" ? <span className="text-stone-400">Rejeu d&apos;un procès enregistré : aucun appel payant.</span> : null}
          {direct && (statut === "interrompu" || statut === "echec") ? (
            <button type="button" onClick={reprendre} className="rounded-md bg-amber-500 px-3 py-1 font-semibold text-black">
              Reprendre le procès
            </button>
          ) : null}
        </div>
      </div>
      <Journal etat={etat} trialId={direct ?? undefined} onRepondre={repondre} />
    </main>
  );
}
