// Jeton d'accès (plan §11.3) : en mode réel, toute route /api/trials* exige le mot de passe TRIBUNAL_ACCESS_TOKEN, sinon n'importe
// qui atteignant le serveur dépenserait la clé. En MOCK, aucun jeton. Le jeton n'est jamais renvoyé ni journalisé.

import { timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { json } from "./handlers";

export const COOKIE_ACCES = "tribunal_token";

const egal = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function jetonDe(req: Request): string {
  const entete = req.headers.get("x-tribunal-token");
  if (entete) return entete;
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE_ACCES}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/** null = accès permis ; sinon la réponse 401 à renvoyer. */
export function refuserSansJeton(req: Request, attendu = env().jetonAcces): Response | null {
  if (!attendu) return null; // MOCK : pas de jeton
  return egal(jetonDe(req), attendu) ? null : json({ erreur: "Accès protégé : saisissez le mot de passe d'accès.", acces: "jeton" }, 401);
}

/** POST /api/acces : vérifie le jeton saisi et le dépose dans un cookie HttpOnly. */
export async function postAcces(req: Request, attendu = env().jetonAcces): Promise<Response> {
  if (!attendu) return json({ ok: true, requis: false });
  let saisi = "";
  try {
    saisi = String(((await req.json()) as { jeton?: unknown }).jeton ?? "");
  } catch {
    return json({ erreur: "Le corps de la requête n'est pas du JSON." }, 400);
  }
  if (!egal(saisi, attendu)) return json({ erreur: "Mot de passe incorrect." }, 401);
  const r = json({ ok: true, requis: true });
  r.headers.append("Set-Cookie", `${COOKIE_ACCES}=${encodeURIComponent(saisi)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`);
  return r;
}

/** GET /api/health : { ok: true } si la base répond. Ni clé, ni jeton, ni chemin. */
export function getHealth(base: () => unknown): Response {
  try {
    base();
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 503);
  }
}

/** Enveloppe une route : refuse sans jeton (mode réel), sinon la laisse passer. */
export function protege<A extends unknown[]>(h: (req: Request, ...a: A) => Response | Promise<Response>) {
  return (req: Request, ...a: A): Response | Promise<Response> => refuserSansJeton(req) ?? h(req, ...a);
}
