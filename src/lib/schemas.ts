// TOUS les schémas Zod du Tribunal (plan v3.0, sections 3 et 4). Zod 4.
// Aucune logique d'orchestration ici : seulement la forme des données et les contrôles qui ne dépendent
// que de la donnée elle-même. Les contrôles qui exigent un contexte (source relue sur la page, nombres libres,
// tableau du Comptable) vivent dans verifier.ts et numbers.ts (étape 5).
//
// Deux familles de schémas :
// - les schémas « complets » (Affirmation, JurorBrief, DebateTurn…) : la donnée finale, avec `source_url` + `extrait` ;
// - les variantes « mise en forme » (…Api) : ce que l'on demande au modèle en mode API. Elles remplacent
//   `source_url` + `extrait` par `citation: "Cx"` ; le code recopie lui-même l'URL et le passage cité.
//   Elles n'ont ni champ facultatif ni .default(), et très peu de champs nullables (budget de schéma, [S27]).

import { z } from "zod";
import { GUARDRAILS } from "@/lib/guardrails/config";
import { sansChiffresHorsHeures, verifierPrenomCliente } from "@/lib/trial/persona-prenom";

// ───────────────────────── Constantes communes ─────────────────────────

export const AGENTS_JURES = ["investisseur", "comptable", "juriste", "concurrent", "cliente"] as const;
export const AgentJure = z.enum(AGENTS_JURES).describe("Un des 5 jurés");
export type AgentJure = z.infer<typeof AgentJure>;

export const CODES_AGENT = {
  investisseur: "INV",
  comptable: "CPT",
  juriste: "JUR",
  concurrent: "CON",
  cliente: "CLI",
  juge: "JUG",
} as const;
export type CodeAgent = (typeof CODES_AGENT)[keyof typeof CODES_AGENT];

export const CHAMPS_PLAN = ["prix", "cible", "offre", "canal", "zone", "modele"] as const;
export const ChampPlan = z.enum(CHAMPS_PLAN).describe("Champ du plan qu'on peut changer");

const ID_JURE = "(INV|CPT|JUR|CON|CLI)";
const ID_TOUS = "(INV|CPT|JUR|CON|CLI|JUG)";
const idAny = z
  .string()
  .regex(new RegExp(`^${ID_TOUS}-[A-Z]?\\d{1,3}$`), "Identifiant attendu : INV-3, CLI-O1, JUG-C1, CPT-L3…")
  .describe("Identifiant d'une affirmation, d'un argument, d'une ligne ou d'une objection");

const Verdict = z.enum(["GO", "PIVOT", "NO-GO"]).describe("Verdict d'un juré");
export type VerdictJure = z.infer<typeof Verdict>;

// ───────────────────────── Affirmation, argument, vote ─────────────────────────

const AffirmationChamps = {
  id: z
    .string()
    .regex(new RegExp(`^${ID_TOUS}-\\d{1,3}$`), "Identifiant d'affirmation attendu : INV-3")
    .describe("Identifiant, ex. INV-3"),
  texte: z.string().max(300).describe("Ce qui est affirmé"),
  valeur: z.number().nullable().describe("Le nombre lui-même, ou null"),
  unite: z.string().max(30).describe("Unité (« €/mois », « % »…) ; chaîne vide s'il n'y en a pas"),
  type: z.enum(["fait", "estimation", "donnee_utilisateur"]).describe("fait = source ; estimation = base de faits"),
  base: z.array(z.string()).describe("Ids des faits qui fondent une estimation ; vide sinon"),
};

/** Affirmation complète. `source_url` et `extrait` sont recopiés par le code en mode API. */
export const Affirmation = z
  .object({
    ...AffirmationChamps,
    source_url: z.url().nullable().describe("Adresse de la source ; obligatoire si type = fait"),
    extrait: z.string().max(400).nullable().describe("Passage exact de la page ; obligatoire si type = fait"),
  })
  .superRefine((a, ctx) => {
    if (a.type === "fait") {
      if (!a.source_url) ctx.addIssue({ code: "custom", path: ["source_url"], message: `${a.id} : un fait exige une source_url.` });
      if (!a.extrait) ctx.addIssue({ code: "custom", path: ["extrait"], message: `${a.id} : un fait exige un extrait copié de la page.` });
    }
    if (a.type === "estimation" && a.base.length === 0) {
      ctx.addIssue({ code: "custom", path: ["base"], message: `${a.id} : une estimation exige une base (ids de faits sourcés).` });
    }
  });
export type Affirmation = z.infer<typeof Affirmation>;

