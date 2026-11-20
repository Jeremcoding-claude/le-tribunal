/* eslint-disable @typescript-eslint/no-explicit-any */
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { executer, type Resultat } from "@/cli/tribunal";
import { fichierFixture } from "@/lib/llm/mock";
import { runTrial } from "@/lib/trial/run";
import { clientTest, SAISIE_REFERENCE, sourcesMock } from "../helpers";

// La boucle du mode abonnement, sans Claude Code : le test joue les sous-agents avec les fixtures.
const nouveauDossier = () => {
  const d = mkdtempSync(join(tmpdir(), "tribunal-cli-"));
  cpSync(join(process.cwd(), "fixtures"), join(d, "fixtures"), { recursive: true });
  return d;
};

interface Tache {
  agent: string;
  phase: string;
  tour: number | null;
  tentative: number;
  input: string;
  output: string;
}

type Modif = (t: Tache, sortie: any) => any;

/** Joue un sous-agent : lit son fichier d'entrée, écrit son JSON dans le fichier de sortie (la fixture du cas de référence). */
function jouer(cwd: string, t: Tache, modif?: Modif) {
  const agent = t.agent.replace("tribunal:", "") as any;
  const mission = readFileSync(t.input, "utf8");
  expect(mission).toContain(`phase: ${t.phase}`);
  expect(mission).toContain(`fichier_sortie: ${t.output}`);
  let sortie = JSON.parse(readFileSync(join(cwd, "fixtures/restaurants", fichierFixture(agent, t.phase as any, (t.tour ?? undefined) as any)), "utf8"));
  if (agent === "comptable" && t.phase === "INSTRUCTION") sortie = { agent: "comptable", affirmations: sortie.affirmations, hypotheses: sortie.hypotheses, lacunes: sortie.lacunes, alertes: sortie.alertes };
  const final = modif ? modif(t, sortie) : sortie;
  writeFileSync(t.output, typeof final === "string" ? final : JSON.stringify(final));
}

async function boucle(cwd: string, trial: string, o: { modif?: Modif; reponse?: (r: Resultat) => Promise<void> } = {}) {
  const phases: string[][] = [];
  let r = await executer(["next", "--trial", trial], cwd);
  for (let i = 0; i < 60; i++) {
    if (r.status === "tasks") {
      const tasks = r.tasks as Tache[];
      phases.push(tasks.map((t) => `${t.phase}:${t.agent.replace("tribunal:", "")}`));
      for (const t of tasks) jouer(cwd, t, o.modif);
      r = await executer(["submit", "--trial", trial], cwd);
    } else if (r.status === "questions") {
      await o.reponse!(r);
      r = await executer(["next", "--trial", trial], cwd);
    } else break;
  }
  return { r, phases };
}

