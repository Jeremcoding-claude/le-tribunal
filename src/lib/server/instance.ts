// Le service unique du processus (base SQLite, client MOCK par défaut). Conservé sur globalThis : le rechargement à chaud de
// Next.js ne doit pas ouvrir deux fois la base ni perdre les procès en cours.

import { join } from "node:path";
import { dossierDonnees, GUARDRAILS } from "../guardrails/config";
import { creerClientReel } from "../llm/client";
import { creerClientMock } from "../llm/mock";
import { creerSourcesMock, creerSourcesReelles } from "../registry";
import { creerStoreSqlite, ouvrirBase } from "../store/sqlite";
import { creerService, type Service } from "./service";

const cle = Symbol.for("tribunal.service");
type Global = typeof globalThis & { [cle]?: Service };

export function obtenirService(): Service {
  const g = globalThis as Global;
  if (!g[cle]) {
    const stockage = creerStoreSqlite(ouvrirBase(join(dossierDonnees(), "tribunal.db")));
    // MOCK_MODE=true par défaut : aucun appel payant. Le mode réel (clé et jeton d'accès exigés) est durci à l'étape 12.
    g[cle] = creerService(
      GUARDRAILS.mock
        ? { stockage, client: creerClientMock(), sources: creerSourcesMock() }
        : { stockage, client: creerClientReel(), sources: creerSourcesReelles() },
    );
  }
  return g[cle]!;
}
