// Le MODÈLE du rapport PDF (plan v3.0, §8) : des pages de lignes de texte, chacune avec ses références.
// Règle d'or : AUCUN NOMBRE dans le rapport sans numéro de source (S1…), ligne du Comptable (L10), ou calcul du code
// (tally, usage, vote, dossier, arbitrage, proces). verifierRapport() l'impose ; un test l'exécute sur le cas de référence.
// Aucune dépendance à React : ce fichier est testable sans rendre de PDF.

import { AGENTS } from "../../../prompts/agents.config";
import { GUARDRAILS } from "../guardrails/config";
import { nombresLibres } from "../trial/verifier";
import { AGENTS_JURES, type AgentJure } from "../schemas";
import { classerObjections } from "../trial/objections";
import type { Etat } from "../trial/phases/contexte";

export interface Ligne {
  texte: string;
  refs: string[];
  /** Mise en forme : titre de section, ligne en grand (phrase finale), bandeau d'alerte. */
  style?: "grand" | "titre" | "alerte" | "note";
}
export interface Tableau {
  entetes: string[];
  lignes: { cellules: string[]; refs: string[] }[];
}
export interface PageRapport {
  titre: string;
  lignes: Ligne[];
  tableau?: Tableau;
}
export interface SourceRapport {
  numero: number;
  titre: string;
  url: string;
  consulteLe: string;
  extrait: string;
}
export interface ModeleRapport {
  pages: PageRapport[];
  sources: SourceRapport[];
}

export const AVERTISSEMENT =
  "Ce rapport est produit par des modèles d'IA à partir de sources publiques. Il ne constitue ni un conseil financier, ni un conseil juridique. Vérifiez les sources avant toute décision.";

// ───────────── Aides ─────────────

/** Caractères que la police standard du PDF (Helvetica, WinAnsi) ne sait pas dessiner : on les remplace. */
export function texteSur(t: string): string {
  return t
    .replace(/[   ]/g, " ")
    .replace(/⌈/g, "plafond(")
    .replace(/⌉/g, ")")
    .replace(/[−–]/g, "-")
    .replace(/→/g, "vers")
    .replace(/≈/g, "~")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≠/g, "different de")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^ -ÿ€…—«»\n]/g, "?");
}

const fmt = (n: number, d = 1): string => n.toLocaleString("fr-FR", { maximumFractionDigits: d }).replace(/[  ]/g, " ");
const l = (texte: string, refs: string[] = [], style?: Ligne["style"]): Ligne => ({ texte: texteSur(texte), refs, style });
const REF_OK = /^(S\d+|L\d{1,2}|vote|tally|usage|dossier|arbitrage|proces)$/;

const NOMS_JURES: Record<AgentJure, string> = { investisseur: "L'Investisseur", comptable: "Le Comptable", juriste: "Le Juriste", concurrent: "Le Concurrent", cliente: "La Cliente" };
const CODES: Record<string, AgentJure> = { INV: "investisseur", CPT: "comptable", JUR: "juriste", CON: "concurrent", CLI: "cliente" };

type Aff = { id: string; texte: string; valeur: number | null; unite: string; type: string; base: string[]; source_url: string | null; extrait: string | null };

// ───────────── Construction ─────────────

