// Les routes /api sous forme de fonctions Request → Response (aucun import de Next.js) : les fichiers src/app/api/**/route.ts
// ne font que les appeler. Tout ce qui sort passe par masquerProfond / masquerCles (G8).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ZodError } from "zod";
import { GUARDRAILS } from "../guardrails/config";
import { masquerCles, masquerProfond } from "../guardrails/redact";
import type { TrialEvent } from "../schemas";
import type { Service } from "./service";

const ENTETES_JSON = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

export function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(masquerProfond(corps)), { status, headers: ENTETES_JSON });
}
const erreur = (status: number, message: string, extra: object = {}) => json({ erreur: masquerCles(message), ...extra }, status);

/** POST /api/trials : valide, crée, lance en arrière-plan, renvoie {id} sans attendre la fin. */
export async function postTrial(req: Request, s: Service): Promise<Response> {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return erreur(400, "Le corps de la requête n'est pas du JSON.");
  }
  try {
    const r = await s.creer(corps);
    if (!r.ok) return json({ erreur: r.refus.message, status: "saisie_incomplete", manque: r.refus.manque, format: r.refus.format, exemple: r.refus.exemple }, 422);
    return json({ id: r.id }, 201);
  } catch (e) {
    if (e instanceof ZodError) return erreur(400, e.issues[0]?.message ?? "Requête invalide.");
    return erreur(500, (e as Error).message);
  }
}

/** GET /api/trials : « Mes audiences ». */
export function getTrials(s: Service): Response {
  return json({ audiences: s.lister() });
}

/** DELETE /api/trials/:id : supprime un procès terminé (jamais un procès en cours). */
export function deleteTrial(id: string, s: Service): Response {
  const r = s.supprimer(id);
  if (r === "inconnu") return erreur(404, "Procès inconnu.");
  if (r === "en_cours") return erreur(409, "Le procès est en cours : impossible de le supprimer.");
  return new Response(null, { status: 204 });
}

/** GET /api/mode : « demo » (aucun appel payant) ou « reel ». Jamais la clé, son début, ni un jeton. */
export function getMode(): Response {
  return json({ mode: GUARDRAILS.mock ? "demo" : "reel" });
}

/** GET /api/demo : les événements enregistrés du cas de référence. Zéro appel payant, même en mode réel. */
export function getDemo(racine = process.cwd()): Response {
  try {
    return json({ evenements: JSON.parse(readFileSync(join(racine, "fixtures", "restaurants", "events.json"), "utf8")) });
  } catch {
    return erreur(404, "La démo n'est pas disponible sur ce serveur.");
  }
}

export async function getTrial(id: string, s: Service): Promise<Response> {
  const e = await s.etat(id);
  return e ? json(e) : erreur(404, "Procès inconnu.");
}

export async function postResume(id: string, s: Service): Promise<Response> {
  const r = await s.reprendre(id);
  if (r === "inconnu") return erreur(404, "Procès inconnu.");
  if (r === "deja_en_cours") return erreur(409, "Le procès est déjà en cours.");
  if (r === "termine") return erreur(409, "Le procès est terminé : rien à reprendre.");
  return json({ id, statut: "en_cours" }, 202);
}

export async function postAnswers(req: Request, id: string, s: Service): Promise<Response> {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return erreur(400, "Le corps de la requête n'est pas du JSON.");
  }
  const r = s.repondre(id, corps);
  return r.ok ? json({ id, statut: "reponses_recues" }) : erreur(r.code, r.message);
}

export async function getReport(id: string, s: Service): Promise<Response> {
  const r = await s.rapport(id);
  if (r === "inconnu") return erreur(404, "Procès inconnu.");
  if (r === "pas_termine") return erreur(409, "Le procès n'est pas terminé : pas encore de rapport.");
  return new Response(new Uint8Array(r), {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="rapport-${id}.pdf"`, "Cache-Control": "no-store" },
  });
}

// ───────────── SSE ─────────────

/** Le flux s'arrête sur « verdict » ou sur une erreur FINALE (les alertes comme « juré absent » ne l'arrêtent pas). */
export const estTerminal = (e: TrialEvent): boolean => e.type === "verdict" || (e.type === "error" && (e.code === "echec" || e.code === "budget_depasse"));

export const trame = (e: TrialEvent): string => `id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(masquerProfond(e))}\n\n`;

export interface OptionsFlux {
  /** Intervalle de relecture de la base. */
  pollMs?: number;
  /** Heartbeat : un commentaire SSE toutes les 15 s par défaut (garde la connexion ouverte derrière un proxy). */
  heartbeatMs?: number;
}

/**
 * GET /api/trials/:id/stream. Renvoie la Response TOUT DE SUITE ; le travail se fait dans le ReadableStream (sinon tout arrive à la
 * fin). Reprend après Last-Event-ID (ou ?lastEventId=). Se termine sur « verdict » ou une erreur finale.
 */
export function getStream(req: Request, id: string, s: Service, o: OptionsFlux = {}): Response {
  if (!s.trial(id)) return erreur(404, "Procès inconnu.");
  const pollMs = o.pollMs ?? 250;
  const heartbeatMs = o.heartbeatMs ?? 15_000;
  const url = new URL(req.url);
  const brut = req.headers.get("last-event-id") ?? url.searchParams.get("lastEventId") ?? "-1";
  let dernier = Number.isInteger(Number(brut)) ? Number(brut) : -1;
  const encodeur = new TextEncoder();
  let arret = false;

  const flux = new ReadableStream<Uint8Array>({
    start(c) {
      req.signal.addEventListener("abort", () => {
        arret = true;
      });
      void (async () => {
        let dernierEnvoi = Date.now();
        c.enqueue(encodeur.encode("retry: 2000\n\n"));
        try {
          while (!arret) {
            const evs = s.evenementsApres(id, dernier);
            for (const e of evs) {
              c.enqueue(encodeur.encode(trame(e)));
              dernier = e.seq;
              dernierEnvoi = Date.now();
              if (estTerminal(e)) return;
            }
            if (evs.length === 0) {
              const t = s.trial(id);
              // Procès fini (ou coupé) sans événement final à envoyer : on clôt plutôt que d'attendre pour toujours.
              if (!s.estActif(id) && t && t.statut !== "en_cours") {
                if (s.evenementsApres(id, dernier).length === 0) return;
              } else if (Date.now() - dernierEnvoi >= heartbeatMs) {
                c.enqueue(encodeur.encode(": heartbeat\n\n"));
                dernierEnvoi = Date.now();
              }
              await new Promise((r) => setTimeout(r, pollMs));
            }
          }
        } catch {
          /* le client a coupé : rien à faire */
        } finally {
          try {
            c.close();
          } catch {
            /* déjà fermé */
          }
        }
      })();
    },
    cancel() {
      arret = true;
    },
  });

  return new Response(flux, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
