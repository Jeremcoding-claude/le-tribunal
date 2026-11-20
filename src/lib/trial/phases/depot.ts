// P0 Dépôt (code) : découpage de la saisie + pièces du greffe (registre, commune). Aucun LLM.
import { piecesDuGreffe } from "../../registry";
import { decouperSaisie, type ResultatSaisie } from "../intake";
import { type Contexte, type Etat } from "./contexte";

export class SaisieIncomplete extends Error {
  constructor(readonly refus: Extract<ResultatSaisie, { ok: false }>) {
    super(refus.message);
  }
}

export async function depot(ctx: Contexte, etat: Etat): Promise<void> {
  const r = decouperSaisie(etat.texte);
  if (!r.ok) throw new SaisieIncomplete(r);
  etat.saisie = r.saisie;
  etat.pieces = await piecesDuGreffe(r.saisie, ctx.sources);
}