/** Variante « mise en forme » (mode API) : `citation` remplace `source_url` + `extrait`. */
export const AffirmationApi = z.object({
  ...AffirmationChamps,
  citation: z
    .string()
    .regex(/^C\d{1,3}$/, "Citation attendue : C1, C2…")
    .nullable()
    .describe("Numéro de citation de l'appel de recherche (C1…) ; null si ce n'est pas un fait"),
});
export type AffirmationApi = z.infer<typeof AffirmationApi>;

export const Argument = z.object({
  id: z.string().regex(new RegExp(`^${ID_JURE}-A\\d{1,2}$`), "Identifiant d'argument attendu : INV-A1").describe("Ex. INV-A1"),
  sens: z.enum(["pour", "contre"]).describe("Pour ou contre l'idée"),
  these: z.string().max(280).describe("La thèse, en une phrase"),
  appuis: z.array(idAny).min(1).describe("Ids d'affirmations qui l'appuient"),
});
export type Argument = z.infer<typeof Argument>;

/** Vote d'un juré. Cohérence note/verdict : GO ⇒ 6 à 10 ; PIVOT ⇒ 3 à 7,5 ; NO-GO ⇒ 0 à 4,5 (config.ts). */
export const Vote = z
  .object({
    note: z.number().min(0).max(10).multipleOf(0.5).describe("Note de 0 à 10, par pas de 0,5"),
    verdict: Verdict,
    raison_principale: z.string().max(280).describe("La raison principale de la note"),
    appuis: z.array(idAny).min(2).describe("Au moins 2 ids d'affirmations vérifiées"),
  })
  .superRefine((v, ctx) => {
    const [min, max] = GUARDRAILS.tally.coherence[v.verdict];
    if (v.note < min || v.note > max) {
      ctx.addIssue({
        code: "custom",
        path: ["verdict"],
        message: `Verdict ${v.verdict} incompatible avec la note ${v.note} : ${v.verdict} exige une note de ${min} à ${max}.`,
      });
    }
  });
export type Vote = z.infer<typeof Vote>;

// ───────────────────────── Proposition d'amélioration (tour 2) ─────────────────────────

// HYPOTHÈSE: forme exacte à aligner sur le candidat `Proposition` quand il sera fusionné.
export const Proposition = z.object({
  id: z.string().regex(new RegExp(`^${ID_JURE}-P\\d{1,2}$`), "Identifiant de proposition attendu : JUR-P1").describe("Ex. JUR-P1"),
  champ: ChampPlan,
  texte: z.string().max(280).describe("Ce qu'il propose de changer, dans son domaine"),
  appuis: z.array(idAny).min(1).describe("Ids d'affirmations vérifiées qui l'appuient"),
});
export type Proposition = z.infer<typeof Proposition>;

// ───────────────────────── Champs propres de chaque juré ─────────────────────────

export const Marche = z.object({
  tam_unites: z.string().describe("Id de l'affirmation : entreprises de la cible dans le pays (TAM)"),
  sam_unites: z.string().describe("Id de l'affirmation : part atteignable (SAM)"),
  croissance_annuelle_pct: z.string().describe("Id de l'affirmation : croissance annuelle, avec la date"),
  levier_echelle: z.enum(["faible", "moyen", "fort"]).describe("Passage à l'échelle"),
  levier_echelle_justification: z.string().describe("Id de l'argument qui justifie le levier"),
});

const refHypothese = z
  .string()
  .regex(/^(CPT-\d{1,3}|CASE-[a-z_]+|CONFIG)$/, "Référence attendue : CPT-3, CASE-prix ou CONFIG")
  .describe("Id d'affirmation, CASE-xxx (dossier) ou CONFIG");
const Hypothese = z.object({
  valeur: z.number().nullable().describe("Valeur, ou null si introuvable"),
  ref: refHypothese,
});
export const ComptableHypothesesChamps = z.object({
  prix_mensuel_ht: Hypothese,
  cout_variable_mensuel: Hypothese,
  churn_mensuel_pct: Hypothese,
  cac: Hypothese,
  charges_fixes_mensuelles: Hypothese,
  objectif_remuneration_mensuelle: Hypothese,
});

export const LIGNES_LEDGER = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11", "L12", "L13", "L14"] as const;
export const LigneId = z.enum(LIGNES_LEDGER).describe("Ligne du tableau du Comptable, L1 à L14");
export const LectureLigne = z.object({
  ligne: LigneId,
  phrase: z.string().max(300).describe("La phrase lue à voix haute ; ses nombres sont ceux de la ligne"),
});

