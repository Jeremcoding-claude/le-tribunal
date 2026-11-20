import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appliquer, etatInitial, etatSalle } from "@/components/salle/etat";
import { NOMS_EVENEMENTS } from "@/components/audience/evenements";
import { nomAffiche, PERSONNAGES } from "@/components/salle/personnages";
import { TrialEvent } from "@/lib/schemas";

// La logique de la salle : liste d'événements → état. Testée dans Vitest, sans WebGL ni navigateur (plan §12.5).
const evenements = (JSON.parse(readFileSync(join(process.cwd(), "fixtures/restaurants/events.json"), "utf8")) as unknown[]).map((e) => TrialEvent.parse(e));
const jusqua = (type: string) => evenements.slice(0, evenements.findIndex((e) => e.type === type));

describe("fixtures/restaurants/events.json (événements du procès MOCK)", () => {
  it("sont valides pour le schéma, numérotés sans trou, et finissent par le verdict", () => {
    expect(evenements.length).toBeGreaterThan(100);
    evenements.forEach((e, i) => expect(e.seq).toBe(i));
    expect(evenements.at(-1)!.type).toBe("verdict");
  });

  it("la liste des noms d'événements du navigateur égale les types du schéma", () => {
    const types = (TrialEvent as unknown as { options: { shape: { type: { value: string } } }[] }).options.map((o) => o.shape.type.value);
    expect([...NOMS_EVENEMENTS].sort()).toEqual([...types].sort());
  });
});

describe("etatSalle : événements → état de la salle", () => {
  const final = etatSalle(evenements);

  it("l'état initial : six personnages, rien d'ouvert", () => {
    const s = etatInitial();
    expect(Object.keys(s.acteurs).sort()).toEqual(["cliente", "comptable", "concurrent", "investisseur", "juge", "juriste"]);
    expect(s.phase).toBeNull();
    expect(s.verdict).toBeNull();
    expect(s.termine).toBe(false);
  });

  it("suit la phase, la carte d'identification et la Cliente créée pour le procès", () => {
    expect(final.phase).toBe("P6");
    expect(final.identification).toMatchObject({ statut: "aucune_trace", commune: "Lyon" });
    expect(final.prenomCliente).toBe("Sandrine");
    const cliente = PERSONNAGES.find((p) => p.acteur === "cliente")!;
    expect(nomAffiche(cliente, final.prenomCliente)).toBe("Sandrine");
    expect(nomAffiche(cliente, null)).toBe("La Cliente");
    expect(nomAffiche(PERSONNAGES[0], null)).toBe("Nadia");
  });

  it("compte les recherches et les sources vérifiées par juré, et garde l'adresse de chaque source", () => {
    const inv = final.acteurs.investisseur;
    expect(inv.recherches).toBeGreaterThan(0);
    expect(inv.sourcesVerifiees).toBe(3);
    expect(inv.sourcesRejetees).toBe(0);
    expect(final.sources["INV-1"]).toEqual({ url: "https://exemple.test/insee-restauration", domaine: "exemple.test" });
  });

  it("garde les deux tours de débat, le Ruling, le verdict et le coût", () => {
    expect(final.debat).toHaveLength(10);
    expect(final.ruling!.plan_corrige.changements).toHaveLength(3);
    expect(final.verdict).toMatchObject({ phrase: "Modifie ton plan.", verdict: "PIVOT" });
    expect(final.coutUsd).toBeGreaterThan(0);
    expect(final.termine).toBe(true);
    expect(final.evenements).toBe(evenements.length);
  });

  it("une erreur finale termine ; une alerte ne termine pas", () => {
    const base = { trial_id: "t", seq: 0, ts: "2026-11-20T10:00:00.000Z", type: "error", phase: null };
    const alerte = appliquer(etatInitial(), { ...base, code: "juré absent", message: "x" } as TrialEvent);
    expect(alerte.alertes).toEqual(["juré absent : x"]);
    expect(alerte.termine).toBe(false);
    const fin = appliquer(etatInitial(), { ...base, code: "echec", message: "panne" } as TrialEvent);
    expect(fin.termine).toBe(true);
    expect(fin.erreurFinale).toBe("panne");
  });

  it("les questions s'affichent puis disparaissent à la réponse", () => {
    const e = { trial_id: "t", seq: 0, ts: "2026-11-20T10:00:00.000Z" };
    const q = appliquer(etatInitial(), { ...e, type: "questions", questions: [{ code: "prix_absent", texte: "Quel prix ?", choix: [] }] } as TrialEvent);
    expect(q.questions).toHaveLength(1);
    expect(appliquer(q, { ...e, type: "answers_received", reponses: [] } as TrialEvent).questions).toBeNull();
  });

  it("est pure : l'état reçu n'est jamais modifié, et rejouer donne le même résultat", () => {
    const s = etatInitial();
    const copie = JSON.stringify(s);
    appliquer(s, evenements[0]);
    expect(JSON.stringify(s)).toBe(copie);
    expect(etatSalle(evenements)).toEqual(final);
  });

  it("direct et rejeu partagent le même résultat, quel que soit le découpage des événements", () => {
    const milieu = Math.floor(evenements.length / 2);
    const enDeuxTemps = evenements.slice(milieu).reduce(appliquer, etatSalle(evenements.slice(0, milieu)));
    expect(enDeuxTemps).toEqual(final);
  });

  it("les statuts des acteurs suivent agent_status", () => {
    const apresInstruction = etatSalle(jusqua("debate_reply"));
    for (const a of ["investisseur", "comptable", "juriste", "concurrent", "cliente"] as const) expect(apresInstruction.acteurs[a].vote1).toBe("scellee");
  });
});
