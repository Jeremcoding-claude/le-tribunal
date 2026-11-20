"use client";

// « Mes audiences » : les procès enregistrés sur ce serveur. Pas de comptes : une instance = une liste, partagée par toutes les
// personnes qui ont accès. Les idées sont stockées sur le serveur de celui qui héberge : la page le dit.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Ligne {
  id: string;
  idee: string;
  statut: string;
  creeLe: string;
  enCours: boolean;
}

const STATUT: Record<string, string> = { en_cours: "en cours", termine: "terminé", ajourne: "ajourné", interrompu: "interrompu", echec: "échec", budget_depasse: "arrêté (coût)" };

export default function ListeAudiences() {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const charger = useCallback(async () => {
    const r = await fetch("/api/trials");
    setLignes(((await r.json()) as { audiences: Ligne[] }).audiences);
  }, []);
  useEffect(() => {
    // Chargement initial depuis l API (système externe).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, [charger]);

  async function supprimer(id: string) {
    const r = await fetch(`/api/trials/${id}`, { method: "DELETE" });
    setMessage(r.status === 204 ? null : ((await r.json()) as { erreur: string }).erreur);
    await charger();
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-white">Mes audiences{lignes ? ` (${lignes.length})` : ""}</h1>
      <p className="mt-2 text-sm text-stone-400">Ces idées sont enregistrées sur le serveur de la personne qui héberge Le Tribunal, et partagées par tous ceux qui y ont accès.</p>
      {message ? (
        <p role="alert" className="mt-3 text-red-300">
          {message}
        </p>
      ) : null}
      <ul className="mt-6 space-y-3">
        {(lignes ?? []).map((l) => (
          <li key={l.id} className="flex items-start justify-between gap-3 rounded-xl border border-amber-900/30 bg-black/20 p-4">
            <div>
              <Link href={`/audience/${l.id}`} className="font-semibold text-amber-200 underline">
                {l.idee.split(",")[0]}
              </Link>
              <p className="text-sm text-stone-300">{l.idee}</p>
              <p className="text-xs text-stone-500">
                {STATUT[l.statut] ?? l.statut} · {new Date(l.creeLe).toLocaleString("fr-FR")}
              </p>
            </div>
            <button type="button" disabled={l.enCours} onClick={() => supprimer(l.id)} className="rounded-md border border-red-700/60 px-3 py-1 text-sm text-red-200 disabled:opacity-40">
              Supprimer
            </button>
          </li>
        ))}
      </ul>
      {lignes && lignes.length === 0 ? <p className="mt-6 text-stone-400">Aucune audience pour l&apos;instant.</p> : null}
    </main>
  );
}
