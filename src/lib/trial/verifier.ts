// Le vérificateur : aucun chiffre sans source vérifiée (plan v3.0, G1, G4, G11). Fonctions pures ou presque : le code juge,
// jamais le LLM. Un élément rejeté l'est avec sa raison ; tout ce qui s'appuie dessus l'est aussi (propagation).
//
// - verifierDossierApi : mode API. URL ∈ résultats des outils, extrait ∈ passage cité, valeur ∈ extrait.
// - verifierDossierParLecture : mode Tavily / abonnement. Le code relit la page : extrait (normalisé) puis valeur.
// - verifierNombresLibres : tout nombre d'une phrase libre est la valeur d'une affirmation citée (G4).
// - verifierLecture : chaque phrase du Comptable reprend EXACTEMENT la valeur de la ligne citée (G4).
// - verifierNombresRuling, verifierChangementsRuling, verifierProposition : P3 et P4.

import { GUARDRAILS } from "../guardrails/config";
import { comparer, contientValeur, extraireNombres } from "../guardrails/numbers";
import type { ToolEvidence } from "../llm/types";
import type { PageLue } from "../search/types";
import type { Affirmation, CaseFile, LedgerLine, Ruling } from "../schemas";

export interface Rejet {
  id: string;
  raison: string;
}

export interface DossierVerifiable {
  agent: string;
  affirmations: Affirmation[];
  arguments?: { id: string; appuis: string[] }[];
  vote?: { appuis: string[] };
}

