// P5 Revote ×5 sur le plan corrigé. Changer d'avis exige de citer un changement ou un id ; la note et « a changé d'avis » restent cohérents.
// P6 Verdict : le code calcule (tally.ts), Nadia prononce un texte fixe (prononce.ts).

import { AGENTS_JURES, Revote, type AgentJure } from "../../schemas";
import { prononcer } from "../prononce";
import { tally } from "../tally";
import { appeler, avecUneRelance, suspendreSiEnAttente, valider, ValidationError, type Contexte, type Etat } from "./contexte";

async function revoteDe(ctx: Contexte, etat: Etat, agent: AgentJure): Promise<Revote> {
  const ruling = etat.ruling!;
  const vote1 = etat.votes1![agent]!;
  const idsConnus = new Set<string>([
    ...Object.values(etat.dossiers ?? {}).flatMap((d) => d!.brief.affirmations.map((a) => a.id)),
    ...(etat.ledger ?? []).map((l) => `CPT-${l.ligne}`),
    ...ruling.contradictions.map((c) => c.id),
    ...ruling.reponses_objections.map((o) => o.objection),
    ...Object.values(etat.dossiers ?? {}).flatMap((d) => d!.brief.arguments.map((a) => a.id)),
    ...Object.values(etat.dossiers ?? {}).flatMap((d) => ("objections" in d!.brief ? d!.brief.objections.map((o) => o.id) : [])),
  ]);
  const champs = new Set(ruling.plan_corrige.changements.map((c) => c.champ));
  return avecUneRelance(async () => {
    const r = await appeler(ctx, {
      agent,
      phase: "REVOTE",
      prenomCliente: etat.prenomCliente,
      pays: etat.saisie!.pays,
      donnees: {
        case_file_v2: ruling.plan_corrige.case_file_v2,
        changements: ruling.plan_corrige.changements,
        contradictions: ruling.contradictions,
        conditions_pour_lancer: ruling.conditions_pour_lancer,
        votre_vote_1: { note: vote1.note, verdict: vote1.verdict, raison_principale: vote1.raison_principale },
      },
    });
    const rv = valider(Revote, r.sortie, `${agent} (revote)`);
    if (rv.agent !== agent) throw new ValidationError(`${agent} : revote d'un autre juré`);
    if (rv.vote.note !== vote1.note && !rv.a_change_d_avis) throw new ValidationError(`${agent} : la note change (${vote1.note} → ${rv.vote.note}) sans « a_change_d_avis »`);
    const inconnu = rv.vote.appuis.find((x) => !idsConnus.has(x));
    if (inconnu) throw new ValidationError(`${agent} : appui ${inconnu} inconnu`);
    for (const c of rv.cite) {
      if (c.startsWith("changement:") ? !champs.has(c.slice(11) as never) : !idsConnus.has(c)) throw new ValidationError(`${agent} : « ${c} » ne désigne ni un changement du plan ni un id connu`);
    }
    return rv;
  });
}

export async function revote(ctx: Contexte, etat: Etat): Promise<void> {
  const presents = AGENTS_JURES.filter((a) => etat.votes1?.[a]);
  const res = await Promise.allSettled(presents.map((a) => ctx.limite(() => revoteDe(ctx, etat, a))));
  suspendreSiEnAttente(res);
  etat.votes2 = {};
  for (const [i, r] of res.entries()) {
    if (r.status === "fulfilled") {
      etat.votes2[presents[i]] = r.value;
      await ctx.emit({ type: "revote", agent: presents[i] });
    } else {
      if ((r.reason as { code?: string })?.code === "budget_depasse") throw r.reason;
      await ctx.emit({ type: "agent_status", agent: presents[i], statut: "absent" });
      await ctx.emit({ type: "error", code: "revote absent", message: `${presents[i]} : ${(r.reason as Error).message}`, phase: "P5" });
    }
  }
  const votes = AGENTS_JURES.filter((a) => etat.votes2![a]);
  const notes = votes.map((a) => ({ note: etat.votes2![a]!.vote.note, verdict: etat.votes2![a]!.vote.verdict }));
  const moyenne = notes.length ? notes.reduce((s, n) => s + n.note, 0) / notes.length : 0;
  const sd = notes.length ? Math.sqrt(notes.reduce((s, n) => s + (n.note - moyenne) ** 2, 0) / notes.length) : 0;
  if (votes.length) {
    await ctx.emit({ type: "revote_ouvert", notes: votes.map((a) => ({ agent: a, ...{ note: etat.votes2![a]!.vote.note, verdict: etat.votes2![a]!.vote.verdict } })), moyenne: Math.round(moyenne * 10) / 10, ecart_type: Math.round(sd * 100) / 100 });
  }
}

export async function verdict(ctx: Contexte, etat: Etat): Promise<void> {
  const v1 = AGENTS_JURES.filter((a) => etat.votes1?.[a]).map((a) => etat.votes1![a]!);
  const v2 = AGENTS_JURES.filter((a) => etat.votes2?.[a]).map((a) => etat.votes2![a]!.vote);
  const t = tally(v1, v2);
  const texte = prononcer(t);
  etat.resultat = { ...t, texte };
  await ctx.emit({
    type: "verdict",
    note_avant: t.noteAvant,
    note_apres: t.noteApres,
    verdict: t.verdictJury,
    repartition: t.repartition,
    divergence: t.divergence,
    jury_divise: t.juryDivise,
    consensus_suspect: t.consensusSuspect,
    phrase: t.phrase,
    texte_nadia: texte,
  });
}