describe("boucle du mode abonnement : start → next → sous-agents → submit → report", () => {
  it("un procès complet : mêmes résultats que le mode API en MOCK, PDF produit", async () => {
    const cwd = nouveauDossier();
    const s = await executer(["start", SAISIE_REFERENCE, "--mock"], cwd);
    expect(s.status).toBe("started");
    const { r, phases } = await boucle(cwd, s.trial as string);
    expect(r.status).toBe("done");

    // Chaque phase ne démarre qu'une fois la précédente validée ; les jurés partent EN PARALLÈLE, dans une seule liste.
    const ordre = phases.map((p) => p.map((x) => x.split(":")[0]).filter((v, i, a) => a.indexOf(v) === i)[0]);
    expect(ordre).toEqual(["IDENTIFICATION", "MISE_EN_ETAT", "INSTRUCTION", "LECTURE", "DEBAT", "DEBAT", "CORRECTION", "REVOTE"]);
    expect(phases[2].sort()).toEqual(["INSTRUCTION:cliente", "INSTRUCTION:comptable", "INSTRUCTION:concurrent", "INSTRUCTION:investisseur", "INSTRUCTION:juriste"]);
    expect(phases[4]).toHaveLength(5);

    const api = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), id: "ref" });
    expect(r.noteAvant).toBe(api.etat!.resultat!.noteAvant);
    expect(r.noteApres).toBe(api.etat!.resultat!.noteApres);
    expect(r.phrase).toBe(api.etat!.resultat!.phrase);

    const rep = await executer(["report", "--trial", s.trial as string], cwd);
    expect(rep.status).toBe("report");
    expect(existsSync(rep.pdf as string)).toBe(true);
    expect(readFileSync(rep.pdf as string).subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(rep.condition1).toContain("9 restaurants");
  });

  it("next ne donne jamais la phase suivante tant que la phase n'est pas validée (idempotent)", async () => {
    const cwd = nouveauDossier();
    const s = await executer(["start", SAISIE_REFERENCE, "--mock"], cwd);
    const a = await executer(["next", "--trial", s.trial as string], cwd);
    const b = await executer(["next", "--trial", s.trial as string], cwd);
    expect(a.status).toBe("tasks");
    expect((a.tasks as Tache[]).map((t) => t.agent)).toEqual(["tribunal:greffier-enquete"]);
    expect(b.tasks).toEqual(a.tasks);
    // sans sortie du sous-agent, submit renvoie la même tâche et rien d'autre
    const c = await executer(["submit", "--trial", s.trial as string], cwd);
    expect((c.tasks as Tache[]).map((t) => t.agent)).toEqual(["tribunal:greffier-enquete"]);
  });

  it("une saisie à 3 éléments déclenche la demande de l'élément manquant", async () => {
    const r = await executer(["start", "Brigade IA, agents IA, Lyon", "--mock"], nouveauDossier());
    expect(r.status).toBe("saisie_incomplete");
    expect(r.manque).toEqual(["cible"]);
    expect(r.format).toContain("Nom, ce qu'il vend");
    expect(r.exemple).toContain("Brigade IA");
  });

  it("sans prix : la question prix_absent est posée mot pour mot ; « passer » → comptes partiels", async () => {
    const cwd = nouveauDossier();
    const s = await executer(["start", "Brigade IA, agents IA, aux restaurants indépendants, Lyon", "--mock"], cwd);
    const sansPrix: Modif = (t, sortie) => {
      if (t.phase === "IDENTIFICATION") sortie.saisie_confirmee.prix = null;
      if (t.phase === "MISE_EN_ETAT") sortie.case_file.prix = { montant: null, devise: "EUR", periode: "inconnue", ht_ou_ttc: "inconnu", origine: "non_communique" };
      // Sans prix, la ligne L10 n'existe pas : le Juge ne peut plus écrire « 9 restaurants » (nombre sans source).
      if (t.phase === "CORRECTION") sortie.conditions_pour_lancer[0].condition = "Obtenir des restaurants pilotes payants avant tout budget d'acquisition";
      return sortie;
    };
    let questions: any[] = [];
    const { r } = await boucle(cwd, s.trial as string, {
      modif: sansPrix,
      reponse: async (q) => {
        questions = q.questions as any[];
        expect((await executer(["answer", "--trial", s.trial as string, "--passer"], cwd)).status).toBe("answered");
      },
    });
    expect(questions).toEqual([{ id: "prix_absent", texte: "Quel est le prix, et sa fréquence ? (ex. 149 € par mois, 30 € par commande)" }]);
    expect(r.status).toBe("done");
    const etat = JSON.parse(readFileSync(join(cwd, ".tribunal", s.trial as string, "etat.json"), "utf8")).etat;
    expect(etat.ledger.find((l: any) => l.ligne === "L1").statut).toBe("non_calculable");
  });

  it("une réponse valide à la question est enregistrée, une question non posée est refusée", async () => {
    const cwd = nouveauDossier();
    const s = await executer(["start", "Brigade IA, agents IA, aux restaurants indépendants, Lyon", "--mock"], cwd);
    const t = s.trial as string;
    expect((await executer(["answer", "--trial", t, "--passer"], cwd)).status).toBe("erreur"); // aucune question en attente
    // on amène le procès jusqu'à la question
    const sansPrix: Modif = (tt, sortie) => {
      if (tt.phase === "IDENTIFICATION") sortie.saisie_confirmee.prix = null;
      return sortie;
    };
    let r = await executer(["next", "--trial", t], cwd);
    jouer(cwd, (r.tasks as Tache[])[0], sansPrix);
    r = await executer(["submit", "--trial", t], cwd);
    expect(r.status).toBe("questions");
    expect((await executer(["answer", "--trial", t, "--reponses", '{"homonymes":"x"}'], cwd)).message).toContain("qui n'a pas été posée");
    expect((await executer(["answer", "--trial", t, "--reponses", "pas du json"], cwd)).status).toBe("erreur");
    expect((await executer(["answer", "--trial", t, "--reponses", '{"prix_absent":"149 € par mois"}'], cwd)).status).toBe("answered");
    r = await executer(["next", "--trial", t], cwd);
    expect(r.status).toBe("tasks");
    expect((r.tasks as Tache[])[0].agent).toBe("tribunal:greffier-redaction");
  });

  it("une sortie refusée par le code devient une NOUVELLE tâche (tentative 2) ; submit le résume", async () => {
    const cwd = nouveauDossier();
    const s = await executer(["start", SAISIE_REFERENCE, "--mock"], cwd);
    const t = s.trial as string;
    let mauvais = true;
    let relance: Resultat | undefined;
    let r = await executer(["next", "--trial", t], cwd);
    for (let i = 0; i < 60 && (r.status === "tasks" || r.status === "questions"); i++) {
      const tasks = r.tasks as Tache[];
      for (const k of tasks) {
        jouer(cwd, k, (tt, sortie) => {
          if (tt.phase === "INSTRUCTION" && tt.agent === "tribunal:cliente" && tt.tentative === 1 && mauvais) sortie.vote.appuis = ["CLI-1", "CLI-99"];
          return sortie;
        });
      }
      r = await executer(["submit", "--trial", t], cwd);
      if (mauvais && r.status === "tasks" && (r.tasks as Tache[]).some((k) => k.tentative > 1)) {
        relance = r;
        mauvais = false;
      }
    }
    expect(relance).toBeDefined();
    expect((relance!.tasks as Tache[]).map((k) => `${k.agent}#${k.tentative}`)).toEqual(["tribunal:cliente#2"]);
    expect(relance!.resume).toContain("tâches à relancer : 1");
    expect(r.status).toBe("done");
  });

  it("un JSON illisible est traité comme une sortie refusée, pas comme un plantage", async () => {
    const cwd = nouveauDossier();
    const t = (await executer(["start", SAISIE_REFERENCE, "--mock"], cwd)).trial as string;
    const r = await executer(["next", "--trial", t], cwd);
    jouer(cwd, (r.tasks as Tache[])[0], () => "{pas du json");
    const s = await executer(["submit", "--trial", t], cwd);
    expect(s.status).toBe("tasks");
    expect((s.tasks as Tache[])[0].tentative).toBe(2);
  });

  it("un fichier de sortie inattendu est ignoré et signalé", async () => {
    const cwd = nouveauDossier();
    const t = (await executer(["start", SAISIE_REFERENCE, "--mock"], cwd)).trial as string;
    const r = await executer(["next", "--trial", t], cwd);
    writeFileSync(join(cwd, ".tribunal", t, "tasks", "INSTRUCTION-juge-0-1.output.json"), "{}");
    jouer(cwd, (r.tasks as Tache[])[0]);
    const s = await executer(["submit", "--trial", t], cwd);
    expect(s.resume).toContain("fichiers inattendus ignorés : INSTRUCTION-juge-0-1.output.json");
    expect((s.tasks as Tache[])[0].agent).toBe("tribunal:greffier-redaction");
  });

  it("report avant la fin, procès inconnu, commande inconnue : erreurs claires", async () => {
    const cwd = nouveauDossier();
    const t = (await executer(["start", SAISIE_REFERENCE, "--mock"], cwd)).trial as string;
    expect((await executer(["report", "--trial", t], cwd)).message).toContain("n'est pas terminé");
    expect((await executer(["next", "--trial", "../hors"], cwd)).message).toContain("Procès inconnu");
    expect((await executer(["fusion"], cwd)).message).toContain("Commande inconnue");
  });
});