export const Risque = z.object({
  id: z.string().regex(/^JUR-R\d{1,2}$/, "Identifiant de risque attendu : JUR-R1").describe("Ex. JUR-R1"),
  intitule: z.string().max(200).describe("Le risque"),
  texte_officiel: z.string().describe("Id de l'affirmation qui cite le texte officiel"),
  gravite: z.enum(["faible", "moyenne", "forte"]).describe("Gravité"),
  mesure_reduction: z.string().max(280).describe("Mesure de réduction connue ; « aucune connue » sinon"),
  appuis: z.array(idAny).min(1).describe("Ids d'affirmations"),
});
export const AVERTISSEMENT_JURISTE = "Ceci est un signalement de risques sourcés, pas un avis juridique.";

const EtapeCopie = z.object({
  etape: z.string().max(200).describe("Étape du plan de copie"),
  duree_jours: z.number().int().min(1).describe("Durée estimée en jours"),
  type: z.literal("estimation"),
  base: z.array(z.string()).min(1).describe("Ids de faits qui fondent l'estimation"),
});
const DelaiCopie = z.object({
  valeur: z.number().int().min(1).describe("Délai de copie en semaines"),
  type: z.literal("estimation"),
  base: z.array(z.string()).min(1),
});
const Concurrent = z.object({
  nom: z.string().max(100),
  prix: z.string().describe("Id de l'affirmation : prix public"),
  url_tarifs: z.url().describe("Page tarifs"),
});

const Objection = z.object({
  id: z.string().regex(/^CLI-O\d{1,2}$/, "Identifiant d'objection attendu : CLI-O1").describe("Ex. CLI-O1"),
  citation: z.string().max(280).describe("L'objection, dans les mots de la Cliente"),
  fait_appui: z.array(z.string()).min(1).describe("Ids des faits qui la fondent"),
});
const PrixAcceptable = z.object({
  valeur: z.number().nullable().describe("Prix acceptable, ou null"),
  type: z.literal("estimation"),
  base: z.array(z.string()).describe("Ids de faits"),
});

// ───────────────────────── Dossiers des jurés (P2) ─────────────────────────

const communs = {
  arguments: z.array(Argument).min(2).max(6).describe("Les arguments"),
  vote: Vote,
  replique: z.string().max(400).describe("La phrase en personnage pour la salle ; aucun chiffre hors affirmations"),
  lacunes: z.array(z.string()).max(5).describe("Ce qu'il n'a pas trouvé"),
  alertes: z.array(z.string()).max(5).describe("Instructions suspectes trouvées dans une page"),
};
const nbAff = { min: 3, max: 15 } as const;

const propres = {
  investisseur: { marche: Marche },
  comptable: {
    hypotheses: ComptableHypothesesChamps,
    lecture: z.array(LectureLigne).min(1).max(14).describe("Lecture à voix haute du tableau calculé par le code"),
  },
  juriste: {
    risques: z.array(Risque).min(1).max(8),
    avertissement: z.literal(AVERTISSEMENT_JURISTE),
  },
  concurrent: {
    concurrents: z.array(Concurrent).min(1).max(8),
    plan_de_copie: z.array(EtapeCopie).min(1).max(10),
    delai_copie_semaines: DelaiCopie,
    fosse_defendable: z.array(z.string()).min(1).max(5).describe("Ce qui protège l'idée ; « Aucun identifié » sinon"),
  },
  cliente: {
    objections: z.array(Objection).min(1).max(5),
    ce_qui_me_ferait_payer: z.array(z.string().max(200)).max(5),
    prix_acceptable: PrixAcceptable,
  },
} as const;

/** Contrôles communs à tous les dossiers : ids de l'agent, appuis connus, bases = faits. */
function verifierDossier(
  b: {
    agent: AgentJure;
    affirmations: { id: string; type: string; base: string[] }[];
    arguments?: { id: string; appuis: string[] }[];
    vote?: { appuis: string[] };
  },
  ctx: z.RefinementCtx,
) {
  const code = CODES_AGENT[b.agent];
  const ids = new Set<string>();
  const faits = new Set(b.affirmations.filter((a) => a.type === "fait").map((a) => a.id));
  b.affirmations.forEach((a, i) => {
    if (!a.id.startsWith(`${code}-`)) {
      ctx.addIssue({ code: "custom", path: ["affirmations", i, "id"], message: `${a.id} : un dossier ${b.agent} n'emploie que des ids ${code}-n.` });
    }
    if (ids.has(a.id)) ctx.addIssue({ code: "custom", path: ["affirmations", i, "id"], message: `${a.id} : identifiant en double.` });
    ids.add(a.id);
    if (a.type === "estimation") {
      for (const f of a.base) {
        if (!faits.has(f)) {
          ctx.addIssue({ code: "custom", path: ["affirmations", i, "base"], message: `${a.id} : la base ${f} n'est pas un fait de ce dossier.` });
        }
      }
    }
  });
  const connu = (id: string) => ids.has(id);
  b.arguments?.forEach((arg, i) => {
    for (const ap of arg.appuis) {
      if (!connu(ap)) ctx.addIssue({ code: "custom", path: ["arguments", i, "appuis"], message: `${arg.id} : l'appui ${ap} n'est pas une affirmation de ce dossier.` });
    }
  });
  b.vote?.appuis.forEach((ap) => {
    if (!connu(ap)) ctx.addIssue({ code: "custom", path: ["vote", "appuis"], message: `Vote : l'appui ${ap} n'est pas une affirmation de ce dossier.` });
  });
}

