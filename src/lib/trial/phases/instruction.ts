// P2 Instruction ×5 en parallèle : chaque juré cherche, le code vérifie chaque chiffre, puis le vote 1 est SCELLÉ.
// Le Comptable fait deux appels : hypothèses (parallèle) → ledger.ts calcule → lecture du tableau + vote.

import { detecterArgumentsRecopies } from "../../guardrails/consensus";
import { GUARDRAILS } from "../../guardrails/config";
import {
  AGENTS_JURES,
  BriefComptable,
  ComptableInstruction,
  ComptableLecture,
  type AgentJure,
  type JurorBrief,
} from "../../schemas";
import { schemaSortie } from "../../../../prompts/agents.config";
import type { ToolEvidence } from "../../llm/types";
import { calculerLedger, entreesDepuisHypotheses, type Hypothese } from "../ledger";
import { verifierDossierApi, verifierLecture, verifierNombresLibres, type DossierVerifiable, type ResultatVerification } from "../verifier";
import { appeler, avecUneRelance, valider, ValidationError, agentJure, type Contexte, type DossierJure, type Etat } from "./contexte";

interface Verifie<T> {
  brut: T;
  v: ResultatVerification;
}

async function donneesJure(etat: Etat, agent: AgentJure) {
  const m = etat.miseEnEtat!;
  return {
    case_file: m.case_file,
    identification: etat.identification,
    ...(agent === "cliente" && { persona_cliente: m.persona_cliente }),
    ...(agent === "juriste" && { domaines_officiels: GUARDRAILS.search.juristeDomains[etat.saisie!.pays as "FR"] ?? [] }),
  };
}

/** Émet source_verified / source_rejected pour chaque fait. */
async function signaler(ctx: Contexte, agent: AgentJure, brief: DossierVerifiable, v: ResultatVerification) {
  for (const a of brief.affirmations.filter((x) => x.type === "fait")) {
    const rejet = v.rejetees.find((r) => r.id === a.id);
    if (rejet) await ctx.emit({ type: "source_rejected", agent, id: a.id, raison: rejet.raison });
    else await ctx.emit({ type: "source_verified", agent, id: a.id, domaine: new URL(a.source_url!).hostname });
  }
}

/** Retire ce que le vérificateur a rejeté (affirmations, arguments, appuis) : l'agent ne garde que des preuves. */
function assainir<T extends { affirmations: { id: string }[]; arguments?: { id: string; appuis: string[] }[]; vote?: { appuis: string[] } }>(d: T, v: ResultatVerification, appuisExtra: string[] = []): T {
  const ok = new Set([...v.acceptees, ...appuisExtra]);
  const invalides = new Set(v.argumentsInvalides.map((a) => a.id));
  return {
    ...d,
    affirmations: d.affirmations.filter((a) => v.acceptees.includes(a.id)),
    ...(d.arguments && { arguments: d.arguments.filter((a) => !invalides.has(a.id)) }),
    ...(d.vote && { vote: { ...d.vote, appuis: d.vote.appuis.filter((x) => ok.has(x)) } }),
  };
}

async function jureStandard(ctx: Contexte, etat: Etat, agent: Exclude<AgentJure, "comptable">): Promise<DossierJure> {
  return avecUneRelance(async () => {
    const r = await appeler(ctx, { agent, phase: "INSTRUCTION", donnees: await donneesJure(etat, agent), prenomCliente: etat.prenomCliente, pays: etat.saisie!.pays });
    const brut = r.sortie as JurorBrief;
    if (r.citationsInconnues.length) await ctx.emit({ type: "source_rejected", agent, id: r.citationsInconnues.join(","), raison: "citation inconnue" });
    const v = await verifierDossierApi(brut as unknown as DossierVerifiable, r.evidence, etat.saisie!.pays);
    await signaler(ctx, agent, brut as unknown as DossierVerifiable, v);
    if (!v.voteValide) throw new ValidationError(`${agent} : vote sans 2 appuis vérifiés (${v.raisonVote})`);
    const propre = assainir(brut as never, v) as JurorBrief;
    const brief = valider(schemaSortie(agent, "INSTRUCTION", "plugin"), propre, `${agent} (dossier vérifié)`) as JurorBrief;
    const libres = verifierNombresLibres(brief as never, v.acceptees);
    if (libres.length) throw new ValidationError(`${agent} : ${libres.map((l) => `${l.id} ${l.raison}`).join(" ; ")}`);
    return { brief, acceptees: v.acceptees, rejets: v.rejetees };
  });
}