describe("run : procès complet dans le terminal", () => {
  it("--mock : PDF produit, verdict affiché, aucun appel payant (la commande du critère de validation)", async () => {
    const cwd = nouveauDossier();
    const r = await executer(["--mock", SAISIE_REFERENCE], cwd);
    expect(r.status).toBe("done");
    expect(existsSync(r.pdf as string)).toBe(true);
    expect(r.verdict).toBe("PIVOT");
    expect(r.noteApres).toBeGreaterThan(r.noteAvant as number);
  });

  it("exige --mock ou --api, et la clé pour --api (jamais affichée)", async () => {
    const avant = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect((await executer(["run", SAISIE_REFERENCE], nouveauDossier())).message).toContain("Précise le mode");
      expect((await executer(["run", SAISIE_REFERENCE, "--api"], nouveauDossier())).message).toContain("ANTHROPIC_API_KEY");
      expect((await executer(["run", SAISIE_REFERENCE, "--api", "--mock"], nouveauDossier())).message).toContain("Précise le mode");
    } finally {
      if (avant !== undefined) process.env.ANTHROPIC_API_KEY = avant;
    }
  });

  it("une saisie incomplète est refusée avec le format", async () => {
    const r = await executer(["run", "Brigade IA, Lyon", "--mock"], nouveauDossier());
    expect(r.status).toBe("saisie_incomplete");
  });
});
