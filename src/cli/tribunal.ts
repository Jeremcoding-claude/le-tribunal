// CLI du Tribunal (plan v3.0, étape 9) : start | next | answer | submit | report | resume | run.
// Mode abonnement : le CLI est la machine à états, Claude Code (skill /tribunal:juger) n'est qu'un exécutant.
// Mode API : `run --api` enchaîne tout avec runTrial. Chaque commande imprime UN objet JSON sur la sortie standard.
// Aucun appel API payant sans `--api` explicite, et jamais de clé affichée (G8).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { cleAnthropicPresente } from "../lib/guardrails/config";
import { masquerCles } from "../lib/guardrails/redact";
import { creerClientReel } from "../lib/llm/client";
import { creerClientMock } from "../lib/llm/mock";
import { creerClientPlugin } from "../lib/llm/plugin";
import type { LlmClient } from "../lib/llm/types";
import { genererPdf } from "../lib/pdf/Report";
import { utiliserPromptsEmbarques } from "../lib/prompts/loader";
import { creerSourcesMock, creerSourcesReelles, type SourcesRegistre } from "../lib/registry";
import { Reponses, type Question } from "../lib/schemas";
import { lirePageHttp } from "../lib/search/lecture";
import { creerRechercheMock } from "../lib/search/mock";
import type { PageLue } from "../lib/search/types";
import { creerStoreFichiers } from "../lib/store/fichiers";
import type { Store } from "../lib/store/types";
import { decouperSaisie } from "../lib/trial/intake";
import type { Etat } from "../lib/trial/phases/contexte";
import { QuestionsEnAttente } from "../lib/trial/phases/contexte";
import { runTrial, type ResultatProces } from "../lib/trial/run";

export type Resultat = Record<string, unknown> & { status: string };

interface Meta {
  texte: string;
  mock: boolean;
}

interface Args {
  commande: string;
  positionnels: string[];
  drapeaux: Record<string, string | true>;
}

function analyser(argv: string[]): Args {
  const [premier, ...reste] = argv;
  const commande = premier && !premier.startsWith("--") ? premier : "run";
  const brut = premier && !premier.startsWith("--") ? reste : argv;
  const positionnels: string[] = [];
  const drapeaux: Record<string, string | true> = {};
  const AVEC_VALEUR = new Set(["trial", "reponses"]);
  for (let i = 0; i < brut.length; i++) {
    const a = brut[i];
    if (a.startsWith("--")) {
      const nom = a.slice(2);
      if (AVEC_VALEUR.has(nom)) drapeaux[nom] = brut[++i] ?? "";
      else drapeaux[nom] = true;
    } else positionnels.push(a);
  }
  return { commande, positionnels, drapeaux };
}

const dossierDe = (cwd: string, id: string) => join(cwd, ".tribunal", id);
const ID_SUR = /^[A-Za-z0-9_-]{1,64}$/;

function lireMeta(cwd: string, id: string): Meta {
  const f = join(dossierDe(cwd, id), "meta.json");
  if (!ID_SUR.test(id) || !existsSync(f)) throw new ErreurCli(`Procès inconnu : « ${id} ». Lance d'abord « start ».`);
  return JSON.parse(readFileSync(f, "utf8")) as Meta;
}

class ErreurCli extends Error {}

function sourcesDe(cwd: string, mock: boolean): { sources: SourcesRegistre; lire: (url: string) => Promise<PageLue> } {
  return mock
    ? { sources: creerSourcesMock({ racine: cwd }), lire: (u) => creerRechercheMock({ racine: cwd }).lire(u) }
    : { sources: creerSourcesReelles(), lire: (u) => lirePageHttp(u) };
}

/** Les réponses de P1b, par tour de questions : le moteur les redemande (prix illisible) comme un 2e tour. */
function repondreDepuisFichier(dossier: string) {
  return async (qs: Question[]): Promise<Reponses> => {
    const f = join(dossier, "answers.json");
    const tours: Reponses[] = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : [];
    const lues = (this_ as { n: number }).n++;
    if (tours[lues]) return tours[lues].filter((r) => qs.some((q) => q.code === r.code));
    writeFileSync(join(dossier, "questions.json"), JSON.stringify(qs, null, 2));
    throw new QuestionsEnAttente(qs);
  };
}
const this_ = { n: 0 };

function resumeFinal(etat: Etat | undefined) {
  const r = etat?.resultat;
  return {
    verdict: r?.verdictJury ?? null,
    phrase: r?.phrase ?? null,
    noteAvant: r?.noteAvant ?? null,
    noteApres: r?.noteApres ?? null,
    condition1: etat?.ruling?.conditions_pour_lancer[0]?.condition ?? null,
    texte: r?.texte ?? null,
  };
}