const affs = z.array(Affirmation).min(nbAff.min).max(nbAff.max).describe("Affirmations chiffrées ou factuelles");
const affsApi = z.array(AffirmationApi).min(nbAff.min).max(nbAff.max).describe("Affirmations chiffrées ou factuelles");

// Schémas bruts : ce qu'on envoie au modèle (variantes Api) ; aucune contrainte croisée.
const brutApi = {
  investisseur: z.object({ agent: z.literal("investisseur"), affirmations: affsApi, ...communs, ...propres.investisseur }),
  juriste: z.object({ agent: z.literal("juriste"), affirmations: affsApi, ...communs, ...propres.juriste }),
  concurrent: z.object({ agent: z.literal("concurrent"), affirmations: affsApi, ...communs, ...propres.concurrent }),
  cliente: z.object({ agent: z.literal("cliente"), affirmations: affsApi, ...communs, ...propres.cliente }),
};
export const BriefInvestisseurApi = brutApi.investisseur;
export const BriefJuristeApi = brutApi.juriste;
export const BriefConcurrentApi = brutApi.concurrent;
export const BriefClienteApi = brutApi.cliente;

/** Comptable, appel 1 (recherche puis mise en forme) : affirmations + hypothèses. Pas de vote. */
export const ComptableHypotheses = z.object({
  agent: z.literal("comptable"),
  affirmations: affsApi,
  hypotheses: ComptableHypothesesChamps,
  lacunes: communs.lacunes,
  alertes: communs.alertes,
});
/** Comptable, mission 1 en mode plugin : mêmes champs, mais l'agent écrit lui-même `source_url` + `extrait`. */
export const ComptableInstruction = z.object({
  agent: z.literal("comptable"),
  affirmations: affs,
  hypotheses: ComptableHypothesesChamps,
  lacunes: communs.lacunes,
  alertes: communs.alertes,
});
/** Comptable, appel 2 (sans outil) : lecture du tableau calculé + vote. */
export const ComptableLecture = z.object({
  agent: z.literal("comptable"),
  arguments: communs.arguments,
  lecture: propres.comptable.lecture,
  vote: Vote,
  replique: communs.replique,
});

// Dossiers complets : ce que le moteur garde après recopie des sources.
export const BriefInvestisseur = z
  .object({ agent: z.literal("investisseur"), affirmations: affs, ...communs, ...propres.investisseur })
  .superRefine(verifierDossier);
export const BriefComptable = z
  .object({
    agent: z.literal("comptable"),
    affirmations: affs,
    hypotheses: ComptableHypothesesChamps,
    ...communs,
    lecture: propres.comptable.lecture,
  })
  .superRefine(verifierDossier);
export const BriefJuriste = z
  .object({ agent: z.literal("juriste"), affirmations: affs, ...communs, ...propres.juriste })
  .superRefine(verifierDossier);
export const BriefConcurrent = z
  .object({ agent: z.literal("concurrent"), affirmations: affs, ...communs, ...propres.concurrent })
  .superRefine(verifierDossier)
  .superRefine((b, ctx) => {
    // HYPOTHÈSE: « arrondie à la semaine » = somme des jours / 7, arrondie à l'entier le plus proche (minimum 1).
    const jours = b.plan_de_copie.reduce((s, e) => s + e.duree_jours, 0);
    const attendu = Math.max(1, Math.round(jours / 7));
    if (b.delai_copie_semaines.valeur !== attendu) {
      ctx.addIssue({
        code: "custom",
        path: ["delai_copie_semaines", "valeur"],
        message: `delai_copie_semaines vaut ${b.delai_copie_semaines.valeur} semaines mais le plan de copie totalise ${jours} jours (${attendu} semaines).`,
      });
    }
  });
export const BriefCliente = z
  .object({ agent: z.literal("cliente"), affirmations: affs, ...communs, ...propres.cliente })
  .superRefine(verifierDossier);

