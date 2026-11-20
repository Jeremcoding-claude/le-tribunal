/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LlmError } from "@/lib/llm/types";
import { creerStoreFichiers } from "@/lib/store/fichiers";
import { creerStoreMemoire } from "@/lib/store/memoire";
import { transition, transitionAutorisee, TransitionInterdite, phaseSuivante } from "@/lib/trial/state-machine";
import { CHOIX_PROJET, TEXTE_HOMONYMES, TEXTE_PRIX } from "@/lib/trial/questions";
import { runTrial } from "@/lib/trial/run";
import { AGENTS_JURES } from "@/lib/schemas";
import { clientTest, fix, SAISIE_REFERENCE, sourcesMock } from "../helpers";

/** Le Juge MOCK est statique : quand un juré est absent, on adapte sa réponse (sources et objections réellement proposées). */
function jugeAdaptatif(r: any, p: { mission: string }) {
  const donnees = JSON.parse(p.mission.split("DONNÉES\n")[1].split("\n\nRAPPEL")[0]);
  const propositions = new Set((donnees.propositions_tour_2 as { id: string }[]).map((x) => x.id));
  for (const c of r.plan_corrige.changements) {
    if (!propositions.has(c.source)) c.source = "juge";
    // Un nombre qu'aucune affirmation vérifiée ne porte (ici le prix de la Cliente absente) serait rejeté : le Juge n'en écrit plus.
    if (/[0-9]/.test(c.avant + c.apres)) {
      c.avant = "le prix saisi";
      c.apres = "un prix d'entrée revu à la baisse";
    }
  }
  r.reponses_objections = (donnees.objections_classees as { id: string }[]).slice(0, 3).map((o) => ({ objection: o.id, decision: "refus", justification: "Le refus est motivé par les faits déjà versés au dossier.", appuis: ["CPT-3"] }));
  return r;
}

const lancer = (client = clientTest(), texte = SAISIE_REFERENCE, o: Partial<Parameters<typeof runTrial>[1]> = {}) =>
  runTrial(texte, { client, sources: sourcesMock(), id: `t-${Math.random().toString(36).slice(2, 8)}`, ...o });

describe("G2 · sealed-votes : aucune note d'un autre juré dans un prompt de débat", () => {
  it("les messages MISSION du débat (tours 1 et 2) ne contiennent ni note, ni verdict, ni raison de vote", async () => {
    const client = clientTest();
    await lancer(client);
    const debats = client.appels.filter((a) => a.phase === "DEBAT");
    expect(debats).toHaveLength(10);
    const votes = AGENTS_JURES.map((a) => fix(`instruction/${a}.json`).vote);
    for (const d of debats) {
      expect(d.mission).not.toMatch(/"note"|"verdict"|"vote"|raison_principale|votre_vote/);
      for (const v of votes) expect(d.mission).not.toContain(v.raison_principale);
    }
  });

  it("le tour 2 ne montre que les répliques du tour 1 qui visent le juré", async () => {
    const client = clientTest();
    await lancer(client);
    const t2 = client.appels.find((a) => a.phase === "DEBAT" && a.tour === 2 && a.agent === "investisseur")!;
    expect(t2.mission).toContain("repliques_visant_ce_jure");
    const t1 = client.appels.find((a) => a.phase === "DEBAT" && a.tour === 1 && a.agent === "investisseur")!;
    expect(t1.mission).not.toContain("repliques_visant_ce_jure");
  });

  it("seul le revote montre au juré SON PROPRE vote 1", async () => {
    const client = clientTest();
    await lancer(client);
    const rv = client.appels.find((a) => a.phase === "REVOTE" && a.agent === "cliente")!;
    expect(rv.mission).toContain("votre_vote_1");
    expect(rv.mission).not.toContain(fix("instruction/investisseur.json").vote.raison_principale);
  });
});