export function construireRapport(etat: Etat, opts: { date: string }): ModeleRapport {
  const cf = etat.miseEnEtat?.case_file;
  const res = etat.resultat;
  const dossiers = etat.dossiers ?? {};
  const presents = AGENTS_JURES.filter((a) => dossiers[a]);
  const prenom = (a: AgentJure): string => (a === "cliente" ? (etat.prenomCliente ?? "La Cliente") : AGENTS[a].prenom ?? NOMS_JURES[a]);

  // --- Sources numérotées : faits des jurés, puis pièces du greffe et identification ---
  const sources: SourceRapport[] = [];
  const parCle = new Map<string, number>();
  const ajouterSource = (url: string, extrait: string): number => {
    const cle = `${url}\n${extrait}`;
    const connue = parCle.get(cle);
    if (connue) return connue;
    const numero = sources.length + 1;
    let titre = url;
    try {
      titre = new URL(url).hostname;
    } catch {
      /* titre = adresse */
    }
    sources.push({ numero, titre, url, consulteLe: opts.date, extrait });
    parCle.set(cle, numero);
    return numero;
  };
  const affs: Record<string, Aff> = {};
  for (const a of presents) for (const x of dossiers[a]!.brief.affirmations as Aff[]) affs[x.id] = x;
  for (const x of Object.values(affs)) if (x.type === "fait" && x.source_url && x.extrait) ajouterSource(x.source_url, x.extrait);

  const id = etat.identification;
  const refsIdentification: string[] = [];
  for (const c of etat.pieces?.correspondances ?? []) refsIdentification.push(`S${ajouterSource(c.source_url, "Fiche du registre des entreprises")}`);
  if (etat.pieces?.commune) refsIdentification.push(`S${ajouterSource(etat.pieces.commune.source_url, "Fiche de la commune (geo.api.gouv.fr)")}`);
  if (id) {
    refsIdentification.push(`S${ajouterSource(id.categorie_activite.source_url, id.categorie_activite.extrait)}`);
    refsIdentification.push(`S${ajouterSource(id.zone.population.source_url, "Population de la commune")}`);
  }
  const refsId = [...new Set(refsIdentification)];

  /** Références d'une liste d'ids d'appui : source d'un fait, base d'une estimation, ligne du Comptable, donnée saisie. */
  const refsAppuis = (ids: string[], vus = new Set<string>()): string[] => {
    const refs = new Set<string>();
    for (const i of ids) {
      if (vus.has(i)) continue;
      vus.add(i);
      if (/^CPT-L\d{1,2}$/.test(i)) refs.add(i.slice(4));
      else if (i.startsWith("JUG-")) refs.add("arbitrage");
      else {
        const a = affs[i];
        if (!a) continue;
        if (a.type === "fait" && a.source_url && a.extrait) refs.add(`S${ajouterSource(a.source_url, a.extrait)}`);
        else if (a.type === "estimation") refsAppuis(a.base, vus).forEach((r) => refs.add(r));
        else refs.add("dossier");
      }
    }
    return [...refs];
  };
  const refsJure = (a: AgentJure): string[] => refsAppuis(Object.keys(affs).filter((i) => CODES[i.slice(0, 3)] === a));

  const pages: PageRapport[] = [];

  // --- 1. Couverture-verdict ---
  {
    const lignes: Ligne[] = [l("LE TRIBUNAL", [], "titre"), l(`Rapport du procès, établi le ${opts.date}.`, ["proces"])];
    if (cf) lignes.push(l(`Idée jugée : ${cf.nom}, ${cf.solution}, pour ${cf.cible}.`, cf.solution.match(/\d/) || cf.cible.match(/\d/) ? ["dossier"] : []));
    if (cf?.prix.montant != null) lignes.push(l(`Prix : ${fmt(cf.prix.montant, 2)} EUR par ${cf.prix.periode} (donnée saisie).`, ["dossier"]));
    if (res) {
      lignes.push(l(res.phrase, [], "grand"));
      if (res.noteApres !== null && res.noteAvant !== null) lignes.push(l(`Note finale : ${fmt(res.noteAvant)} vers ${fmt(res.noteApres)} / 10 (avant et après la correction du plan).`, ["tally"], "note"));
      else if (res.noteAvant !== null) lignes.push(l(`Note du premier vote : ${fmt(res.noteAvant)} / 10 (revote sans quorum).`, ["tally"], "note"));
      const total = res.repartition.GO + res.repartition.PIVOT + res.repartition["NO-GO"];
      lignes.push(l(`Verdict du jury : ${res.verdictJury} (${res.repartition.GO} GO, ${res.repartition.PIVOT} PIVOT, ${res.repartition["NO-GO"]} NO-GO).`, ["tally"]));
      lignes.push(l(`Quorum : ${total}/5 votes valides.`, ["tally"]));
      if (res.divergence && res.noteApres !== null) lignes.push(l(`Attention : verdict ${res.verdictJury} à ${res.repartition[res.verdictJury as "GO"]} voix sur ${total}, mais note ${fmt(res.noteApres)}/10.`, ["tally"], "alerte"));
      if (res.juryDivise) lignes.push(l("Jury divisé.", [], "alerte"));
      if (res.consensusSuspect) lignes.push(l("Consensus suspect : à examiner.", [], "alerte"));
    }
    if (etat.coutUsd !== undefined) lignes.push(l(`Coût du procès : ${fmt(etat.coutUsd, 2)} $ (estimation).`, ["usage"]));
    if (cf && cf.prix.montant === null) lignes.push(l("Prix non communiqué : comptes partiels.", [], "alerte"));
    pages.push({ titre: "Verdict", lignes });
  }

  // --- 2. En bref ---
  {
    const lignes: Ligne[] = [l("Trois raisons principales", [], "titre")];
    const sourcesObj = presents.map((a) => {
      const b = dossiers[a]!.brief as unknown as { arguments: { id: string; sens: string; these: string; appuis: string[] }[]; objections?: { id: string; citation: string }[] };
      return { agent: a, arguments: b.arguments, objections: b.objections };
    });
    const votes1 = Object.fromEntries(presents.map((a) => [a, etat.votes1![a]!])) as unknown as Record<AgentJure, { verdict: "GO" | "PIVOT" | "NO-GO" }>;
    const top = classerObjections({ dossiers: sourcesObj, debats: etat.debat ?? [], votes1, max: 3 });
    for (const o of top) {
      const arg = sourcesObj.flatMap((s) => s.arguments).find((x) => x.id === o.id);
      lignes.push(l(`${prenom(o.auteur)} : ${o.texte}`, arg ? refsAppuis(arg.appuis) : refsJure(o.auteur)));
    }
    lignes.push(l("Conditions pour lancer", [], "titre"));
    for (const c of etat.ruling?.conditions_pour_lancer.slice(0, 3) ?? []) lignes.push(l(`${c.condition}${c.mesurable ? " (mesurable)" : ""}.`, refsAppuis(c.appuis)));
    lignes.push(l("Ce qui a changé entre les deux votes", [], "titre"));
    for (const c of etat.ruling?.plan_corrige.changements ?? []) lignes.push(l(`${c.champ} : ${c.avant} devient ${c.apres}.`, refsAppuis(c.appuis)));
    if (res?.noteAvant != null && res.noteApres != null) lignes.push(l(`La note passe de ${fmt(res.noteAvant)} à ${fmt(res.noteApres)} sur 10.`, ["tally"]));
    pages.push({ titre: "En bref", lignes });
  }

  // --- 3. Le dossier ---
  {
    const lignes: Ligne[] = [l("Identification du business", [], "titre")];
    if (id) {
      lignes.push(l(`Statut : ${id.statut.replace(/_/g, " ")}.`));
      for (const c of etat.pieces?.correspondances ?? []) lignes.push(l(`Registre : ${c.denomination}, SIREN ${c.siren}, code NAF ${c.activite_naf}, ${c.commune}, créée le ${c.date_creation}, ${c.etat === "active" ? "active" : "cessée"}.`, refsId));
      lignes.push(l(`Activité : ${id.categorie_activite.libelle} (code NAF ${id.categorie_activite.code_naf}).`, refsId));
      lignes.push(l(`Zone : ${id.zone.commune}, ${id.zone.departement}${id.zone.population.valeur != null ? `, ${fmt(id.zone.population.valeur, 0)} habitants` : ""}.`, refsId));
      for (const e of id.ecarts) lignes.push(l(`Écart : ${e}`, refsId));
    }
    lignes.push(l("Dossier neutre remis aux jurés", [], "titre"));
    if (cf) {
      lignes.push(l(`Nom : ${cf.nom}. Cible : ${cf.cible}.`, ["dossier"]));
      lignes.push(l(`Problème : ${cf.probleme}. Solution : ${cf.solution}.`, ["dossier"]));
      lignes.push(l(`Modèle de revenu : ${cf.modele_revenu}. Zone : ${cf.zone}. Canal : ${cf.canal_presume}.`, ["dossier"]));
      if (cf.mots_retires.length) lignes.push(l(`Mots publicitaires retirés avant l'appel : ${cf.mots_retires.join(", ")}.`));
      for (const h of cf.hypotheses_implicites) lignes.push(l(`Hypothèse implicite (non prouvée) : ${h}.`, ["dossier"]));
    }
    const p = etat.miseEnEtat?.persona_cliente;
    if (p) lignes.push(l(`La Cliente (personnage fictif) : ${p.prenom}, ${p.role}, ${p.etablissement}, à ${p.ville}. Journée type : ${p.journee_type}.`, ["dossier"]));
    pages.push({ titre: "Le dossier", lignes });
  }

  // --- 4 à 8. Une page par juré ---
  for (const a of AGENTS_JURES) {
    const d = dossiers[a];
    const lignes: Ligne[] = [];
    if (!d) {
      lignes.push(l("Absent du procès : panne, ou preuves insuffisantes (voir l'annexe B).", []));
      pages.push({ titre: `${prenom(a)}, ${NOMS_JURES[a].toLowerCase()}`, lignes });
      continue;
    }
    const b = d.brief as unknown as { replique: string; lacunes: string[]; alertes: string[]; vote: { note: number; verdict: string; raison_principale: string } };
    lignes.push(l(`« ${b.replique} »`, refsJure(a)));
    lignes.push(l("Affirmations clés", [], "titre"));
    for (const x of d.brief.affirmations as Aff[]) {
      const etiquette = x.type === "fait" ? "fait sourcé" : x.type === "estimation" ? "ESTIMATION (fondée sur des faits sourcés)" : "donnée saisie";
      lignes.push(l(`${x.id} (${etiquette}) : ${x.texte}`, refsAppuis([x.id])));
    }
    lignes.push(l("Votes", [], "titre"));
    lignes.push(l(`Vote 1 : ${fmt(b.vote.note)}/10, ${b.vote.verdict}. ${b.vote.raison_principale}`, ["vote", ...refsAppuis(d.brief.vote.appuis)]));
    const rv = etat.votes2?.[a];
    if (rv) {
      lignes.push(l(`Revote : ${fmt(rv.vote.note)}/10, ${rv.vote.verdict}. ${rv.vote.raison_principale}`, ["vote", ...refsAppuis(rv.vote.appuis)]));
      lignes.push(l(rv.a_change_d_avis ? `A changé d'avis : ${rv.pourquoi}` : "N'a pas changé d'avis.", ["vote"]));
    } else lignes.push(l("Revote : absent."));
    for (const x of b.lacunes) lignes.push(l(`Lacune : ${x}`, ["vote"]));
    for (const x of b.alertes) lignes.push(l(`Alerte : ${x}`, ["vote"], "alerte"));
    pages.push({ titre: `${prenom(a)}, ${NOMS_JURES[a].toLowerCase()}`, lignes });
  }

  // --- Page du Comptable : tableau L1 à L14 ---
  {
    const lignes: Ligne[] = [];
    const prix = cf?.prix;
    lignes.push(l(`Origine du prix : ${prix ? { saisie: "saisie par l'utilisateur", site_officiel: "site officiel", reponse_question: "réponse à la question posée", non_communique: "non communiqué" }[prix.origine] : "inconnue"}.`));
    lignes.push(l("Les comptes sont calculés par le code ; le Comptable ne fait que les lire. « Non calculable » : une entrée manque.", []));
    pages.push({
      titre: "Les comptes de Léa, ligne par ligne",
      lignes,
      tableau: {
        entetes: ["Ligne", "Calcul", "Formule", "Entrées", "Valeur"],
        lignes: (etat.ledger ?? []).map((x) => ({
          cellules: [x.ligne, x.libelle, x.formule, x.depuis.join(", "), x.valeur === null ? "non calculable" : fmt(x.valeur, 4)].map(texteSur),
          refs: [x.ligne],
        })),
      },
    });
  }

  // --- Page du Juriste : risques ---
  {
    const jur = dossiers.juriste?.brief as unknown as { risques?: { id: string; intitule: string; texte_officiel: string; gravite: string; mesure_reduction: string; appuis: string[] }[]; avertissement?: string } | undefined;
    pages.push({
      titre: "Claire : les risques signalés",
      lignes: [l(jur?.avertissement ?? "Signalement de risques sourcés, pas un avis juridique.")],
      tableau: {
        entetes: ["Risque", "Gravité", "Texte officiel", "Mesure"],
        lignes: (jur?.risques ?? []).map((r) => ({
          cellules: [r.intitule, r.gravite, `${affs[r.texte_officiel]?.texte ?? r.texte_officiel}`, r.mesure_reduction].map(texteSur),
          refs: refsAppuis([...r.appuis, r.texte_officiel]),
        })),
      },
    });
  }

  // --- Le débat : échanges marquants ---
  {
    const lignes: Ligne[] = [];
    const contestes = (etat.debat ?? []).flatMap((t) => t.repliques.filter((r) => r.type === "conteste").map((r) => ({ t, r })));
    for (const { t, r } of contestes.slice(0, 6)) {
      lignes.push(l(`${t.tour === 1 ? "Premier" : "Second"} tour, ${prenom(t.agent)} conteste ${r.vise} : « ${r.texte} »`, refsAppuis(r.appuis)));
    }
    for (const t of (etat.debat ?? []).filter((x) => x.tour === 2 && x.proposition)) {
      lignes.push(l(`Proposition de ${prenom(t.agent)} (${t.proposition!.champ}) : ${t.proposition!.texte}`, refsAppuis(t.proposition!.appuis)));
    }
    pages.push({ titre: "Le débat", lignes });
  }

  // --- L'arbitrage ---
  {
    const ru = etat.ruling;
    const lignes: Ligne[] = [];
    for (const c of ru?.contradictions ?? []) lignes.push(l(`${c.id} : ${c.sujet}. ${c.attendu}`, refsAppuis(c.appuis)));
    for (const o of ru?.reponses_objections ?? []) lignes.push(l(`Objection ${o.objection} : ${o.decision === "changement" ? "changement de plan" : "refus motivé"}. ${o.justification}`, refsAppuis(o.appuis)));
    if (ru) lignes.push(l(`Par ces motifs : ${ru.par_ces_motifs}`, ["arbitrage"]));
    if (res) lignes.push(l(res.texte, ["tally"]));
    pages.push({
      titre: "L'arbitrage de Nadia",
      lignes,
      tableau: ru && {
        entetes: ["Champ", "Avant", "Après", "Source du changement"],
        lignes: ru.plan_corrige.changements.map((c) => ({ cellules: [c.champ, c.avant, c.apres, c.source].map(texteSur), refs: refsAppuis(c.appuis) })),
      },
    });
  }

  // --- Méthode ---
  {
    const t = GUARDRAILS.tally;
    const lignes: Ligne[] = [
      l(`Quorum : au moins ${t.quorum} votes valides sur 5, à chaque tour. Sans quorum, aucun verdict.`, ["tally"]),
      l("Verdict : la majorité stricte des votes l'emporte. Sans majorité, la moyenne des notes tranche.", []),
      l(`La moyenne vaut GO à partir de ${fmt(t.goMin)}, NO-GO jusqu'à ${fmt(t.nogoMax)}, PIVOT entre les deux.`, ["tally"]),
      l(`Si la majorité et la moyenne divergent, le verdict reste celui de la majorité et la divergence est signalée.`),
      l(`Écart-type : "jury divisé" à partir de ${fmt(t.divise)}, "consensus suspect" jusqu'à ${fmt(t.consensusSuspect)}.`, ["tally"]),
    ];
    if (res?.ecartTypeAvant != null) lignes.push(l(`Écart-type du premier vote : ${fmt(res.ecartTypeAvant, 2)}.`, ["tally"]));
    if (res?.ecartTypeApres != null) lignes.push(l(`Écart-type du revote : ${fmt(res.ecartTypeApres, 2)}.`, ["tally"]));
    lignes.push(l("Nadia prononce le verdict avec un texte fixe : les nombres viennent du code, jamais d'un modèle."));
    pages.push({ titre: "Méthode", lignes });
  }

  // --- Annexe A : sources ---
  pages.push({
    titre: "Annexe A : sources",
    lignes: sources.length
      ? sources.map((s) => l(`S${s.numero} : ${s.titre}, ${s.url}, consulté le ${s.consulteLe}. « ${s.extrait} »`, [`S${s.numero}`]))
      : [l("Aucune source.")],
  });

  // --- Annexe B : transparence ---
  {
    const lignes: Ligne[] = [];
    const rejets = presents.flatMap((a) => dossiers[a]!.rejets.map((r) => ({ a, ...r })));
    lignes.push(l(`Chiffres rejetés par le vérificateur : ${rejets.length}.`, ["proces"]));
    for (const r of rejets) lignes.push(l(`${prenom(r.a)} : ${r.id} rejeté (${r.raison}).`, ["proces"]));
    for (const a of etat.alertes ?? []) lignes.push(l(`Alerte : ${a}`, ["proces"], "alerte"));
    for (const a of etat.absents ?? []) lignes.push(l(`Absent du procès : ${prenom(a)}.`));
    const modeles = [...new Set(Object.values(AGENTS).map((x) => x.modele))];
    lignes.push(l(`Modèles utilisés : ${modeles.join(", ")}.`, ["usage"]));
    if (etat.usage) lignes.push(l(`Tokens : ${fmt(etat.usage.entree, 0)} en entrée, ${fmt(etat.usage.sortie, 0)} en sortie ; recherches web : ${etat.usage.recherches}.`, ["usage"]));
    for (const [phase, usd] of Object.entries(etat.coutParPhase ?? {})) lignes.push(l(`Coût de la phase ${phase} : ${fmt(usd, 4)} $.`, ["usage"]));
    pages.push({ titre: "Annexe B : transparence", lignes });
  }

  // --- Dernière page ---
  pages.push({ titre: "Avertissement", lignes: [l(AVERTISSEMENT, [], "alerte")] });

  return { pages, sources };
}