export interface ResultatVerification {
  /** Ids des affirmations dont les preuves tiennent. */
  acceptees: string[];
  rejetees: Rejet[];
  /** Arguments dont un appui est rejeté ou inconnu : invalides. */
  argumentsInvalides: Rejet[];
  /** Un vote exige au moins 2 appuis vérifiés. */
  voteValide: boolean;
  raisonVote: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const MIN_APPUIS_VOTE = 2;

/** Le domaine d'une adresse est-il l'un des domaines officiels (ou un sous-domaine) ? */
export function domaineOfficiel(url: string, domaines: readonly string[]): boolean {
  let hote: string;
  try {
    hote = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return domaines.some((d) => hote === d || hote.endsWith(`.${d}`));
}

type ControleSource = (a: Affirmation) => string | null | Promise<string | null>;

async function verifier(d: DossierVerifiable, pays: string, controle: ControleSource): Promise<ResultatVerification> {
  const rejetees = new Map<string, string>();
  const juriste = d.agent === "juriste";
  const officiels = (GUARDRAILS.search.juristeDomains as Record<string, readonly string[]>)[pays] ?? [];

  for (const a of d.affirmations) {
    if (a.type !== "fait") continue;
    if (!a.source_url || !a.extrait) {
      rejetees.set(a.id, "fait sans source ou sans extrait (citation inconnue ?)");
      continue;
    }
    if (juriste && !domaineOfficiel(a.source_url, officiels)) {
      rejetees.set(a.id, `source hors des domaines officiels du Juriste (${new URL(a.source_url).hostname})`);
      continue;
    }
    const raison = await controle(a);
    if (raison) rejetees.set(a.id, raison);
    else if (a.valeur !== null && !contientValeur(a.extrait, a.valeur)) {
      rejetees.set(a.id, `la valeur ${a.valeur} n'est pas dans l'extrait`);
    }
  }

  // Propagation : une estimation dont la base contient un fait rejeté (ou inconnu) est rejetée, jusqu'à stabilité.
  const faits = new Set(d.affirmations.filter((a) => a.type === "fait").map((a) => a.id));
  let change = true;
  while (change) {
    change = false;
    for (const a of d.affirmations) {
      if (a.type !== "estimation" || rejetees.has(a.id)) continue;
      const mauvais = a.base.find((b) => rejetees.has(b) || !(faits.has(b) || d.affirmations.some((x) => x.id === b && x.type === "estimation" && !rejetees.has(b))));
      if (mauvais) {
        rejetees.set(a.id, `sa base contient ${mauvais}, rejeté ou inconnu`);
        change = true;
      }
    }
  }

  const acceptees = d.affirmations.filter((a) => !rejetees.has(a.id)).map((a) => a.id);
  const ok = new Set(acceptees);
  const argumentsInvalides: Rejet[] = [];
  for (const arg of d.arguments ?? []) {
    const mauvais = arg.appuis.find((x) => !ok.has(x));
    if (arg.appuis.length === 0 || mauvais) argumentsInvalides.push({ id: arg.id, raison: `appui ${mauvais ?? "absent"} rejeté ou inconnu` });
  }
  const appuisVote = d.vote?.appuis.filter((x) => ok.has(x)).length ?? 0;
  const voteValide = d.vote === undefined || appuisVote >= MIN_APPUIS_VOTE;
  return {
    acceptees,
    rejetees: [...rejetees].map(([id, raison]) => ({ id, raison })),
    argumentsInvalides,
    voteValide,
    raisonVote: voteValide ? null : `${appuisVote} appui(s) vérifié(s) sur ${MIN_APPUIS_VOTE} exigés`,
  };
}

/** Mode API : l'URL doit avoir été renvoyée par les outils, l'extrait doit être (dans) un passage cité de cette URL. */
export function verifierDossierApi(d: DossierVerifiable, evidence: ToolEvidence, pays = "FR"): Promise<ResultatVerification> {
  const urls = new Set(evidence.urlsRenvoyees);
  return verifier(d, pays, (a) => {
    if (!urls.has(a.source_url!)) return "URL absente des résultats des outils";
    const cite = evidence.citations.some((c) => c.url === a.source_url && norm(c.passage).includes(norm(a.extrait!)));
    return cite ? null : "extrait absent des passages cités par l'API";
  });
}

/** Mode Tavily / abonnement : le code relit la page (8 s au plus), puis vérifie l'extrait normalisé. */
export function verifierDossierParLecture(d: DossierVerifiable, lire: (url: string) => Promise<PageLue>, pays = "FR"): Promise<ResultatVerification> {
  const cache = new Map<string, Promise<string | null>>();
  const page = (url: string) => {
    if (!cache.has(url)) cache.set(url, lire(url).then((p) => p.texte, () => null));
    return cache.get(url)!;
  };
  return verifier(d, pays, async (a) => {
    const texte = await page(a.source_url!);
    if (texte === null) return "page illisible ou introuvable";
    return norm(texte).includes(norm(a.extrait!)) ? null : "extrait absent de la page";
  });
}

// ───────────── G4 : les nombres des phrases libres ─────────────

const REFERENCES = /\b(?:INV|CPT|JUR|CON|CLI|JUG)-[A-Z]?\d+\b|\b[Ll]ignes?\s+\d+\b|\bL\d{1,2}\b/g;

/** Les nombres d'une phrase libre, hors références (ids d'affirmations, « Ligne 10 »). */
export function nombresLibres(texte: string): { valeur: number; texte: string }[] {
  return extraireNombres(texte.replace(REFERENCES, " ")).map((n) => ({ valeur: n.valeur, texte: n.texte }));
}

/** Chaque nombre du texte doit égaler (±1 %) l'une des valeurs autorisées. Renvoie les nombres sans appui. */
export function nombresSansAppui(texte: string, autorises: readonly number[]): string[] {
  return nombresLibres(texte)
    .filter((n) => !autorises.some((v) => comparer(n.valeur, v)))
    .map((n) => n.texte);
}

const valeursDe = (affs: Affirmation[], ids: Iterable<string>, ok: Set<string>): number[] => {
  const pris = new Set(ids);
  return affs.filter((a) => pris.has(a.id) && ok.has(a.id) && a.valeur !== null).map((a) => a.valeur as number);
};

/** `these`, `raison_principale` et `replique` : seuls des nombres venus d'affirmations vérifiées citées en appui. */
export function verifierNombresLibres(d: DossierVerifiable & { replique?: string; vote?: { appuis: string[]; raison_principale?: string }; arguments?: { id: string; appuis: string[]; these?: string }[] }, acceptees: readonly string[]): Rejet[] {
  const ok = new Set(acceptees);
  const rejets: Rejet[] = [];
  const signaler = (id: string, texte: string | undefined, autorises: number[]) => {
    if (!texte) return;
    const intrus = nombresSansAppui(texte, autorises);
    if (intrus.length) rejets.push({ id, raison: `nombre(s) sans appui : ${intrus.join(", ")}` });
  };
  for (const a of d.arguments ?? []) signaler(a.id, a.these, valeursDe(d.affirmations, a.appuis, ok));
  signaler("vote.raison_principale", d.vote?.raison_principale, valeursDe(d.affirmations, d.vote?.appuis ?? [], ok));
  signaler("replique", d.replique, valeursDe(d.affirmations, d.affirmations.map((a) => a.id), ok));
  return rejets;
}

/** Nombres écrits tels qu'affichés : « 5,19 » vaut 5,1923 s'il est arrondi à 2 décimales. */
function egalAffiche(ecrit: { valeur: number; texte: string }, ligne: number): boolean {
  const m = ecrit.texte.match(/[.,](\d+)/);
  const d = m ? m[1].length : 0;
  const f = 10 ** d;
  return Math.round(ligne * f) / f === ecrit.valeur;
}

/** Comptable, mission 2 : chaque phrase cite une ligne et reprend EXACTEMENT sa valeur ; « non calculable » se lit comme tel. */
export function verifierLecture(lecture: { ligne: string; phrase: string }[], ledger: LedgerLine[]): Rejet[] {
  const rejets: Rejet[] = [];
  for (const { ligne, phrase } of lecture) {
    const l = ledger.find((x) => x.ligne === ligne);
    if (!l) {
      rejets.push({ id: ligne, raison: "ligne inconnue" });
      continue;
    }
    const cite = phrase.match(/\b[Ll]igne\s+(\d+)\b/);
    if (cite && `L${cite[1]}` !== ligne) rejets.push({ id: ligne, raison: `la phrase cite la ligne ${cite[1]}, pas ${ligne}` });
    const ecrits = nombresLibres(phrase);
    if (l.valeur === null) {
      if (ecrits.length) rejets.push({ id: ligne, raison: `${ligne} est non calculable : aucun nombre permis (« ${ecrits.map((n) => n.texte).join(", ")} »)` });
      continue;
    }
    const faux = ecrits.filter((n) => !egalAffiche(n, l.valeur as number));
    if (faux.length) rejets.push({ id: ligne, raison: `${faux.map((n) => n.texte).join(", ")} ≠ la valeur de ${ligne} (${l.valeur})` });
  }
  return rejets;
}

// ───────────── P3 et P4 : propositions et Ruling ─────────────

/** Une proposition : au moins un appui vérifié, et aucun nombre qui ne soit la valeur d'un appui (G11). */
export function verifierProposition(p: { id: string; texte: string; appuis: string[] }, acceptees: ReadonlyMap<string, number | null>): Rejet[] {
  if (p.appuis.length === 0) return [{ id: p.id, raison: "proposition sans appui" }];
  const inconnu = p.appuis.find((a) => !acceptees.has(a));
  if (inconnu) return [{ id: p.id, raison: `appui ${inconnu} rejeté ou inconnu` }];
  const autorises = p.appuis.map((a) => acceptees.get(a)).filter((v): v is number => v !== null && v !== undefined);
  const intrus = nombresSansAppui(p.texte, autorises);
  return intrus.length ? [{ id: p.id, raison: `nombre(s) sans appui : ${intrus.join(", ")}` }] : [];
}

/** Le Juge n'a aucun outil : chaque nombre de ses textes est la valeur d'une affirmation vérifiée ou d'une ligne des comptes. */
export function verifierNombresRuling(r: Ruling, valeursConnues: readonly number[]): Rejet[] {
  const champs: [string, string][] = [
    ...r.contradictions.flatMap((c, i): [string, string][] => [[`contradictions[${i}].sujet`, c.sujet], [`contradictions[${i}].attendu`, c.attendu]]),
    ...r.reponses_objections.map((o, i): [string, string] => [`reponses_objections[${i}].justification`, o.justification]),
    ...r.plan_corrige.changements.flatMap((c, i): [string, string][] => [
      [`changements[${i}].avant`, c.avant],
      [`changements[${i}].apres`, c.apres],
      [`changements[${i}].justification`, c.justification],
    ]),
    ...r.conditions_pour_lancer.map((c, i): [string, string] => [`conditions[${i}]`, c.condition]),
    ["par_ces_motifs", r.par_ces_motifs],
  ];
  const rejets: Rejet[] = [];
  for (const [id, texte] of champs) {
    const intrus = nombresSansAppui(texte, valeursConnues);
    if (intrus.length) rejets.push({ id, raison: `nombre(s) sans appui : ${intrus.join(", ")}` });
  }
  return rejets;
}

const CHAMP_DU_CASEFILE = { prix: "prix", cible: "cible", offre: "solution", canal: "canal_presume", zone: "zone", modele: "modele_revenu" } as const;

/** Seuls les champs annoncés ont changé ; chaque changement a une source connue (proposition du tour 2 ou « juge »). */
export function verifierChangementsRuling(r: Ruling, v1: CaseFile, propositionsConnues: ReadonlySet<string>): Rejet[] {
  const rejets: Rejet[] = [];
  const annonces = new Set(r.plan_corrige.changements.map((c) => CHAMP_DU_CASEFILE[c.champ]));
  const v2 = r.plan_corrige.case_file_v2 as Record<string, unknown>;
  for (const [cle, avant] of Object.entries(v1)) {
    if (cle === "mots_retires") continue; // liste tenue par le code (neutralité), pas par le Juge
    if (JSON.stringify(avant) !== JSON.stringify(v2[cle]) && !annonces.has(cle as never)) {
      rejets.push({ id: `case_file_v2.${cle}`, raison: "champ modifié sans être annoncé dans les changements" });
    }
  }
  for (const c of r.plan_corrige.changements) {
    if (!annonces.has(CHAMP_DU_CASEFILE[c.champ])) continue;
    if (c.source !== "juge" && !propositionsConnues.has(c.source)) rejets.push({ id: `changement:${c.champ}`, raison: `source ${c.source} : aucune proposition de ce nom au tour 2` });
    if (JSON.stringify(v1[CHAMP_DU_CASEFILE[c.champ]]) === JSON.stringify(v2[CHAMP_DU_CASEFILE[c.champ]])) {
      rejets.push({ id: `changement:${c.champ}`, raison: "changement annoncé mais champ inchangé dans case_file_v2" });
    }
  }
  return rejets;
}