describe("G7 · juror-crash et two-crashes : le quorum décide", () => {
  const panne = (...agents: string[]) =>
    clientTest({
      avant: (p) => {
        if (p.phase === "INSTRUCTION" && agents.includes(p.agent)) throw new LlmError("panne simulée");
      },
      apres: (p, r) => {
        if (p.phase === "CORRECTION") jugeAdaptatif(r.sortie, p);
        return r;
      },
    });

  it("1 juré plante : procès complet, 4/5", async () => {
    const r = await lancer(panne("juriste"));
    expect(r.statut).toBe("termine");
    expect(r.etat!.absents).toEqual(["juriste"]);
    expect(Object.keys(r.etat!.votes1!)).toHaveLength(4);
    expect(Object.keys(r.etat!.votes2!)).toHaveLength(4);
    expect(r.etat!.resultat!.quorumAvant && r.etat!.resultat!.quorumApres).toBe(true);
    expect(r.evenements.filter((e) => e.type === "vote_sealed")).toHaveLength(4);
    expect(r.evenements.some((e) => e.type === "agent_status" && e.statut === "absent")).toBe(true);
  });

  it("2 jurés plantent : procès ajourné, aucun débat ni correction", async () => {
    const r = await lancer(panne("juriste", "concurrent"));
    expect(r.statut).toBe("ajourne");
    expect(r.etat!.resultat!.verdictJury).toBe("AJOURNE");
    expect(r.etat!.resultat!.phrase).toBe("Procès ajourné.");
    const types = r.evenements.map((e) => e.type);
    expect(types).not.toContain("debate_reply");
    expect(types).not.toContain("ruling");
    expect(types).toContain("verdict");
  });

  it("une sortie qui ne passe pas les contrôles est relancée UNE fois, puis le juré est absent", async () => {
    let essais = 0;
    const client = clientTest({
      apres: (p, r) => {
        if (p.phase === "CORRECTION") jugeAdaptatif(r.sortie, p);
        if (p.phase === "INSTRUCTION" && p.agent === "cliente") {
          essais++;
          (r.sortie as { vote: { appuis: string[] } }).vote.appuis = ["CLI-1", "CLI-99"]; // un seul appui vérifiable
        }
        return r;
      },
    });
    const r = await lancer(client);
    expect(essais).toBe(2);
    expect(r.etat!.absents).toEqual(["cliente"]);
    expect(r.statut).toBe("termine");
  });
});

describe("G7 · resume : arrêt après P3, reprise → P4 sans refaire P2", () => {
  it("reprend à la phase suivante et rend le même verdict qu'un procès complet", async () => {
    const store = creerStoreMemoire();
    const premier = clientTest();
    const a = await runTrial(SAISIE_REFERENCE, { client: premier, sources: sourcesMock(), store, id: "reprise", arretApres: "P3" });
    expect(a.statut).toBe("interrompu");
    expect(a.etat!.phase).toBe("P3");
    expect(a.etat!.ruling).toBeUndefined();

    const second = clientTest();
    const b = await runTrial(SAISIE_REFERENCE, { client: second, sources: sourcesMock(), store, id: "reprise", reprendre: true });
    expect(b.statut).toBe("termine");
    const phasesRefaites = new Set(second.appels.map((c) => c.phase));
    expect(phasesRefaites.has("INSTRUCTION")).toBe(false);
    expect(phasesRefaites.has("DEBAT")).toBe(false);
    expect(phasesRefaites.has("CORRECTION")).toBe(true);

    const complet = await lancer();
    expect(b.etat!.resultat).toEqual(complet.etat!.resultat);
    // les événements continuent la même suite de numéros
    b.evenements.forEach((e, i) => expect(e.seq).toBe(i));
  });

  it("reprendre sans point de sauvegarde est un échec clair", async () => {
    const r = await runTrial("x", { client: clientTest(), sources: sourcesMock(), store: creerStoreMemoire(), id: "inconnu", reprendre: true });
    expect(r.statut).toBe("echec");
  });

  it("le store fichiers garde l'état et les événements dans .tribunal/<id>/", async () => {
    const racine = mkdtempSync(join(tmpdir(), "tribunal-"));
    const store = creerStoreFichiers(racine);
    const a = await runTrial(SAISIE_REFERENCE, { client: clientTest(), sources: sourcesMock(), store, id: "fich", arretApres: "P2" });
    expect(a.statut).toBe("interrompu");
    const lu = await store.dernierEtat("fich");
    expect(lu?.phase).toBe("P2");
    expect((await store.evenements("fich")).length).toBeGreaterThan(5);
    expect(JSON.stringify(lu)).not.toMatch(/sk-ant/);
    await expect(store.dernierEtat("../evasion")).rejects.toThrow(/invalide/);
  });
});

