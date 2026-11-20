"use client";

// Pied de page : le MODE (démo ou réel), « Voir la démo » et « Mes audiences (N) ». Jamais la clé, son début ni un jeton.

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Pied() {
  const [mode, setMode] = useState<"demo" | "reel" | null>(null);
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    void fetch("/api/mode").then((r) => r.json()).then((j: { mode: "demo" | "reel" }) => setMode(j.mode)).catch(() => {});
    void fetch("/api/trials").then((r) => r.json()).then((j: { audiences: unknown[] }) => setN(j.audiences.length)).catch(() => {});
  }, []);
  return (
    <footer className="mt-auto border-t border-amber-900/30 px-4 py-4 text-sm text-stone-400">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <span>{mode === "reel" ? "Mode réel" : mode === "demo" ? "Mode démo (aucun appel payant)" : "…"}</span>
        <nav className="flex gap-5">
          <Link href="/demo" className="text-amber-300 underline">
            Voir la démo
          </Link>
          <Link href="/audiences" className="text-amber-300 underline">
            Mes audiences{n !== null ? ` (${n})` : ""}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