async function rejouer(cwd: string, id: string): Promise<{ r: ResultatProces; client: ReturnType<typeof creerClientPlugin>; avant: number }> {
  const meta = lireMeta(cwd, id);
  const dossier = dossierDe(cwd, id);
  const store = creerStoreFichiers(join(cwd, ".tribunal"));
  const client = creerClientPlugin({ dossier });
  const { sources, lire } = sourcesDe(cwd, meta.mock);
  this_.n = 0;
  const avant = (await store.evenements(id)).length;
  const r = await runTrial(meta.texte, { client, sources, store, id, reprendre: true, repondre: repondreDepuisFichier(dossier), lire });
  return { r, client, avant };
}

function interpreter(id: string, r: ResultatProces, client: ReturnType<typeof creerClientPlugin>): Resultat {
  switch (r.statut) {
    case "en_attente": {
      const tasks = client.tachesEnAttente();
      return { status: "tasks", trial: id, phase: tasks[0]?.phase ?? null, tasks };
    }
    case "questions":
      return { status: "questions", trial: id, questions: (r.questions ?? []).map((q) => ({ id: q.code, texte: q.texte, ...(q.choix.length > 0 && { choix: q.choix }) })) };
    case "termine":
    case "ajourne":
      return { status: "done", trial: id, ...resumeFinal(r.etat) };
    default:
      return { status: "echec", trial: id, message: r.message ?? r.statut };
  }
}

// ───────────── Commandes ─────────────

async function start(a: Args, cwd: string): Promise<Resultat> {
  const texte = a.positionnels.join(" ").trim();
  const d = decouperSaisie(texte);
  if (!d.ok) return { status: "saisie_incomplete", manque: d.manque, format: d.format, exemple: d.exemple, message: d.message };
  const id = `t-${Date.now().toString(36)}`;
  mkdirSync(dossierDe(cwd, id), { recursive: true });
  const meta: Meta = { texte, mock: a.drapeaux.mock === true };
  writeFileSync(join(dossierDe(cwd, id), "meta.json"), JSON.stringify(meta, null, 2));
  await creerStoreFichiers(join(cwd, ".tribunal")).sauvegarder(id, "DEBUT", { id, texte, phase: "DEBUT" });
  return { status: "started", trial: id, saisie: d.saisie, dossier: dossierDe(cwd, id) };
}

async function suivant(a: Args, cwd: string): Promise<Resultat> {
  const id = String(a.drapeaux.trial ?? "");
  const { r, client } = await rejouer(cwd, id);
  return interpreter(id, r, client);
}

async function repondre(a: Args, cwd: string): Promise<Resultat> {
  const id = String(a.drapeaux.trial ?? "");
  lireMeta(cwd, id);
  const dossier = dossierDe(cwd, id);
  const fq = join(dossier, "questions.json");
  if (!existsSync(fq)) throw new ErreurCli("Aucune question en attente : lance « next » d'abord.");
  const qs = JSON.parse(readFileSync(fq, "utf8")) as Question[];
  let reponses: Reponses;
  if (a.drapeaux.passer) reponses = qs.map((q) => ({ code: q.code, reponse: null }));
  else {
    let brut: unknown;
    try {
      brut = JSON.parse(String(a.drapeaux.reponses ?? ""));
    } catch {
      throw new ErreurCli("--reponses attend du JSON : [{\"code\":\"prix_absent\",\"reponse\":\"149 € par mois\"}] ou {\"prix_absent\":\"…\"}.");
    }
    const liste = Array.isArray(brut) ? brut : Object.entries(brut as Record<string, unknown>).map(([code, reponse]) => ({ code, reponse }));
    const p = Reponses.safeParse(liste);
    if (!p.success) throw new ErreurCli(`Réponses invalides : ${p.error.issues[0]?.message}`);
    const inconnu = p.data.find((r) => !qs.some((q) => q.code === r.code));
    if (inconnu) throw new ErreurCli(`Réponse à une question qui n'a pas été posée : ${inconnu.code}.`);
    reponses = qs.map((q) => p.data.find((r) => r.code === q.code) ?? { code: q.code, reponse: null });
  }
  const fa = join(dossier, "answers.json");
  const tours: Reponses[] = existsSync(fa) ? JSON.parse(readFileSync(fa, "utf8")) : [];
  writeFileSync(fa, JSON.stringify([...tours, reponses], null, 2));
  return { status: "answered", trial: id };
}