describe("G10 · questions de mise en état (texte fixe, 2 au plus, « passer »)", () => {
  const sansPrix = "Brigade IA, agents IA, aux restaurants indépendants, Lyon";
  // Le Greffier rend ce que le procès sans prix devrait donner : aucun prix dans la saisie confirmée ni dans le dossier.
  const sansPrixMock = () =>
    clientTest({
      apres: (p, r) => {
        const s = r.sortie as Record<string, any>;
        if (p.phase === "IDENTIFICATION") s.saisie_confirmee.prix = null;
        if (p.phase === "MISE_EN_ETAT") s.case_file.prix = { montant: null, devise: "EUR", periode: "inconnue", ht_ou_ttc: "inconnu", origine: "non_communique" };
        return r;
      },
    });

  it("missing-price-question : pas de prix → 1 question ; « passer » → comptes partiels (L1 non calculable)", async () => {
    const r = await lancer(sansPrixMock(), sansPrix);
    const q = r.evenements.find((e) => e.type === "questions") as { questions: { code: string; texte: string }[] };
    expect(q.questions).toEqual([{ code: "prix_absent", texte: TEXTE_PRIX, choix: [] }]);
    expect(r.etat!.reponses).toEqual([{ code: "prix_absent", reponse: null }]);
    expect(r.etat!.miseEnEtat!.case_file.prix.origine).toBe("non_communique");
    expect(r.etat!.ledger!.find((l) => l.ligne === "L1")!.statut).toBe("non_calculable");
    expect(r.etat!.ledger!.find((l) => l.ligne === "L10")!.statut).toBe("non_calculable");
  });

  it("une réponse de prix illisible est redemandée UNE fois", async () => {
    let appels = 0;
    const r = await lancer(sansPrixMock(), sansPrix, {
      repondre: async (qs) => {
        appels++;
        return qs.map((q) => ({ code: q.code, reponse: appels === 1 ? "pas cher" : "cent euros" }));
      },
    });
    expect(appels).toBe(2);
    expect(r.etat!.reponses).toEqual([{ code: "prix_absent", reponse: "cent euros" }]); // toujours illisible : on n'insiste plus
  });

  const homonymes = () =>
    clientTest({
      apres: (p, r) => {
        const s = r.sortie as Record<string, any>;
        if (p.phase === "IDENTIFICATION") {
          s.identification.statut = "homonymes";
          const c = (siren: string) => ({ denomination: `BRIGADE ${siren} (FICTIVE)`, siren, activite_naf: "62.01Z", commune: "Lyon", date_creation: "2020-01-01", etat: "active", source_url: `https://annuaire-entreprises.data.gouv.fr/entreprise/${siren}` });
          s.identification.correspondances = [c("999000071"), c("999000072")];
        }
        return r;
      },
    });

  it("homonyms-question : le choix d'une correspondance déclenche UNE seule relance du Greffier", async () => {
    const client = homonymes();
    const r = await lancer(client, SAISIE_REFERENCE, { repondre: async (qs) => qs.map((q) => ({ code: q.code, reponse: q.choix[0] })) });
    const q = (r.evenements.find((e) => e.type === "questions") as { questions: { code: string; texte: string; choix: string[] }[] }).questions;
    expect(q).toHaveLength(1);
    expect(q[0].texte).toBe(TEXTE_HOMONYMES);
    expect(q[0].choix).toEqual(["BRIGADE 999000071 (FICTIVE) — 62.01Z — Lyon", "BRIGADE 999000072 (FICTIVE) — 62.01Z — Lyon", CHOIX_PROJET]);
    expect(client.appels.filter((a) => a.phase === "IDENTIFICATION_COMPLEMENT")).toHaveLength(1);
    expect(r.etat!.identification!.statut).toBe("entreprise_existante");
  });

  it("« aucune, c'est un projet » : statut aucune_trace, aucune relance", async () => {
    const client = homonymes();
    const r = await lancer(client, SAISIE_REFERENCE, { repondre: async (qs) => qs.map((q) => ({ code: q.code, reponse: CHOIX_PROJET })) });
    expect(client.appels.filter((a) => a.phase === "IDENTIFICATION_COMPLEMENT")).toHaveLength(0);
    expect(r.etat!.identification!.statut).toBe("aucune_trace");
  });

  it("« passer » : le statut reste homonymes, cité comme incertitude", async () => {
    const r = await lancer(homonymes());
    expect(r.etat!.identification!.statut).toBe("homonymes");
    expect(r.statut).toBe("termine");
  });

  it("max-questions : jamais plus de 2 questions, jamais un texte hors liste fixe", async () => {
    const client = clientTest({
      apres: (p, r) => {
        const s = r.sortie as Record<string, any>;
        if (p.phase === "IDENTIFICATION") {
          s.saisie_confirmee.prix = null;
          s.identification.statut = "homonymes";
          s.identification.correspondances = [{ denomination: "A (FICTIVE)", siren: "999000081", activite_naf: "62.01Z", commune: "Lyon", date_creation: "2020-01-01", etat: "active", source_url: "https://annuaire-entreprises.data.gouv.fr/entreprise/999000081" }];
        }
        if (p.phase === "MISE_EN_ETAT") s.case_file.prix = { montant: null, devise: "EUR", periode: "inconnue", ht_ou_ttc: "inconnu", origine: "non_communique" };
        return r;
      },
    });
    const r = await lancer(client, sansPrix);
    const q = (r.evenements.find((e) => e.type === "questions") as { questions: { texte: string }[] }).questions;
    expect(q.length).toBeLessThanOrEqual(2);
    expect(q.map((x) => x.texte)).toEqual([TEXTE_PRIX, TEXTE_HOMONYMES]);
  });

  it("aucune question quand le prix est donné et l'identification nette", async () => {
    const r = await lancer();
    expect(r.evenements.some((e) => e.type === "questions")).toBe(false);
  });

  it("homonyms : plusieurs correspondances au registre mais « entreprise_existante » → rejet, jamais un choix au hasard", async () => {
    const deux = {
      registre: async () => ({
        results: ["999000091", "999000092"].map((siren) => ({ siren, nom_complet: `BRIGADE ${siren} (FICTIVE)`, activite_principale: "62.01Z", date_creation: "2020-01-01", etat_administratif: "A", nature_juridique: "5710", siege: { libelle_commune: "LYON" } })),
      }),
      commune: async () => [{ nom: "Lyon", code: "69123", codeDepartement: "69", population: 1, departement: { code: "69", nom: "Rhône" } }],
    };
    const client = clientTest({ apres: (p, r) => ((p.phase === "IDENTIFICATION" ? ((r.sortie as any).identification.statut = "entreprise_existante") : 0), r) });
    const r = await runTrial(SAISIE_REFERENCE, { client, sources: deux, id: "homonymes-choix" });
    expect(r.statut).toBe("echec");
    expect(r.message).toContain("homonymes");
  });

  it("greffier-adds-field : un Greffier qui invente une cible absente de la saisie → rejet", async () => {
    const client = clientTest({ apres: (p, r) => ((p.phase === "IDENTIFICATION" ? ((r.sortie as any).saisie_confirmee.cible = "chats volants") : 0), r) });
    const r = await lancer(client);
    expect(r.statut).toBe("echec");
    expect(r.message).toContain("n'est pas un extrait de la saisie");
  });

  it("output-pii : un Greffier qui écrit un e-mail → rejet (G9)", async () => {
    const client = clientTest({ apres: (p, r) => ((p.phase === "IDENTIFICATION" ? ((r.sortie as any).identification.ecarts = ["contact : gerant@exemple.test"]) : 0), r) });
    const r = await lancer(client);
    expect(r.statut).toBe("echec");
    expect(r.message).toContain("adresse e-mail");
  });
});

describe("machine à états : seules les transitions du plan", () => {
  it("avance d'une phase à la fois", () => {
    expect(transitionAutorisee("DEBUT", "P0")).toBe(true);
    expect(transitionAutorisee("P2", "P3")).toBe(true);
    expect(transitionAutorisee("P2", "P4")).toBe(false);
    expect(transitionAutorisee("P4", "P3")).toBe(false);
    expect(transitionAutorisee("P6", "TERMINE")).toBe(true);
    expect(() => transition("P1a", "P2")).toThrow(TransitionInterdite);
  });
  it("l'échec et l'ajournement sont possibles depuis toute phase, jamais depuis un état final", () => {
    expect(transitionAutorisee("P3", "ECHEC")).toBe(true);
    expect(transitionAutorisee("P2", "AJOURNE")).toBe(true);
    expect(transitionAutorisee("TERMINE", "P0")).toBe(false);
    expect(transitionAutorisee("ECHEC", "P3")).toBe(false);
  });
  it("phaseSuivante reprend après un point de sauvegarde", () => {
    expect(phaseSuivante("DEBUT")).toBe("P0");
    expect(phaseSuivante("P3")).toBe("P4");
    expect(phaseSuivante("P6")).toBeNull();
  });
});
