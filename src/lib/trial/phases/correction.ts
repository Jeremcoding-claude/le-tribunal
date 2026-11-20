// P4 Correction : les enveloppes du vote 1 s'ouvrent (événement vote1_ouvert) ; Nadia répond aux 3 premières objections
// et corrige le plan (3 changements au plus, chacun venu d'une proposition du tour 2 ou de « juge »). Aucun chiffre nouveau.

import { AGENTS_JURES, Ruling, type AgentJure } from "../../schemas";
import { classerObjections } from "../objections";
import { statsVote } from "../tally";
import { verifierChangementsRuling, verifierNombresRuling } from "../verifier";
import { appeler, avecUneRelance, ProcesError, valider, ValidationError, type Contexte, type Etat } from "./contexte";
import { fiche } from "./debat";

export function propositionsDuTour2(etat: Etat) {
  return (etat.debat ?? []).filter((t) => t.tour === 2 && t.proposition).map((t) => ({ auteur: t.agent, ...t.proposition! }));
}

export async function correction(ctx: Contexte, etat: Etat): Promise<void> {
  const votes = etat.votes1 ?? {};
  const presents = AGENTS_JURES.filter((a): a is AgentJure => !!votes[a]);
  const stats = statsVote(presents.map((a) => votes[a]!));
  await ctx.emit({ type: "vote1_ouvert", notes: presents.map((a) => ({ agent: a, note: votes[a]!.note, verdict: votes[a]!.verdict })), moyenne: stats.moyenne ?? 0, ecart_type: stats.ecartType ?? 0 });

  const dossiers = presents.map((a) => etat.dossiers![a]!.brief);
  const objections = classerObjections({
    dossiers: dossiers.map((b) => ({ agent: b.agent, arguments: b.arguments, ...("objections" in b && { objections: b.objections }) })),
    debats: etat.debat ?? [],
    votes1: votes,
  });
  const aRepondre = objections.slice(0, 3).map((o) => o.id);
  const propositions = propositionsDuTour2(etat);

  const valeurs = [
    ...dossiers.flatMap((b) => b.affirmations.map((a) => a.valeur).filter((v): v is number => v !== null)),
    ...(etat.ledger ?? []).map((l) => l.valeur).filter((v): v is number => v !== null),
  ];

  etat.ruling = await avecUneRelance(async () => {
    const r = await appeler(ctx, {
      agent: "juge",
      phase: "CORRECTION",
      prenomCliente: etat.prenomCliente,
      pays: etat.saisie!.pays,
      donnees: {
        case_file: etat.miseEnEtat!.case_file,
        dossiers: presents.map((a) => ({ ...fiche(a, etat.dossiers![a]!.brief), risques: "risques" in etat.dossiers![a]!.brief ? (etat.dossiers![a]!.brief as { risques?: unknown }).risques : undefined })),
        debat: (etat.debat ?? []).map((t) => ({ agent: t.agent, tour: t.tour, repliques: t.repliques })),
        propositions_tour_2: propositions,
        stats_vote_1: { moyenne: stats.moyenne, ecart_type: stats.ecartType, repartition: stats.repartition },
        comptes: etat.ledger ?? [],
        objections_classees: objections.map((o) => ({ id: o.id, auteur: o.auteur, texte: o.texte, score: o.score })),
      },
    });
    const ruling = valider(Ruling, r.sortie, "Juge (Ruling)");
    const nombres = verifierNombresRuling(ruling, valeurs);
    if (nombres.length) throw new ValidationError(`Juge : ${nombres.map((n) => `${n.id} ${n.raison}`).join(" ; ")}`);
    const chg = verifierChangementsRuling(ruling, etat.miseEnEtat!.case_file, new Set(propositions.map((p) => p.id)));
    if (chg.length) throw new ValidationError(`Juge : ${chg.map((c) => `${c.id} ${c.raison}`).join(" ; ")}`);
    const repondues = new Set(ruling.reponses_objections.map((o) => o.objection));
    const manque = aRepondre.filter((id) => !repondues.has(id));
    if (manque.length) throw new ValidationError(`Juge : objection(s) sans réponse : ${manque.join(", ")}`);
    return ruling;
  }).catch((e) => {
    if (e instanceof ValidationError) throw new ProcesError(`Correction impossible : ${e.message}`);
    throw e;
  });
  await ctx.emit({ type: "ruling", ruling: etat.ruling });
}
