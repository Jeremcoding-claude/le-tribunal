// P1b — les questions de mise en état (plan v3.0, §4.1). Le CODE, pas l'IA, décide s'il faut demander quelque chose.
// Deux questions existent, 2 au plus par procès, à TEXTE FIXE ; « passer » est toujours possible.

import { GUARDRAILS } from "../guardrails/config";
import { lirePrix, type PrixLu } from "../guardrails/numbers";
import type { Identification, Question, Reponses, Saisie } from "../schemas";

export const TEXTE_PRIX = "Quel est le prix, et sa fréquence ? (ex. 149 € par mois, 30 € par commande)";
export const TEXTE_HOMONYMES = "Plusieurs entreprises correspondent. Laquelle est la vôtre ?";
export const CHOIX_PROJET = "aucune, c'est un projet";

export type Repondre = (questions: Question[]) => Promise<Reponses>;

const libelleChoix = (c: Identification["correspondances"][number]) => `${c.denomination} — ${c.activite_naf} — ${c.commune}`;

/** Les questions à poser, dans l'ordre : prix absent, puis homonymes. Jamais un texte hors liste fixe. */
export function questionsAPoser(saisie: Saisie, identification: Identification): Question[] {
  const questions: Question[] = [];
  const prixAffiche = identification.offre_publique.prix_affiche !== null && identification.offre_publique.source_url !== null;
  if (saisie.prix === null && !prixAffiche) questions.push({ code: "prix_absent", texte: TEXTE_PRIX, choix: [] });
  if (identification.statut === "homonymes") {
    questions.push({ code: "homonymes", texte: TEXTE_HOMONYMES, choix: [...identification.correspondances.map(libelleChoix), CHOIX_PROJET] });
  }
  return questions.slice(0, GUARDRAILS.questions.max);
}

export interface Interpretation {
  prix: PrixLu | null;
  /** Une réponse de prix a été donnée mais illisible : la question est reposée UNE fois. */
  prixIllisible: boolean;
  /** Index de la correspondance retenue, « projet », ou null (passé). */
  homonyme: number | "projet" | null;
}

/** Lit les réponses : le prix par numbers.ts, l'homonyme parmi les choix proposés. */
export function interpreter(questions: Question[], reponses: Reponses): Interpretation {
  const r: Interpretation = { prix: null, prixIllisible: false, homonyme: null };
  for (const rep of reponses) {
    if (rep.reponse === null) continue;
    if (rep.code === "prix_absent") {
      r.prix = lirePrix(rep.reponse);
      r.prixIllisible = r.prix === null;
    } else {
      const choix = questions.find((q) => q.code === "homonymes")?.choix ?? [];
      const i = choix.indexOf(rep.reponse);
      if (rep.reponse === CHOIX_PROJET) r.homonyme = "projet";
      else if (i >= 0 && i < choix.length - 1) r.homonyme = i;
    }
  }
  return r;
}
