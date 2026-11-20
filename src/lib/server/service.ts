// Le service du procès côté serveur (plan v3.0, étape 10) : crée un procès, le lance EN ARRIÈRE-PLAN avec runTrial, garde les
// réponses de P1b en attente, reprend un procès coupé, génère le rapport. Aucun import de Next.js : testable sans serveur.

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { masquerCles } from "../guardrails/redact";
import type { LlmClient } from "../llm/types";
import { genererPdf } from "../pdf/Report";
import type { SourcesRegistre } from "../registry";
import { Reponses, type Question } from "../schemas";
import type { StoreSqlite } from "../store/sqlite";
import { decouperSaisie, type ResultatSaisie } from "../trial/intake";
import type { Etat } from "../trial/phases/contexte";
import { runTrial, type OptionsProces, type StatutProces } from "../trial/run";

export const CreerTrial = z.object({
  idee: z.string().trim().min(1, "L'idée est vide.").max(500, "L'idée dépasse 500 caractères."),
  pays: z
    .string()
    .regex(/^[A-Z]{2}$/, "Le pays est un code à 2 lettres (FR, BE…).")
    .default("FR"),
});

export interface OptionsService {
  stockage: StoreSqlite;
  client: LlmClient;
  sources: SourcesRegistre;
  /** Options supplémentaires de runTrial (tests : arrêt après une phase, horloge…). */
  runOptions?: Partial<OptionsProces>;
}

const TERMINAUX = ["termine", "ajourne"];
const STATUT: Record<StatutProces, string> = {
  termine: "termine",
  ajourne: "ajourne",
  interrompu: "interrompu",
  echec: "echec",
  budget_depasse: "budget_depasse",
  saisie_incomplete: "echec",
  en_attente: "echec",
  questions: "echec",
};

/** Ajoute le pays à la ville quand la saisie ne le précise pas : « Bruxelles » + BE → « Bruxelles (BE) ». */
function avecPays(texte: string, pays: string): string {
  if (pays === "FR") return texte;
  const d = decouperSaisie(texte);
  if (!d.ok || d.saisie.pays !== "FR") return texte;
  const i = texte.lastIndexOf(d.saisie.ville);
  return i < 0 ? texte : `${texte.slice(0, i)}${d.saisie.ville} (${pays})${texte.slice(i + d.saisie.ville.length)}`;
}

export type ResultatCreation = { ok: true; id: string } | { ok: false; refus: Extract<ResultatSaisie, { ok: false }> };