/** Comptable, mission 1 : affirmations et hypothèses (le tableau est calculé après l'Investisseur). */
async function comptableHypotheses(ctx: Contexte, etat: Etat): Promise<{ affirmations: Verifie<ReturnType<typeof ComptableInstruction.parse>> }> {
  return avecUneRelance(async () => {
    const r = await appeler(ctx, { agent: "comptable", phase: "INSTRUCTION", donnees: await donneesJure(etat, "comptable"), prenomCliente: etat.prenomCliente, pays: etat.saisie!.pays });
    const brut = r.sortie as { affirmations: never[] } & Record<string, unknown>;
    const v = await verifierDossierApi({ agent: "comptable", affirmations: brut.affirmations }, r.evidence as ToolEvidence, etat.saisie!.pays);
    await signaler(ctx, "comptable", { agent: "comptable", affirmations: brut.affirmations }, v);
    const propre = assainir(brut as never, v) as never;
    return { affirmations: { brut: valider(ComptableInstruction, propre, "Comptable (hypothèses)"), v } };
  });
}

function hypothese(h: { valeur: number | null; ref: string }, acceptees: Set<string>): Hypothese {
  const interne = /^CPT-\d+$/.test(h.ref);
  return interne && !acceptees.has(h.ref) ? { valeur: null, ref: h.ref } : h; // une hypothèse fondée sur un fait rejeté n'existe plus
}