export const JurorBrief = z.discriminatedUnion("agent", [BriefInvestisseur, BriefComptable, BriefJuriste, BriefConcurrent, BriefCliente]);
export type JurorBrief = z.infer<typeof JurorBrief>;

// ───────────────────────── Tableau du Comptable (calculé par le code) ─────────────────────────

export const LedgerLine = z
  .object({
    ligne: LigneId,
    libelle: z.string(),
    formule: z.string().describe("La formule en clair"),
    valeur: z.number().nullable(),
    statut: z.enum(["calcule", "non_calculable"]),
    depuis: z.array(z.string()).describe("Ids des entrées utilisées"),
  })
  .superRefine((l, ctx) => {
    if ((l.statut === "non_calculable") !== (l.valeur === null)) {
      ctx.addIssue({ code: "custom", path: ["valeur"], message: `${l.ligne} : « non calculable » ⇔ valeur null.` });
    }
  });
export const Ledger = z.array(LedgerLine).length(14).describe("Les 14 lignes L1 à L14, toujours dans cet ordre");
export type LedgerLine = z.infer<typeof LedgerLine>;

// ───────────────────────── Saisie, pièces du greffe, identification (P0, P1a) ─────────────────────────

export const Saisie = z.object({
  nom: z.string().min(1).max(100).describe("Nom du business"),
  offre: z.string().min(1).max(200).describe("Ce qu'il vend"),
  cible: z.string().min(1).max(200).describe("À qui"),
  prix: z.string().max(100).nullable().describe("Prix et fréquence, tels que saisis ; null si absent"),
  ville: z.string().min(1).max(100).describe("Ville, « en ligne » ou « France entière »"),
  pays: z.string().regex(/^[A-Z]{2}$/).describe("Code pays, FR par défaut"),
  probleme: z.string().max(200).nullable().describe("Problème réglé, facultatif"),
});
export type Saisie = z.infer<typeof Saisie>;

const Correspondance = z.object({
  denomination: z.string().describe("Dénomination ; « entreprise individuelle » si masquée"),
  siren: z.string().regex(/^\d{9}$/),
  activite_naf: z.string().regex(/^\d{2}\.\d{2}[A-Z]$/, "Code NAF attendu : 56.10A"),
  commune: z.string(),
  date_creation: z.string(),
  etat: z.enum(["active", "cessee"]),
  source_url: z.url(),
});
const Commune = z.object({
  nom: z.string(),
  code_commune: z.string(),
  departement: z.string(),
  population: z.number().nullable(),
  source_url: z.url(),
});

export const PiecesDuGreffe = z.object({
  statut: z.enum(["ok", "indisponible", "non_applicable"]).describe("non_applicable : pays sans registre branché"),
  correspondances: z.array(Correspondance).max(GUARDRAILS.registry.fr.maxCorrespondances),
  commune: Commune.nullable(),
});
export type PiecesDuGreffe = z.infer<typeof PiecesDuGreffe>;

export const Identification = z.object({
  statut: z.enum(["entreprise_existante", "homonymes", "aucune_trace"]),
  correspondances: z.array(Correspondance).max(GUARDRAILS.registry.fr.maxCorrespondances),
  site_officiel: z.object({ url: z.url().nullable(), extrait: z.string().max(400).nullable() }),
  offre_publique: z.object({
    resume: z.string().max(300).nullable(),
    prix_affiche: z.string().max(100).nullable(),
    source_url: z.url().nullable(),
    extrait: z.string().max(400).nullable(),
  }),
  categorie_activite: z.object({
    code_naf: z.string().regex(/^\d{2}\.\d{2}[A-Z]$/, "Code NAF attendu : 62.01Z"),
    libelle: z.string(),
    source_url: z.url(),
    extrait: z.string().max(400),
  }),
  zone: z.object({
    commune: z.string(),
    code_commune: z.string(),
    departement: z.string(),
    pays: z.string().regex(/^[A-Z]{2}$/),
    population: z.object({ valeur: z.number().nullable(), source_url: z.url() }),
  }),
  ecarts: z.array(z.string()).max(5).describe("Écarts entre la saisie, le registre et le site"),
  alertes: z.array(z.string()).max(5),
});
export type Identification = z.infer<typeof Identification>;

/** Sortie du Greffier-enquêteur (P1a). */
export const EnqueteGreffier = z.object({ saisie_confirmee: Saisie, identification: Identification });
export type EnqueteGreffier = z.infer<typeof EnqueteGreffier>;

// ───────────────────────── Questions de mise en état (P1b, textes fixes) ─────────────────────────