async function soumettre(a: Args, cwd: string): Promise<Resultat> {
  const id = String(a.drapeaux.trial ?? "");
  const { r, client, avant } = await rejouer(cwd, id);
  const nouveaux = r.evenements.slice(avant);
  const acceptees = nouveaux.filter((e) => e.type === "source_verified").length;
  const rejetees = nouveaux.filter((e) => e.type === "source_rejected").length;
  const incidents = nouveaux.filter((e) => e.type === "error").length;
  const tasksDir = join(dossierDe(cwd, id), "tasks");
  const inattendus = existsSync(tasksDir) ? readdirSync(tasksDir).filter((f) => f.endsWith(".output.json") && !existsSync(join(tasksDir, f.replace(".output.json", ".input.md")))) : [];
  const suite = interpreter(id, r, client);
  const relances = suite.status === "tasks" ? (suite.tasks as { tentative: number }[]).filter((t) => t.tentative > 1).length : 0;
  const resume = `Sources acceptées : ${acceptees} ; rejetées : ${rejetees} ; incidents : ${incidents} ; tâches à relancer : ${relances}${inattendus.length ? ` ; fichiers inattendus ignorés : ${inattendus.join(", ")}` : ""}.`;
  return { ...suite, resume };
}

async function rapport(a: Args, cwd: string): Promise<Resultat> {
  const id = String(a.drapeaux.trial ?? "");
  lireMeta(cwd, id);
  const etat = (await creerStoreFichiers(join(cwd, ".tribunal")).dernierEtat(id))?.etat as Etat | undefined;
  if (!etat?.resultat) throw new ErreurCli("Le procès n'est pas terminé : « next » doit rendre « done » avant « report ».");
  const pdf = join(dossierDe(cwd, id), "rapport.pdf");
  writeFileSync(pdf, await genererPdf(etat, { date: new Date().toISOString().slice(0, 10) }));
  return { status: "report", trial: id, pdf, ...resumeFinal(etat) };
}

async function questionsInteractives(qs: Question[]): Promise<Reponses> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const reponses: Reponses = [];
  for (const q of qs) {
    process.stderr.write(`\n${q.texte}\n`);
    q.choix.forEach((c, i) => process.stderr.write(`  ${i + 1}. ${c}\n`));
    const r = (await rl.question("Votre réponse (vide pour passer) : ")).trim();
    const n = Number(r);
    reponses.push({ code: q.code, reponse: r === "" ? null : q.choix.length && Number.isInteger(n) && q.choix[n - 1] ? q.choix[n - 1] : r });
  }
  rl.close();
  return reponses;
}

async function lancer(a: Args, cwd: string): Promise<Resultat> {
  const texte = a.positionnels.join(" ").trim();
  const mock = a.drapeaux.mock === true;
  const api = a.drapeaux.api === true;
  if (mock === api) throw new ErreurCli("Précise le mode : --mock (aucun appel payant) ou --api (vrais appels, clé dans ANTHROPIC_API_KEY).");
  if (api && !cleAnthropicPresente()) throw new ErreurCli("--api exige la variable d'environnement ANTHROPIC_API_KEY (elle n'est jamais affichée ni écrite).");
  const d = decouperSaisie(texte);
  if (!d.ok) return { status: "saisie_incomplete", manque: d.manque, format: d.format, exemple: d.exemple, message: d.message };

  const client: LlmClient = mock ? creerClientMock({ racine: cwd }) : creerClientReel();
  const { sources } = sourcesDe(cwd, mock);
  const store: Store = creerStoreFichiers(join(cwd, ".tribunal"));
  const interactif = a.drapeaux["sans-questions"] !== true && Boolean(process.stdin.isTTY);
  const id = `t-${Date.now().toString(36)}`;
  mkdirSync(dossierDe(cwd, id), { recursive: true });
  const r = await runTrial(texte, { client, sources, store, id, repondre: interactif ? questionsInteractives : undefined });
  if (r.statut !== "termine" && r.statut !== "ajourne") return { status: "echec", trial: id, message: r.message ?? r.statut };
  const pdf = join(dossierDe(cwd, id), "rapport.pdf");
  writeFileSync(pdf, await genererPdf(r.etat!, { date: new Date().toISOString().slice(0, 10) }));
  return { status: "done", trial: id, pdf, coutUsd: r.etat!.coutUsd ?? 0, ...resumeFinal(r.etat) };
}

/** Exécute une commande. `cwd` est le dossier de l'utilisateur : `.tribunal/` y est créé. */
export async function executer(argv: string[], cwd = process.cwd()): Promise<Resultat> {
  utiliserPromptsEmbarques();
  const a = analyser(argv);
  try {
    switch (a.commande) {
      case "start": return await start(a, cwd);
      case "next":
      case "resume": return await suivant(a, cwd);
      case "answer": return await repondre(a, cwd);
      case "submit": return await soumettre(a, cwd);
      case "report": return await rapport(a, cwd);
      case "run": return await lancer(a, cwd);
      default: throw new ErreurCli(`Commande inconnue : « ${a.commande} ». Commandes : start, next, answer, submit, report, resume, run.`);
    }
  } catch (e) {
    return { status: "erreur", message: masquerCles((e as Error).message) };
  }
}

async function main() {
  const r = await executer(process.argv.slice(2));
  console.log(JSON.stringify(r, null, 2));
  if (r.status === "erreur" || r.status === "echec") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