// ───────────── La règle d'or ─────────────

export interface Violation {
  page: string;
  texte: string;
  raison: string;
}

/** Aucun nombre sans référence ; chaque référence existe ; chaque caractère est dessinable. */
export function verifierRapport(m: ModeleRapport): Violation[] {
  const v: Violation[] = [];
  const numeros = new Set(m.sources.map((s) => `S${s.numero}`));
  const verifier = (page: string, texte: string, refs: string[]) => {
    for (const r of refs) {
      if (!REF_OK.test(r)) v.push({ page, texte, raison: `référence invalide « ${r} »` });
      else if (r.startsWith("S") && !numeros.has(r)) v.push({ page, texte, raison: `source ${r} absente de l'annexe A` });
      else if (/^L\d+$/.test(r) && (Number(r.slice(1)) < 1 || Number(r.slice(1)) > 14)) v.push({ page, texte, raison: `ligne ${r} inconnue` });
    }
    const nombres = nombresLibres(texte);
    if (nombres.length && refs.length === 0) v.push({ page, texte, raison: `nombre(s) sans source : ${nombres.map((n) => n.texte).join(", ")}` });
    if (/[^ -ÿ€…—«»\n]/.test(texte)) v.push({ page, texte, raison: "caractère que la police du PDF ne dessine pas" });
  };
  for (const p of m.pages) {
    verifier(p.titre, p.titre, []);
    for (const x of p.lignes) verifier(p.titre, x.texte, x.refs);
    for (const h of p.tableau?.entetes ?? []) verifier(p.titre, h, []);
    for (const r of p.tableau?.lignes ?? []) for (const c of r.cellules) verifier(p.titre, c, r.refs);
  }
  return v;
}