export const CODES_QUESTION = GUARDRAILS.questions.autorisees;
export const Question = z.object({
  code: z.enum(CODES_QUESTION),
  texte: z.string().describe("Texte fixe, jamais écrit par un LLM"),
  choix: z.array(z.string()).describe("Choix proposés (homonymes) ; vide pour le prix"),
});
export type Question = z.infer<typeof Question>;

export const Reponse = z.object({
  code: z.enum(CODES_QUESTION),
  reponse: z.string().max(300).nullable().describe("Réponse ; null = « passer »"),
});
export const Reponses = z
  .array(Reponse)
  .max(GUARDRAILS.questions.max)
  .superRefine((rs, ctx) => {
    if (new Set(rs.map((r) => r.code)).size !== rs.length) {
      ctx.addIssue({ code: "custom", message: "Une réponse par question au plus." });
    }
  });
export type Reponses = z.infer<typeof Reponses>;

// ───────────────────────── CaseFile neutre et persona (P1c) ─────────────────────────

export const CaseFile = z
  .object({
    nom: z.string().max(100),
    cible: z.string().max(200),
    probleme: z.string().max(300),
    probleme_origine: z.enum(["saisie", "non_precise"]),
    solution: z.string().max(300),
    modele_revenu: z.enum(["abonnement", "commission", "achat_unique", "usage", "autre"]),
    prix: z.object({
      montant: z.number().nullable().describe("Montant ; null si non communiqué"),
      devise: z.string().max(3),
      periode: z.enum(["mois", "an", "commande", "unique", "inconnue"]),
      ht_ou_ttc: z.enum(["ht", "ttc", "inconnu"]),
      origine: z.enum(["saisie", "site_officiel", "reponse_question", "non_communique"]),
    }),
    zone: z.string().max(100),
    pays: z.string().regex(/^[A-Z]{2}$/),
    statut_identification: z.enum(["entreprise_existante", "homonymes", "aucune_trace"]),
    canal_presume: z.string().max(200).describe("« non précisé » si inconnu"),
    differenciation: z.string().max(300).nullable(),
    hypotheses_implicites: z.array(z.string().max(200)).max(8),
    affirmations_a_verifier: z.array(z.string().max(200)).max(8),
    inconnues: z.array(z.string().max(200)).max(8),
    mots_retires: z.array(z.string().max(50)).max(20),
  })
  .superRefine((c, ctx) => {
    if ((c.prix.origine === "non_communique") !== (c.prix.montant === null)) {
      ctx.addIssue({ code: "custom", path: ["prix"], message: "Prix : origine « non_communique » ⇔ montant null." });
    }
  });
export type CaseFile = z.infer<typeof CaseFile>;

const textePersona = z.string().max(200);
export const PersonaCliente = z
  .object({
    prenom: z.string().describe("Prénom fictif, créé à chaque procès"),
    role: textePersona,
    etablissement: textePersona,
    ville: textePersona,
    rapport_au_numerique: textePersona,
    journee_type: textePersona,
    registre: textePersona,
    a_verifier_par_la_cliente: z.array(textePersona).min(1).max(6),
  })
  .superRefine((p, ctx) => {
    const r = verifierPrenomCliente(p.prenom);
    if (!r.ok) ctx.addIssue({ code: "custom", path: ["prenom"], message: r.raison });
    for (const [champ, valeur] of Object.entries(p)) {
      if (champ === "prenom") continue;
      const textes = Array.isArray(valeur) ? valeur : [valeur];
      for (const t of textes) {
        if (!sansChiffresHorsHeures(t)) {
          ctx.addIssue({ code: "custom", path: [champ], message: `persona_cliente.${champ} : aucun chiffre permis, sauf les heures de la journée type (« ${t} »).` });
        }
      }
    }
  });
export type PersonaCliente = z.infer<typeof PersonaCliente>;

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Sortie du Greffier-rédacteur (P1c). */
export const MiseEnEtat = z
  .object({
    case_file: CaseFile,
    persona_cliente: PersonaCliente,
    champs_manquants: z.array(z.string()).max(8),
  })
  .superRefine((m, ctx) => {
    if (!sansAccent(m.case_file.zone).includes(sansAccent(m.persona_cliente.ville))) {
      ctx.addIssue({
        code: "custom",
        path: ["persona_cliente", "ville"],
        message: `La persona vit à « ${m.persona_cliente.ville} », qui n'est pas dans la zone du dossier (« ${m.case_file.zone} »).`,
      });
    }
  });
export type MiseEnEtat = z.infer<typeof MiseEnEtat>;

// ───────────────────────── Débat (P3) ─────────────────────────

