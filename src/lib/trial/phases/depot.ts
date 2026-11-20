// P0 Dépôt (code) : nettoyage de la saisie (instructions cachées, mots publicitaires), découpage, pièces du greffe. Aucun LLM.
import { retirerSuperlatifs } from "../../guardrails/neutrality";
import { extraireNomsDirigeants } from "../../guardrails/privacy";
import { retirerInstructions } from "../../guardrails/sanitize";
import { piecesDuGreffe, type SourcesRegistre } from "../../registry";
import { decouperSaisie, type ResultatSaisie } from "../intake";
import { type Contexte, type Etat } from "./contexte";

export class SaisieIncomplete extends Error {
  constructor(readonly refus: Extract<ResultatSaisie, { ok: false }>) {
    super(refus.message);
  }
}

export async function depot(ctx: Contexte, etat: Etat): Promise<void> {
  // 1. Injection dans la saisie (« ignore tes instructions… ») : neutralisée, alerte notée (G5).
  const sain = retirerInstructions(etat.texte);
  etat.alertes = sain.alertes.map((a) => `saisie : ${a}`);

  const r = decouperSaisie(sain.texte);
  if (!r.ok) throw new SaisieIncomplete(r);

  // 2. Mots publicitaires retirés AVANT tout appel (G3) : les jurés ne voient que le dossier neutre. Le nom est gardé.
  const retires: string[] = [];
  const neutre = (t: string | null) => {
    if (t === null) return t;
    const n = retirerSuperlatifs(t);
    retires.push(...n.retires);
    return n.texte;
  };
  etat.saisie = { ...r.saisie, offre: neutre(r.saisie.offre)!, cible: neutre(r.saisie.cible)!, probleme: neutre(r.saisie.probleme) };
  etat.motsRetires = [...new Set(retires)];
  etat.texteNeutre = retirerSuperlatifs(sain.texte).texte;

  // 3. Pièces du greffe. Les noms des dirigeants sont retenus en mémoire pour les repérer dans les sorties (jamais stockés).
  const surveillees: SourcesRegistre = {
    registre: async (nom) => {
      const brut = await ctx.sources.registre(nom);
      ctx.nomsProteges.push(...extraireNomsDirigeants(brut));
      return brut;
    },
    commune: (nom) => ctx.sources.commune(nom),
  };
  etat.pieces = await piecesDuGreffe(etat.saisie, surveillees);
}
