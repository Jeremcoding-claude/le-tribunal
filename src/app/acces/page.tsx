"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Saisie du mot de passe d'accès (mode réel seulement). Le jeton part dans un cookie HttpOnly : il n'est jamais lisible par le script.
export default function PageAcces() {
  const router = useRouter();
  const [jeton, setJeton] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(ev: React.FormEvent) {
    ev.preventDefault();
    setErreur(null);
    const r = await fetch("/api/acces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jeton }) });
    if (r.ok) router.push("/");
    else setErreur(((await r.json()) as { erreur?: string }).erreur ?? "Accès refusé.");
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-extrabold text-white">Accès protégé</h1>
      <p className="mt-2 text-sm text-stone-400">Ce serveur lance de vrais procès, payants. Saisissez le mot de passe d&apos;accès défini par la personne qui l&apos;héberge.</p>
      <form onSubmit={envoyer} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-sm text-stone-300">Mot de passe d&apos;accès</span>
          <input type="password" autoComplete="current-password" value={jeton} onChange={(e) => setJeton(e.target.value)} required className="mt-1 w-full rounded-md border border-amber-900/40 bg-black/30 px-3 py-2 text-white" />
        </label>
        {erreur ? <p role="alert" className="text-sm text-red-300">{erreur}</p> : null}
        <button type="submit" className="rounded-md bg-amber-500 px-5 py-2 font-semibold text-black">Entrer</button>
      </form>
    </main>
  );
}