const Replique = z.object({
  type: z.enum(["conteste", "concede", "precise"]),
  vise: idAny.describe("Id de l'argument ou de la réplique visé : jamais un prénom"),
  texte: z.string().max(400).describe("La réplique, dans la voix du personnage"),
  appuis: z.array(idAny).min(1),
});

const debatChamps = {
  agent: AgentJure,
  tour: z.union([z.literal(1), z.literal(2)]).describe("Tour de débat"),
  repliques: z.array(Replique).min(1).max(5),
  proposition: Proposition.nullable().describe("Tour 2 seulement : au plus une proposition d'amélioration ; null au tour 1"),
};

function verifierDebat(
  d: { agent: AgentJure; tour: 1 | 2; repliques: { type: string }[]; proposition: { id: string } | null },
  ctx: z.RefinementCtx,
) {
  if (!d.repliques.some((r) => r.type === "conteste")) {
    ctx.addIssue({ code: "custom", path: ["repliques"], message: `${d.agent}, tour ${d.tour} : au moins une réplique de type « conteste » est exigée.` });
  }
  if (d.tour === 1 && d.proposition !== null) {
    ctx.addIssue({ code: "custom", path: ["proposition"], message: "Aucune proposition au tour 1 : elles n'existent qu'au tour 2." });
  }
  if (d.proposition && !d.proposition.id.startsWith(`${CODES_AGENT[d.agent]}-P`)) {
    ctx.addIssue({ code: "custom", path: ["proposition", "id"], message: `La proposition ${d.proposition.id} n'appartient pas à ${d.agent} (attendu ${CODES_AGENT[d.agent]}-Pn).` });
  }
}

export const DebateTurnApi = z.object({ ...debatChamps, nouvelles_affirmations: z.array(AffirmationApi).max(3) });
export const DebateTurn = z
  .object({ ...debatChamps, nouvelles_affirmations: z.array(Affirmation).max(3) })
  .superRefine(verifierDebat);
export type DebateTurn = z.infer<typeof DebateTurn>;

// ───────────────────────── Correction (P4) : le Ruling de Nadia ─────────────────────────

const SourceChangement = z
  .string()
  .regex(new RegExp(`^(${ID_JURE}-P\\d{1,2}|juge)$`), "Source attendue : l'id d'une proposition (JUR-P1) ou « juge »")
  .describe("Id de la proposition retenue, ou « juge »");

const Changement = z.object({
  champ: ChampPlan,
  avant: z.string().max(200),
  apres: z.string().max(200),
  repond_a: z.array(z.string()).min(1).describe("Objections ou arguments auxquels il répond"),
  source: SourceChangement,
  justification: z.string().max(400),
  appuis: z.array(idAny).min(1),
});

export const Ruling = z
  .object({
    contradictions: z
      .array(
        z.object({
          id: z.string().regex(/^JUG-C\d{1,2}$/, "Identifiant attendu : JUG-C1"),
          entre: z.tuple([AgentJure, AgentJure]),
          sujet: z.string().max(200),
          position_retenue: AgentJure,
          attendu: z.string().max(400).describe("« Attendu que… », sans chiffre nouveau"),
          appuis: z.array(idAny).min(1),
        }),
      )
      .max(5),
    reponses_objections: z
      .array(
        z.object({
          objection: z.string().describe("Id de l'objection"),
          decision: z.enum(["changement", "refus"]),
          justification: z.string().max(400),
          appuis: z.array(idAny).min(1),
        }),
      )
      .min(1)
      .max(5),
    plan_corrige: z.object({
      changements: z.array(Changement).max(3).describe("Au plus 3 changements"),
      case_file_v2: CaseFile,
    }),
    conditions_pour_lancer: z
      .array(z.object({ condition: z.string().max(250), mesurable: z.boolean(), appuis: z.array(idAny).min(1) }))
      .min(1)
      .max(5),
    par_ces_motifs: z.string().max(600).describe("Texte court et solennel, sans nouveau chiffre ni note ni verdict"),
  })
  .superRefine((r, ctx) => {
    r.plan_corrige.changements.forEach((c, i) => {
      if (c.source === "juge" && c.justification.trim().length < 20) {
        ctx.addIssue({ code: "custom", path: ["plan_corrige", "changements", i, "justification"], message: "Un changement de source « juge » exige une vraie justification." });
      }
    });
  });
export type Ruling = z.infer<typeof Ruling>;

// ───────────────────────── Revote (P5) ─────────────────────────

const CiteChangement = z
  .string()
  .regex(new RegExp(`^(changement:(${CHAMPS_PLAN.join("|")})|${ID_TOUS}-[A-Z]?\\d{1,3})$`), "cite : « changement:prix » ou un id (CLI-O1)");

