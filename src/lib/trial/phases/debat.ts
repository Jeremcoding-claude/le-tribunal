// P3 Débat en 2 tours. Le vote 1 est SCELLÉ : aucun prompt de débat ne contient une note ni un verdict (G2).
// Tour 1 : réponse aux arguments VÉRIFIÉS des autres (fiches résumées construites par le code, §10.3).
// Tour 2 : réponse aux répliques qui visent le juré, plus au plus UNE proposition d'amélioration (G11).

import { DebateTurn, CODES_AGENT, AGENTS_JURES, type AgentJure, type JurorBrief } from "../../schemas";
import { schemaSortie } from "../../../../prompts/agents.config";
import { nombresSansAppui, verifierDossierApi, verifierProposition, type DossierVerifiable } from "../verifier";
import { appeler, avecUneRelance, valider, ValidationError, type Contexte, type Etat } from "./contexte";

type Affirmation = JurorBrief["affirmations"][number];

/** La fiche résumée d'un juré : affirmations vérifiées et arguments. JAMAIS son vote, sa note ni sa réplique. */
export function fiche(agent: AgentJure, brief: JurorBrief) {
  return {
    agent,
    affirmations: brief.affirmations.map((a) => ({ id: a.id, texte: a.texte, valeur: a.valeur, unite: a.unite, type: a.type, source_url: a.source_url })),
    arguments: brief.arguments.map((a) => ({ id: a.id, sens: a.sens, these: a.these, appuis: a.appuis })),
  };
}

export function donneesDebat(etat: Etat, agent: AgentJure, tour: 1 | 2) {
  const fiches = AGENTS_JURES.filter((a) => a !== agent && etat.dossiers?.[a]).map((a) => fiche(a, etat.dossiers![a]!.brief));
  const visant =
    tour === 2
      ? (etat.debat ?? [])
          .filter((t) => t.tour === 1)
          .flatMap((t) => t.repliques.filter((r) => r.vise.startsWith(`${CODES_AGENT[agent]}-`)).map((r) => ({ auteur: t.agent, type: r.type, vise: r.vise, texte: r.texte, appuis: r.appuis })))
      : undefined;
  return { case_file: etat.miseEnEtat!.case_file, tour, fiches, ...(visant && { repliques_visant_ce_jure: visant }) };
}

/** Tous les nombres connus par id : affirmations vérifiées de tous les dossiers. */
export function valeursParId(etat: Etat): Map<string, number | null> {
  const m = new Map<string, number | null>();
  for (const d of Object.values(etat.dossiers ?? {})) for (const a of d!.brief.affirmations as Affirmation[]) m.set(a.id, a.valeur);
  return m;
}

async function tourDe(ctx: Contexte, etat: Etat, agent: AgentJure, tour: 1 | 2, connus: Map<string, number | null>): Promise<DebateTurn> {
  return avecUneRelance(async () => {
    const r = await appeler(ctx, { agent, phase: "DEBAT", tour, donnees: donneesDebat(etat, agent, tour), prenomCliente: etat.prenomCliente, pays: etat.saisie!.pays });
    const t = valider(schemaSortie(agent, "DEBAT", "plugin") as never, r.sortie, `${agent}, tour ${tour}`) as DebateTurn;
    if (t.agent !== agent || t.tour !== tour) throw new ValidationError(`${agent} : réponse d'un autre juré ou d'un autre tour`);

    // Nouvelles affirmations : vérifiées comme celles de l'instruction.
    const local = new Map(connus);
    if (t.nouvelles_affirmations.length) {
      const v = await verifierDossierApi({ agent, affirmations: t.nouvelles_affirmations } as DossierVerifiable, r.evidence, etat.saisie!.pays);
      if (v.rejetees.length) throw new ValidationError(`${agent} : nouvelle(s) affirmation(s) rejetée(s) : ${v.rejetees.map((x) => `${x.id} ${x.raison}`).join(" ; ")}`);
      for (const a of t.nouvelles_affirmations) local.set(a.id, a.valeur);
    }
    for (const rep of t.repliques) {
      const inconnu = rep.appuis.find((x) => !local.has(x));
      if (inconnu) throw new ValidationError(`${agent} : appui ${inconnu} inconnu ou rejeté`);
      const intrus = nombresSansAppui(rep.texte, rep.appuis.map((x) => local.get(x)).filter((v): v is number => v !== null && v !== undefined));
      if (intrus.length) throw new ValidationError(`${agent} : nombre(s) sans appui dans une réplique : ${intrus.join(", ")}`);
    }
    // Proposition : un appui vérifié, aucun nombre inventé. Sinon elle est rejetée (le tour reste valable).
    if (t.proposition) {
      const rejets = verifierProposition(t.proposition, local);
      if (rejets.length) {
        await ctx.emit({ type: "error", code: "proposition rejetée", message: `${t.proposition.id} : ${rejets[0].raison}`, phase: "P3" });
        return { ...t, proposition: null };
      }
    }
    return t;
  });
}

export async function debat(ctx: Contexte, etat: Etat, tour: 1 | 2): Promise<void> {
  const connus = valeursParId(etat);
  const presents = AGENTS_JURES.filter((a) => etat.dossiers?.[a]);
  const res = await Promise.allSettled(presents.map((a) => ctx.limite(() => tourDe(ctx, etat, a, tour, connus))));
  etat.debat ??= [];
  for (const [i, r] of res.entries()) {
    if (r.status === "fulfilled") {
      etat.debat.push(r.value);
      await ctx.emit({ type: "debate_reply", tour: r.value });
    } else {
      if ((r.reason as { code?: string })?.code === "budget_depasse") throw r.reason;
      await ctx.emit({ type: "error", code: "juré muet", message: `${presents[i]}, tour ${tour} : ${(r.reason as Error).message}`, phase: "P3" });
    }
  }
}
