// « Les tests ne touchent jamais le réseau » (CLAUDE.md). Tout appel à fetch qui n'est pas injecté échoue ici,
// avec un message clair : aucune fuite silencieuse vers une vraie API, même si un code oublie son adaptateur.
import { beforeEach } from "vitest";

beforeEach(() => {
  globalThis.fetch = (() => {
    throw new Error("Réseau interdit en test : injecte un faux fetch (fetchImpl) ou utilise le client MOCK.");
  }) as typeof fetch;
});
