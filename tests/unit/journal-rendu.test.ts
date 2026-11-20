import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Journal from "@/components/audience/Journal";
import { etatSalle } from "@/components/salle/etat";
import SalleFixe from "@/components/salle/SalleFixe";
import { TrialEvent } from "@/lib/schemas";
import { evenementsDemo } from "../../scripts/gen-events";

const brut = readFileSync(join(process.cwd(), "fixtures/restaurants/events.json"), "utf8");
const evenements = (JSON.parse(brut) as unknown[]).map((e) => TrialEvent.parse(e));
const final = etatSalle(evenements);
const rendu = (o: { trialId?: string; evenements?: TrialEvent[] } = {}) => renderToStaticMarkup(createElement(Journal, { etat: o.evenements ? etatSalle(o.evenements) : final, trialId: o.trialId }));

describe("« Voir la démo » : les événements enregistrés", () => {
  it("le fichier est celui d'un procès MOCK frais (déterministe : `npx tsx scripts/gen-events.ts` pour le régénérer)", async () => {
    const frais = JSON.stringify(await evenementsDemo(), null, 1) + "\n";
    expect(frais).toBe(brut);
  });
});

describe("le journal d'audience : tout existe en texte", () => {
  const h = rendu({ trialId: "t-abc" });

  it("le verdict : phrase finale, note avant → après, répartition, texte de Nadia, rappel « ni conseil »", () => {
    expect(h).toContain("Modifie ton plan.");
    expect(h).toContain("Note finale : 4,8 → 5,7 / 10");
    expect(h).toContain("2 GO, 3 PIVOT, 0 NO-GO");
    expect(h).toContain("Attendu que le jury");
    expect(h).toContain("ni conseil financier, ni conseil juridique");
  });

  it("chaque nombre affiché vient d'un événement : la note finale est celle de l'événement verdict", () => {
    const v = final.verdict!;
    expect(h).toContain(String(v.note_avant).replace(".", ","));
    expect(h).toContain(String(v.note_apres).replace(".", ","));
  });

  it("le bouton de téléchargement du PDF n'existe qu'avec un procès (pas en rejeu)", () => {
    expect(h).toContain('href="/api/trials/t-abc/report"');
    expect(h).toContain("Télécharger le rapport (PDF)");
    expect(rendu()).not.toContain("Télécharger le rapport");
  });

  it("les pastilles de source sont des liens cliquables vers l'adresse de la source", () => {
    expect(h).toContain('href="https://exemple.test/insee-restauration"');
    expect(h).toContain("INV-1 · exemple.test");
    expect(h).toContain('rel="noreferrer noopener"');
  });

  it("le débat : tours, contestations, propositions d'amélioration", () => {
    expect(h).toContain("Premier tour");
    expect(h).toContain("Second tour");
    expect(h).toContain("Proposition d&#x27;amélioration");
    expect(h).toContain("Viser d&#x27;abord les restaurants équipés");
  });

  it("le plan avant / après : champs modifiés surlignés, chacun avec sa source ; les conditions pour lancer", () => {
    expect(h).toContain("Plan avant et après correction");
    expect(h).toMatch(/149 € par mois<\/td><td class="bg-amber-500\/15[^"]*">79 € par mois/);
    expect(h).toContain("CLI-P1");
    expect(h).toContain("Conditions pour lancer");
    expect(h).toContain("Obtenir 9 restaurants pilotes payants");
  });

  it("les jurés : prénoms, rôles, recherches, sources, votes ; la Cliente porte son prénom du procès", () => {
    for (const nom of ["Victor", "Léa", "Claire", "Marco", "Sandrine"]) expect(h).toContain(nom);
    expect(h).toContain("3 source(s) vérifiée(s)");
  });

  it("accessibilité : zone « polie », statut, sections titrées, aucun contenu seulement visuel", () => {
    expect(h).toContain('aria-live="polite"');
    expect(h).toContain('role="status"');
    expect(h).toMatch(/<section aria-labelledby="jures"/);
    expect(h).toMatch(/<h2 id="jures"/);
  });

  it("les questions de mise en état s'affichent mot pour mot, avec « Passer »", () => {
    const e = { trial_id: "t", ts: "2026-11-20T10:00:00.000Z" };
    const q = TrialEvent.parse({ ...e, seq: 0, type: "questions", questions: [{ code: "prix_absent", texte: "Quel est le prix, et sa fréquence ? (ex. 149 € par mois, 30 € par commande)", choix: [] }, { code: "homonymes", texte: "Plusieurs entreprises correspondent. Laquelle est la vôtre ?", choix: ["A — 62.01Z — Lyon", "aucune, c'est un projet"] }] });
    const m = rendu({ evenements: [q] });
    expect(m).toContain("Quel est le prix, et sa fréquence ? (ex. 149 € par mois, 30 € par commande)");
    expect(m).toContain("Plusieurs entreprises correspondent. Laquelle est la vôtre ?");
    expect(m).toContain("A — 62.01Z — Lyon");
    expect(m).toContain("Passer");
    expect(m).toContain("Répondre");
  });

  it("une erreur finale et les alertes sont dites, sans clé", () => {
    const e = { trial_id: "t", ts: "2026-11-20T10:00:00.000Z" };
    const evs = [
      TrialEvent.parse({ ...e, seq: 0, type: "error", code: "juré absent", message: "cliente : preuves insuffisantes", phase: "P2" }),
      TrialEvent.parse({ ...e, seq: 1, type: "error", code: "echec", message: "panne [clé masquée]", phase: null }),
    ];
    const m = rendu({ evenements: evs });
    expect(m).toContain("juré absent : cliente : preuves insuffisantes");
    expect(m).toContain("Le procès s&#x27;est arrêté : panne [clé masquée]");
    expect(m).not.toMatch(/sk-ant/);
  });
});

describe("la salle fonctionne SANS 3D (repli 2D, lecteur d'écran)", () => {
  const svg = renderToStaticMarkup(createElement(SalleFixe, { etat: final }));
  it("une image nommée, les six personnages et leur état", () => {
    expect(svg).toContain('role="img"');
    expect(svg).toContain("six personnages autour d&#x27;une table ronde");
    for (const nom of ["Nadia", "Victor", "Léa", "Claire", "Marco", "Sandrine"]) expect(svg).toContain(nom);
  });
  it("aucun accessoire détaillé, aucune ressource externe", () => {
    expect(svg).not.toMatch(/https?:\/\//);
    expect(svg).not.toContain("<image");
  });
});
