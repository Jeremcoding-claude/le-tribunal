"use client";

// L'accueil : la salle au repos, UN champ, trois idées d'exemple (un clic remplit le champ, il ne lance rien), « Juger mon idée ».
// Tutoiement, mots courts. Le texte brut n'est jamais transmis aux jurés : intake.ts le découpe côté serveur.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { etatInitial } from "../salle/etat";
import Salle from "../salle/Salle";

export const EXEMPLES = [
  "Brigade IA, agents IA à 149 € par mois, restaurants indépendants, Lyon",
  "Vélocité, atelier de réparation de vélos à domicile à 45 € l'intervention, cyclistes urbains, Nantes",
  "Pause Zen, application de méditation guidée à 6 € par mois, étudiants, en ligne",
];

export default function Accueil() {
  const router = useRouter();
  const [idee, setIdee] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function juger(ev: React.FormEvent) {
    ev.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const res = await fetch("/api/trials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idee }) });
      const j = (await res.json()) as { id?: string; erreur?: string };
      if (res.ok && j.id) router.push(`/audience/${j.id}`);
      else setErreur(j.erreur ?? "Le procès n'a pas pu s'ouvrir.");
    } catch {
      setErreur("Le serveur ne répond pas.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xl font-extrabold tracking-tight text-amber-200">⚖ Le Tribunal</span>
        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">6 agents</span>
      </div>
      <Salle etat={etatInitial()} />
      <form onSubmit={juger} className="mx-auto mt-6 max-w-2xl space-y-4">
        <p className="text-sm text-stone-400">Six agents vont juger ton idée devant toi.</p>
        <h1 className="text-3xl font-extrabold text-white">Quelle est ton idée de business ?</h1>
        <label className="block">
          <span className="sr-only">Ton idée</span>
          <textarea
            value={idee}
            onChange={(e) => setIdee(e.target.value)}
            rows={3}
            maxLength={500}
            required
            placeholder="Qui paie, combien, pour quoi : Nom, ce qu'il vend, à qui, à quel prix, dans quelle ville"
            className="w-full rounded-xl border border-amber-900/50 bg-white/5 px-4 py-3 text-stone-100 backdrop-blur placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Idées d'exemple">
          {EXEMPLES.map((x) => (
            <button key={x} type="button" onClick={() => setIdee(x)} className="rounded-full border border-amber-900/60 px-3 py-1 text-left text-xs text-amber-100 hover:bg-amber-500/10">
              {x.split(",")[0]} : {x.split(",").slice(1, 2).join("").trim()}
            </button>
          ))}
        </div>
        {erreur ? (
          <p role="alert" className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {erreur}
          </p>
        ) : null}
        <button type="submit" disabled={envoi || idee.trim() === ""} className="rounded-xl bg-amber-500 px-6 py-3 text-lg font-bold text-black disabled:opacity-50">
          {envoi ? "Ouverture de l'audience…" : "Juger mon idée"}
        </button>
      </form>
    </main>
  );
}