export function creerService(o: OptionsService) {
  const actifs = new Map<string, Promise<void>>();
  const attentes = new Map<string, { questions: Question[]; resolve: (r: Reponses) => void }>();
  const { stockage } = o;

  // Au démarrage, un procès « en cours » sans exécution est un procès coupé : il peut être repris.
  for (const t of stockage.listerTrials()) if (t.statut === "en_cours") stockage.majStatut(t.id, "interrompu", "Le serveur a redémarré pendant le procès.");

  function lancer(id: string, texte: string, reprendre: boolean): void {
    stockage.majStatut(id, "en_cours");
    const p = runTrial(texte, {
      client: o.client,
      sources: o.sources,
      store: stockage.store,
      id,
      reprendre,
      repondre: (qs) => new Promise<Reponses>((resolve) => attentes.set(id, { questions: qs, resolve })),
      ...o.runOptions,
    })
      .then((r) => stockage.majStatut(id, STATUT[r.statut], r.message))
      .catch((e: unknown) => stockage.majStatut(id, "echec", masquerCles((e as Error).message)))
      .finally(() => {
        actifs.delete(id);
        attentes.delete(id);
      });
    actifs.set(id, p);
  }

  return {
    /** Valide, crée le procès et le lance en arrière-plan. Renvoie tout de suite. */
    async creer(corps: unknown): Promise<ResultatCreation> {
      const c = CreerTrial.parse(corps);
      const texte = avecPays(c.idee, c.pays);
      const d = decouperSaisie(texte);
      if (!d.ok) return { ok: false, refus: d };
      const id = `t-${randomBytes(6).toString("hex")}`;
      stockage.creerTrial(id, texte, d.saisie.pays);
      lancer(id, texte, false);
      return { ok: true, id };
    },

    /** Ce que le client a le droit de voir : jamais l'état brut (le vote 1 est scellé jusqu'à son ouverture, G14). */
    async etat(id: string) {
      const t = stockage.trial(id);
      if (!t) return null;
      const dernier = await stockage.store.dernierEtat(id);
      const etat = dernier?.etat as Etat | undefined;
      const r = etat?.resultat;
      return {
        id,
        statut: t.statut,
        message: t.message,
        phase: dernier?.phase ?? "DEBUT",
        enCours: actifs.has(id),
        questions: attentes.get(id)?.questions ?? null,
        coutUsd: etat?.coutUsd ?? 0,
        resultat: r ? { verdict: r.verdictJury, phrase: r.phrase, noteAvant: r.noteAvant, noteApres: r.noteApres, texte: r.texte } : null,
      };
    },

    async reprendre(id: string): Promise<"ok" | "inconnu" | "deja_en_cours" | "termine"> {
      const t = stockage.trial(id);
      if (!t) return "inconnu";
      if (actifs.has(id)) return "deja_en_cours";
      if (TERMINAUX.includes(t.statut)) return "termine";
      const dernier = await stockage.store.dernierEtat(id);
      lancer(id, t.texte, dernier !== null);
      return "ok";
    },

    /** Réponses de P1b : validées par Zod, et seulement pour des questions réellement posées. */
    repondre(id: string, corps: unknown): { ok: true } | { ok: false; code: 404 | 409 | 400; message: string } {
      if (!stockage.trial(id)) return { ok: false, code: 404, message: "Procès inconnu." };
      const attente = attentes.get(id);
      if (!attente) return { ok: false, code: 409, message: "Aucune question n'attend de réponse." };
      const brut = corps && typeof corps === "object" && "reponses" in corps ? (corps as { reponses: unknown }).reponses : corps;
      const liste = Array.isArray(brut) ? brut : brut && typeof brut === "object" ? Object.entries(brut).map(([code, reponse]) => ({ code, reponse })) : null;
      const p = Reponses.safeParse(liste);
      if (!p.success) return { ok: false, code: 400, message: `Réponses invalides : ${p.error.issues[0]?.message ?? "format"}` };
      const inconnu = p.data.find((r) => !attente.questions.some((q) => q.code === r.code));
      if (inconnu) return { ok: false, code: 400, message: `Réponse à une question qui n'a pas été posée : ${inconnu.code}.` };
      const complete = attente.questions.map((q) => p.data.find((r) => r.code === q.code) ?? { code: q.code, reponse: null });
      attentes.delete(id);
      attente.resolve(complete);
      return { ok: true };
    },

    async rapport(id: string): Promise<Buffer | "inconnu" | "pas_termine"> {
      if (!stockage.trial(id)) return "inconnu";
      const cache = stockage.artefact(id, "rapport.pdf");
      if (cache) return Buffer.from(cache, "base64");
      const etat = (await stockage.store.dernierEtat(id))?.etat as Etat | undefined;
      if (!etat?.resultat) return "pas_termine";
      const pdf = await genererPdf(etat, { date: new Date().toISOString().slice(0, 10) });
      stockage.ecrireArtefact(id, "rapport.pdf", pdf.toString("base64"));
      return pdf;
    },

    /** « Mes audiences » : les procès enregistrés sur CE serveur (pas de comptes : une instance = une liste). */
    lister() {
      return stockage.listerTrials().map((t) => ({ id: t.id, idee: t.texte, statut: t.statut, creeLe: t.creeLe, enCours: actifs.has(t.id) }));
    },
    evenementsApres: (id: string, seq: number) => stockage.evenementsApres(id, seq),
    trial: (id: string) => stockage.trial(id),
    estActif: (id: string) => actifs.has(id),
    /** Pour les tests : attend la fin de l'exécution en arrière-plan. */
    attendre: (id: string) => actifs.get(id) ?? Promise.resolve(),
    supprimer(id: string): "ok" | "inconnu" | "en_cours" {
      if (!stockage.trial(id)) return "inconnu";
      if (actifs.has(id)) return "en_cours";
      stockage.supprimerTrial(id);
      return "ok";
    },
  };
}

export type Service = ReturnType<typeof creerService>;