export const Revote = z
  .object({
    agent: AgentJure,
    vote: Vote,
    a_change_d_avis: z.boolean(),
    pourquoi: z.string().max(300),
    cite: z.array(CiteChangement).max(5).describe("Changement ou id qui motive le nouvel avis ; vide si aucun changement d'avis"),
  })
  .superRefine((r, ctx) => {
    if (r.a_change_d_avis && (r.cite.length === 0 || r.pourquoi.trim() === "")) {
      ctx.addIssue({ code: "custom", path: ["cite"], message: `${r.agent} change d'avis : il doit expliquer pourquoi et citer un changement ou un id.` });
    }
  });
export type Revote = z.infer<typeof Revote>;

// ───────────────────────── Événements du procès (SQLite → SSE → salle d'audience) ─────────────────────────

export const PHASES = ["P0", "P1a", "P1b", "P1c", "P2", "P3", "P4", "P5", "P6"] as const;
export const Phase = z.enum(PHASES);

const base = { trial_id: z.string(), seq: z.number().int().min(0), ts: z.iso.datetime() };
const agentOuJuge = z.enum([...AGENTS_JURES, "juge", "greffier"]);
const NoteOuverte = z.object({ agent: AgentJure, note: z.number(), verdict: Verdict });

// Les événements « scellés » sont stricts : un champ `note` y est une erreur (garde-fou G14).
export const TrialEvent = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("phase_started"), phase: Phase }),
  z.object({ ...base, type: z.literal("agent_status"), agent: agentOuJuge, statut: z.enum(["recherche", "verification", "vote_scelle", "parle", "termine", "absent"]) }),
  z.object({ ...base, type: z.literal("questions"), questions: z.array(Question) }),
  z.object({ ...base, type: z.literal("answers_received"), reponses: Reponses }),
  z.object({ ...base, type: z.literal("search_performed"), agent: agentOuJuge, requete: z.string(), domaines: z.array(z.string()) }),
  z.object({ ...base, type: z.literal("source_verified"), agent: agentOuJuge, id: z.string(), domaine: z.string() }),
  z.object({ ...base, type: z.literal("source_rejected"), agent: agentOuJuge, id: z.string(), raison: z.string() }),
  z.strictObject({ ...base, type: z.literal("vote_sealed"), agent: AgentJure }),
  z.object({ ...base, type: z.literal("vote1_ouvert"), notes: z.array(NoteOuverte).min(1), moyenne: z.number(), ecart_type: z.number() }),
  z.object({ ...base, type: z.literal("debate_reply"), tour: DebateTurn }),
  z.object({ ...base, type: z.literal("ruling"), ruling: Ruling }),
  z.strictObject({ ...base, type: z.literal("revote"), agent: AgentJure }),
  z.object({ ...base, type: z.literal("revote_ouvert"), notes: z.array(NoteOuverte).min(1), moyenne: z.number(), ecart_type: z.number() }),
  z.object({
    ...base,
    type: z.literal("verdict"),
    note_avant: z.number().nullable(),
    note_apres: z.number().nullable(),
    verdict: z.enum(["GO", "PIVOT", "NO-GO", "AJOURNE"]),
    repartition: z.object({ GO: z.number().int(), PIVOT: z.number().int(), "NO-GO": z.number().int() }),
    divergence: z.boolean(),
    jury_divise: z.boolean(),
    consensus_suspect: z.boolean(),
    phrase: z.string(),
    texte_nadia: z.string().describe("Texte fixe de Nadia ; ses nombres viennent de tally.ts"),
  }),
  z.object({ ...base, type: z.literal("cost_update"), usd: z.number().min(0), tokens_entree: z.number().int(), tokens_sortie: z.number().int(), recherches: z.number().int() }),
  z.object({ ...base, type: z.literal("error"), code: z.string(), message: z.string(), phase: Phase.nullable() }),
]);
export type TrialEvent = z.infer<typeof TrialEvent>;

// ───────────────────────── Schémas envoyés à l'API (budget de schéma) ─────────────────────────

/** Les schémas passés à zodOutputFormat en mode API. Le test « budget de schéma » les parcourt tous. */
export const SCHEMAS_API = {
  enquete_greffier: EnqueteGreffier,
  mise_en_etat: MiseEnEtat,
  brief_investisseur: BriefInvestisseurApi,
  comptable_hypotheses: ComptableHypotheses,
  comptable_lecture: ComptableLecture,
  brief_juriste: BriefJuristeApi,
  brief_concurrent: BriefConcurrentApi,
  brief_cliente: BriefClienteApi,
  debat: DebateTurnApi,
  ruling: Ruling,
  revote: Revote,
} as const;
