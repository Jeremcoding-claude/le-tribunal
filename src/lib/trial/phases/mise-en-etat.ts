// P1a Identification (Greffier-enquêteur), P1b Questions (code), P1c Mise en état (Greffier-rédacteur).
import { reverifierNeutralite } from "../../guardrails/neutrality";
import { lirePrix } from "../../guardrails/numbers";
import { donneesPersonnelles } from "../../guardrails/privacy";
import { EnqueteGreffier, MiseEnEtat, type Reponses, type Saisie } from "../../schemas";
import { questionsAPoser, interpreter } from "../questions";
import { appeler, avecUneRelance, valider, ValidationError, type Contexte, type Etat } from "./contexte";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** « La saisie confirmée n'ajoute rien » : chaque champ confirmé est un extrait de la saisie d'origine (G10). */
export function saisieEstExtrait(confirmee: Saisie, texte: string): string | null {
  const t = norm(texte);
  for (const [champ, valeur] of Object.entries(confirmee)) {
    if (champ === "pays" || valeur === null) continue;
    if (!t.includes(norm(String(valeur)))) return `${champ} « ${valeur} » n'est pas un extrait de la saisie`;
  }
  return null;
}

async function enqueter(ctx: Contexte, etat: Etat, retenue?: string): Promise<EnqueteGreffier> {
  return avecUneRelance(async () => {
    const complement = retenue !== undefined;
    const r = await appeler(ctx, {
      agent: "greffier-enquete",
      phase: complement ? "IDENTIFICATION_COMPLEMENT" : "IDENTIFICATION",
      donnees: { saisie: etat.saisie, pieces_du_greffe: etat.pieces, ...(complement && { correspondance_retenue: retenue }) },
      pays: etat.saisie!.pays,
    });
    const e = valider(EnqueteGreffier, r.sortie, "Greffier-enquêteur");
    const extrait = saisieEstExtrait(e.saisie_confirmee, etat.texteNeutre ?? etat.texte);
    if (extrait) throw new ValidationError(`Greffier-enquêteur : ${extrait}`);
    const pii = donneesPersonnelles(e, ctx.nomsProteges);
    if (pii) throw new ValidationError(`Greffier-enquêteur : ${pii} dans la sortie (G9)`);
    const nettes = etat.pieces!.correspondances.length;
    if (nettes >= 2 && e.identification.statut === "entreprise_existante") {
      throw new ValidationError("Greffier-enquêteur : plusieurs correspondances au registre, le statut doit être « homonymes » (jamais un choix au hasard)");
    }
    return e;
  });
}

/** P1a. */
export async function identification(ctx: Contexte, etat: Etat): Promise<void> {
  etat.enquete = await enqueter(ctx, etat);
  etat.identification = etat.enquete.identification;
  etat.alertes = [...(etat.alertes ?? []), ...etat.identification.alertes.map((a) => `identification : ${a}`)];
}

/** P1b : 0 à 2 questions à texte fixe. Sans réponse (ou « passer »), le procès continue. */
export async function questions(ctx: Contexte, etat: Etat): Promise<void> {
  const id = etat.identification!;
  const qs = questionsAPoser(etat.saisie!, id);
  etat.reponses = [];
  if (qs.length === 0) return;
  await ctx.emit({ type: "questions", questions: qs });

  let reponses: Reponses = ctx.repondre ? await ctx.repondre(qs) : qs.map((q) => ({ code: q.code, reponse: null }));
  let lecture = interpreter(qs, reponses);
  if (lecture.prixIllisible && ctx.repondre) {
    // Illisible : la question est reposée UNE fois.
    const reposee = qs.filter((q) => q.code === "prix_absent");
    const seconde = await ctx.repondre(reposee);
    reponses = [...reponses.filter((r) => r.code !== "prix_absent"), ...seconde];
    lecture = interpreter(qs, reponses);
  }
  etat.reponses = reponses;
  await ctx.emit({ type: "answers_received", reponses });

  if (lecture.homonyme === "projet") {
    etat.identification = { ...id, statut: "aucune_trace" }; // sans relance
  } else if (lecture.homonyme !== null) {
    const choisie = id.correspondances[lecture.homonyme];
    const retenu = await enqueter(ctx, etat, `${choisie.denomination} — ${choisie.activite_naf} — ${choisie.commune}`); // une seule relance
    etat.identification = { ...retenu.identification, statut: "entreprise_existante" };
  }
}

/** P1c : le dossier neutre et la Cliente. */
export async function miseEnEtat(ctx: Contexte, etat: Etat): Promise<void> {
  const prixReponse = (etat.reponses ?? []).find((r) => r.code === "prix_absent" && r.reponse !== null);
  etat.miseEnEtat = await avecUneRelance(async () => {
    const r = await appeler(ctx, {
      agent: "greffier-redaction",
      phase: "MISE_EN_ETAT",
      donnees: { saisie_confirmee: etat.enquete!.saisie_confirmee, identification: etat.identification, reponses: etat.reponses ?? [] },
      pays: etat.saisie!.pays,
    });
    const m = valider(MiseEnEtat, r.sortie, "Greffier-rédacteur");
    const cf = m.case_file;
    const texte = JSON.stringify([cf.cible, cf.probleme, cf.solution, cf.canal_presume, cf.differenciation, cf.hypotheses_implicites]);
    const mots = reverifierNeutralite(texte);
    if (mots.length) throw new ValidationError(`Greffier-rédacteur : mot publicitaire « ${mots[0]} » dans le dossier neutre`);
    // Le prix : celui de la saisie, sinon de la réponse, sinon null ; rien d'inventé.
    const lu = lirePrix(etat.saisie!.prix ?? prixReponse?.reponse ?? "");
    if (lu && cf.prix.montant !== lu.montant) throw new ValidationError(`Greffier-rédacteur : prix ${cf.prix.montant} ≠ prix donné ${lu.montant}`);
    if (!lu && cf.prix.montant !== null && etat.identification!.offre_publique.prix_affiche === null) throw new ValidationError("Greffier-rédacteur : prix inventé (aucun prix donné ni affiché)");
    return m;
  });
  // Les mots retirés avant l'appel sont listés par le code, pas par le LLM.
  etat.miseEnEtat.case_file.mots_retires = (etat.motsRetires ?? []).slice(0, 20);
  etat.prenomCliente = etat.miseEnEtat.persona_cliente.prenom.trim();
}