export async function instruction(ctx: Contexte, etat: Etat): Promise<void> {
  const dossiers: Partial<Record<AgentJure, DossierJure>> = {};
  const absents: AgentJure[] = [];
  const echec = async (agent: AgentJure, e: unknown) => {
    absents.push(agent);
    await ctx.emit({ type: "agent_status", agent, statut: "absent" });
    await ctx.emit({ type: "error", code: "juré absent", message: `${agent} : ${(e as Error).message}`, phase: "P2" });
  };

  const autres = AGENTS_JURES.filter((a): a is Exclude<AgentJure, "comptable"> => a !== "comptable");
  const [hyp, ...resultats] = await Promise.allSettled([
    ctx.limite(() => comptableHypotheses(ctx, etat)),
    ...autres.map((a) => ctx.limite(() => jureStandard(ctx, etat, a))),
  ]);
  autres.forEach((a, i) => {
    const r = resultats[i];
    if (r.status === "fulfilled") dossiers[a] = r.value;
  });
  for (const [i, r] of resultats.entries()) if (r.status === "rejected") await echec(autres[i], r.reason);
  for (const r of [hyp, ...resultats]) if (r.status === "rejected" && (r.reason as { code?: string })?.code === "budget_depasse") throw r.reason;

  // Comptable, partie 2 : le code calcule les 14 lignes, puis le Comptable les lit et vote.
  if (hyp.status === "fulfilled") {
    try {
      const { brut, v } = hyp.value.affirmations;
      const acceptees = new Set(v.acceptees);
      const h = brut.hypotheses;
      const inv = dossiers.investisseur?.brief as (JurorBrief & { marche?: { sam_unites: string } }) | undefined;
      const samAff = inv && "marche" in inv ? inv.affirmations.find((a) => a.id === inv.marche!.sam_unites) : undefined;
      const prix = etat.miseEnEtat!.case_file.prix;
      const entrees = entreesDepuisHypotheses(
        {
          prix_mensuel_ht: { valeur: prix.periode === "mois" || prix.periode === "inconnue" ? prix.montant : null, ref: "CASE-prix" },
          cout_variable_mensuel: hypothese(h.cout_variable_mensuel, acceptees),
          churn_mensuel_pct: hypothese(h.churn_mensuel_pct, acceptees),
          cac: hypothese(h.cac, acceptees),
          charges_fixes_mensuelles: hypothese(h.charges_fixes_mensuelles, acceptees),
          objectif_remuneration_mensuelle: { valeur: GUARDRAILS.ledger.objectifRemunerationMensuelle, ref: "CONFIG" },
        },
        { valeur: samAff?.valeur ?? null, ref: samAff?.id ?? "INV-?" },
      );
      etat.ledger = calculerLedger(entrees);
      const idsLedger = etat.ledger.map((l) => `CPT-${l.ligne}`);

      const brief = await avecUneRelance(async () => {
        const r = await appeler(ctx, { agent: "comptable", phase: "LECTURE", donnees: { case_file: etat.miseEnEtat!.case_file, comptes: etat.ledger, affirmations: brut.affirmations }, prenomCliente: etat.prenomCliente, pays: etat.saisie!.pays });
        const lec = valider(ComptableLecture, r.sortie, "Comptable (lecture)");
        const faux = verifierLecture(lec.lecture, etat.ledger!);
        if (faux.length) throw new ValidationError(`Comptable : ${faux.map((f) => `${f.id} ${f.raison}`).join(" ; ")}`);
        const dossier = { agent: "comptable" as const, affirmations: brut.affirmations, arguments: lec.arguments, vote: lec.vote };
        const sans = { ...v, argumentsInvalides: v.argumentsInvalides };
        const propre = assainir(dossier, sans, idsLedger);
        const apVote = lec.vote.appuis.filter((x) => acceptees.has(x) || idsLedger.includes(x));
        if (apVote.length < 2) throw new ValidationError("Comptable : vote sans 2 appuis vérifiés");
        const assemble = valider(BriefComptable, { agent: "comptable", affirmations: propre.affirmations, hypotheses: h, arguments: propre.arguments, lecture: lec.lecture, vote: { ...lec.vote, appuis: apVote }, replique: lec.replique, lacunes: brut.lacunes, alertes: brut.alertes }, "Comptable (dossier)");
        const libres = verifierNombresLibres(assemble as never, [...acceptees]);
        if (libres.length) throw new ValidationError(`Comptable : ${libres.map((l) => `${l.id} ${l.raison}`).join(" ; ")}`);
        return assemble as JurorBrief;
      });
      dossiers.comptable = { brief, acceptees: v.acceptees, rejets: v.rejetees };
    } catch (e) {
      if ((e as { code?: string }).code === "budget_depasse") throw e;
      await echec("comptable", e);
    }
  } else await echec("comptable", hyp.reason);

  etat.dossiers = dossiers;
  etat.absents = absents;
  etat.alertes ??= [];
  for (const a of AGENTS_JURES) for (const x of dossiers[a]?.brief.alertes ?? []) etat.alertes.push(`${a} : ${x}`);
  const copies = detecterArgumentsRecopies(
    AGENTS_JURES.flatMap((a) => (dossiers[a]?.brief.arguments ?? []).map((g) => ({ agent: a, id: g.id, these: g.these }))),
  );
  for (const c of copies) {
    etat.alertes.push(`argument recopié : ${c.a} ≈ ${c.b} (${c.similarite})`);
    await ctx.emit({ type: "error", code: "argument_recopie", message: `${c.a} et ${c.b} se ressemblent (${c.similarite})`, phase: "P2" });
  }
  etat.votes1 = {};
  for (const a of AGENTS_JURES) {
    const d = dossiers[a];
    if (!d) continue;
    etat.votes1[a] = d.brief.vote;
    await ctx.emit({ type: "vote_sealed", agent: agentJure(a) });
  }
}
