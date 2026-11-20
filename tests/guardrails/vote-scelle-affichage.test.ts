import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Journal from "@/components/audience/Journal";
import { appliquer, etatInitial, etatSalle } from "@/components/salle/etat";
import SalleFixe from "@/components/salle/SalleFixe";
import { TrialEvent } from "@/lib/schemas";

// G14 — vote-scelle-affichage : le vote 1 n'apparaît à l'écran, et dans le flux d'événements, qu'à son ouverture (plan §12.4).
const evenements = (JSON.parse(readFileSync(join(process.cwd(), "fixtures/restaurants/events.json"), "utf8")) as unknown[]).map((e) => TrialEvent.parse(e));
const iOuverture = evenements.findIndex((e) => e.type === "vote1_ouvert");
const avant = evenements.slice(0, iOuverture);
const html = (evs: TrialEvent[]) => renderToStaticMarkup(createElement(Journal, { etat: etatSalle(evs), trialId: "t" }));
const NOTES = /\b(?:3,5|4|5|5,5|6)\/10/;

describe("G14 · le flux d'événements", () => {
  it("avant « vote1_ouvert », aucun événement ne porte une note ni un verdict de juré", () => {
    expect(iOuverture).toBeGreaterThan(50);
    expect(JSON.stringify(avant)).not.toMatch(/"note"|"verdict"|"raison_principale"/);
    // le procès a pourtant bien voté : cinq enveloppes scellées
    expect(avant.filter((e) => e.type === "vote_sealed")).toHaveLength(5);
  });

  it("les événements scellés refusent une note (schéma strict) : vote_sealed et revote", () => {
    const base = { trial_id: "t", seq: 1, ts: "2026-11-20T10:00:00.000Z" };
    expect(TrialEvent.safeParse({ ...base, type: "vote_sealed", agent: "cliente", note: 5 }).success).toBe(false);
    expect(TrialEvent.safeParse({ ...base, type: "revote", agent: "cliente", verdict: "GO" }).success).toBe(false);
  });

  it("le revote est scellé lui aussi jusqu'à « revote_ouvert »", () => {
    const iRevote = evenements.findIndex((e) => e.type === "revote");
    const iOuvert = evenements.findIndex((e) => e.type === "revote_ouvert");
    expect(iOuvert).toBeGreaterThan(iRevote);
    expect(JSON.stringify(evenements.slice(iRevote, iOuvert))).not.toMatch(/"note"|"verdict"/);
  });
});

describe("G14 · l'état de la salle", () => {
  it("avant l'ouverture, aucune note dans l'état : les enveloppes sont « scellées »", () => {
    const s = etatSalle(avant);
    for (const a of Object.values(s.acteurs)) {
      expect(a.note1).toBeNull();
      expect(a.verdict1).toBeNull();
      expect(a.note2).toBeNull();
    }
    expect(s.vote1).toBeNull();
    expect(Object.values(s.acteurs).filter((a) => a.vote1 === "scellee")).toHaveLength(5);
  });

  it("à « vote1_ouvert », les notes apparaissent, ensemble", () => {
    const s = appliquer(etatSalle(avant), evenements[iOuverture]);
    expect(Object.values(s.acteurs).filter((a) => a.note1 !== null)).toHaveLength(5);
    expect(s.vote1).toMatchObject({ moyenne: 4.8 });
  });
});

describe("G14 · l'affichage (journal d'audience et salle sans 3D)", () => {
  it("avant l'ouverture : « sous scellés », aucune note à l'écran", () => {
    const h = html(avant);
    expect(h).toContain("vote 1 sous scellés");
    expect(h).not.toMatch(NOTES);
    expect(h).not.toContain("Les enveloppes du vote 1 sont ouvertes");
    expect(h).not.toContain("NO-GO");
  });

  it("après l'ouverture : les notes du vote 1 sont affichées", () => {
    const h = html(evenements.slice(0, iOuverture + 1));
    expect(h).toContain("vote 1 : 6/10 (GO)");
    expect(h).toContain("vote 1 : 4/10 (NO-GO)");
    expect(h).toContain("Les enveloppes du vote 1 sont ouvertes");
  });

  it("la salle 2D (repli sans 3D) ne montre aucune note non plus", () => {
    const h = renderToStaticMarkup(createElement(SalleFixe, { etat: etatSalle(avant) }));
    expect(h).not.toMatch(NOTES);
    expect(h).toContain("parle");
  });

  it("au début (aucun événement), rien n'est ouvert ni scellé", () => {
    const h = renderToStaticMarkup(createElement(Journal, { etat: etatInitial() }));
    expect(h).toContain("En attente de l&#x27;ouverture de l&#x27;audience");
    expect(h).not.toContain("sous scellés");
  });
});
