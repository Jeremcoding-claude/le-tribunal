// « Les tests ne touchent jamais le réseau » (CLAUDE.md). Tout appel à fetch qui n'est pas injecté échoue ici,
// avec un message clair : aucune fuite silencieuse vers une vraie API, même si un code oublie son adaptateur.
// Exception : les adresses `data:` (le moteur de mise en page du PDF charge son code WebAssembly ainsi) : aucun réseau.
import { beforeEach } from "vitest";

const vraiFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = ((entree: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    if (url.startsWith("data:")) return vraiFetch(entree, init);
    throw new Error("Réseau interdit en test : injecte un faux fetch (fetchImpl) ou utilise le client MOCK.");
  }) as typeof fetch;
});
