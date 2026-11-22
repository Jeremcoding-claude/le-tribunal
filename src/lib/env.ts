// SEUL endroit du projet qui lit process.env (plan v3.0, §11.3). Validation Zod : une valeur douteuse ARRÊTE le démarrage.
// Les messages d'erreur ne citent que le NOM de la variable, jamais sa valeur : une clé ne sort ni dans une erreur ni dans un résumé.

import { z } from "zod";

export class ErreurEnv extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurEnv";
  }
}

const vide = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const Schema = z.object({
  MOCK_MODE: z.preprocess(vide, z.enum(["true", "false"], { error: "MOCK_MODE : seules les valeurs « true » et « false » sont acceptées" }).default("true")),
  ANTHROPIC_API_KEY: z.preprocess(vide, z.string().optional()),
  TRIBUNAL_ACCESS_TOKEN: z.preprocess(vide, z.string().optional()),
  PORT: z.preprocess(vide, z.coerce.number({ error: "PORT : un entier est attendu" }).int({ error: "PORT : un entier est attendu" }).min(1, { error: "PORT : entre 1 et 65535" }).max(65535, { error: "PORT : entre 1 et 65535" }).default(3000)),
  DATA_DIR: z.preprocess(vide, z.string().default("./data")),
});

export const JETON_MIN = 16;

export interface Env {
  mock: boolean;
  /** La clé n'est jamais exposée : seulement sa présence. Le SDK la lit lui-même dans l'environnement. */
  cleApiPresente: boolean;
  /** Mot de passe d'accès (mode réel). Vide en mode MOCK. Ne jamais l'afficher. */
  jetonAcces: string;
  port: number;
  dossierDonnees: string;
}

/** Valide l'environnement. `source` est injectable pour les tests. Lève ErreurEnv (sans jamais citer une valeur). */
export function lireEnv(source: Record<string, string | undefined> = process.env): Env {
  const r = Schema.safeParse({
    MOCK_MODE: source.MOCK_MODE,
    ANTHROPIC_API_KEY: source.ANTHROPIC_API_KEY,
    TRIBUNAL_ACCESS_TOKEN: source.TRIBUNAL_ACCESS_TOKEN,
    PORT: source.PORT,
    DATA_DIR: source.DATA_DIR,
  });
  if (!r.success) throw new ErreurEnv(`Configuration invalide : ${r.error.issues.map((i) => i.message).join(" ; ")}`);
  const e = r.data;
  const mock = e.MOCK_MODE === "true";
  if (!mock) {
    if (!e.ANTHROPIC_API_KEY) throw new ErreurEnv("Configuration invalide : MOCK_MODE=false exige ANTHROPIC_API_KEY");
    if (!e.TRIBUNAL_ACCESS_TOKEN) throw new ErreurEnv("Configuration invalide : MOCK_MODE=false exige TRIBUNAL_ACCESS_TOKEN (sinon toute personne qui atteint l'appli dépenserait votre clé)");
    if (e.TRIBUNAL_ACCESS_TOKEN.length < JETON_MIN) throw new ErreurEnv(`Configuration invalide : TRIBUNAL_ACCESS_TOKEN doit faire au moins ${JETON_MIN} caractères`);
  }
  return {
    mock,
    cleApiPresente: Boolean(e.ANTHROPIC_API_KEY),
    jetonAcces: mock ? "" : (e.TRIBUNAL_ACCESS_TOKEN ?? ""),
    port: e.PORT,
    dossierDonnees: e.DATA_DIR,
  };
}

let memo: Env | null = null;
/** L'environnement du processus, validé une fois. */
export function env(): Env {
  return (memo ??= lireEnv());
}
/** Pour les tests : oublie la valeur mémorisée. */
export function oublierEnv(): void {
  memo = null;
}

/** Résumé pour le journal de démarrage : jamais la clé ni le jeton. */
export function resumeEnv(e: Env): string {
  return `mode=${e.mock ? "MOCK" : "réel"} clé_api=${e.cleApiPresente ? "présente" : "absente"} jeton_accès=${e.jetonAcces ? "défini" : "non requis"} port=${e.port} données=${e.dossierDonnees}`;
}

