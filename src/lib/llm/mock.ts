// Client MOCK : même signature que le vrai client, mais il rejoue fixtures/<cas>/ (plan v3.0, étape 4).
// Aucun réseau, aucun coût réel : il simule un usage non nul, des événements de recherche, et les
// « preuves » des outils (URL renvoyées, passages cités) à partir des faits de la fixture, pour que le
// vérificateur de sources (étape 5) travaille en MOCK exactement comme en réel.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AGENTS, BUDGET_PAR_PHASE, schemaSortie, type AgentId, type Phase } from "../../../prompts/agents.config";
import { promptSysteme } from "../prompts/loader";
import { evidenceVide, LlmError, type CallAgentParams, type CallAgentResult, type Citation, type LlmClient, type ToolEvidence } from "./types";
import { coutUsd, type Usage } from "./usage";

/** Le fichier de fixture d'un agent dans une phase, relatif à fixtures/<cas>/. */
export function fichierFixture(agent: AgentId, phase: Phase, tour?: 1 | 2): string {
  switch (phase) {
    case "IDENTIFICATION":
    case "IDENTIFICATION_COMPLEMENT":
      return "greffier-enquete.json";
    case "MISE_EN_ETAT":
      return "greffier-redaction.json";
    case "INSTRUCTION":
      return `instruction/${agent}.json`;
    case "LECTURE":
      return "instruction-api/comptable-lecture.json";
    case "DEBAT":
      if (tour === undefined) throw new LlmError("MOCK : le tour est exigé en phase DEBAT.");
      return `debat/tour-${tour}/${agent}.json`;
    case "REVOTE":
      return `revote/${agent}.json`;
    case "CORRECTION":
      return "ruling.json";
  }
}

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => v !== null && typeof v === "object" && !Array.isArray(v);

/** Les faits sourcés de la fixture : ce que les outils web « ont renvoyé ». */
function collecterFaits(sortie: unknown): { url: string; passage: string }[] {
  const faits: { url: string; passage: string }[] = [];
  const parcourir = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(parcourir);
    if (!estObjet(n)) return;
    if (n.type === "fait" && typeof n.source_url === "string" && typeof n.extrait === "string") faits.push({ url: n.source_url, passage: n.extrait });
    Object.values(n).forEach(parcourir);
  };
  parcourir(sortie);
  if (estObjet(sortie) && estObjet(sortie.identification)) {
    const c = sortie.identification.categorie_activite;
    if (estObjet(c) && typeof c.source_url === "string" && typeof c.extrait === "string") faits.push({ url: c.source_url, passage: c.extrait });
  }
  return faits;
}

function evidenceDepuis(faits: { url: string; passage: string }[]): ToolEvidence {
  const e = evidenceVide();
  const citations: Citation[] = [];
  for (const f of faits) {
    if (!citations.some((c) => c.url === f.url && c.passage === f.passage)) {
      citations.push({ id: `C${citations.length + 1}`, type: "recherche", url: f.url, titre: null, passage: f.passage });
    }
  }
  e.citations = citations;
  e.urlsRenvoyees = [...new Set(faits.map((f) => f.url))];
  return e;
}

const jetons = (texte: string) => Math.ceil(texte.length / 3.5);

export interface OptionsMock {
  racine?: string;
  cas?: string;
}

export function creerClientMock(opts: OptionsMock = {}): LlmClient {
  const racine = opts.racine ?? process.cwd();
  const dossier = join(racine, "fixtures", opts.cas ?? "restaurants");

  return {
    mode: "mock",
    async callAgent(p: CallAgentParams): Promise<CallAgentResult> {
      const def = AGENTS[p.agent];
      const fichier = fichierFixture(p.agent, p.phase, p.tour);
      let brut: unknown;
      try {
        brut = JSON.parse(readFileSync(join(dossier, fichier), "utf8"));
      } catch (e) {
        throw new LlmError(`MOCK : fixture illisible ou manquante (${fichier}).`, e);
      }

      // Le Comptable, mission 1, ne rend ni arguments ni vote : on garde les champs de son schéma.
      let sortie = brut;
      if (p.agent === "comptable" && p.phase === "INSTRUCTION" && estObjet(brut)) {
        sortie = { agent: "comptable", affirmations: brut.affirmations, hypotheses: brut.hypotheses, lacunes: brut.lacunes, alertes: brut.alertes };
      }
      const valide = schemaSortie(p.agent, p.phase, "plugin").safeParse(sortie);
      if (!valide.success) throw new LlmError(`MOCK : la fixture ${fichier} n'est pas valide : ${valide.error.issues[0]?.message ?? "?"}`);

      const budget = BUDGET_PAR_PHASE[p.phase];
      const avecWeb = def.outilsApi.length > 0 && budget.maxSearches + budget.maxFetches > 0;
      const faits = avecWeb ? collecterFaits(sortie) : [];
      const evidence = evidenceDepuis(faits);

      if (avecWeb) {
        p.onEvent?.({ type: "agent_status", agent: p.agent, statut: "recherche" });
        for (const url of evidence.urlsRenvoyees.slice(0, budget.maxSearches)) {
          const hote = new URL(url).hostname;
          p.onEvent?.({ type: "search_performed", agent: p.agent, requete: `mock : ${hote}`, domaines: [hote] });
          evidence.recherches.push({ requete: `mock : ${hote}` });
        }
        p.onEvent?.({ type: "agent_status", agent: p.agent, statut: "mise_en_forme" });
      }
      p.onEvent?.({ type: "agent_status", agent: p.agent, statut: "termine" });

      const usage: Usage = {
        entree: jetons(promptSysteme(p.agent, "api")) + jetons(p.mission),
        sortie: jetons(JSON.stringify(sortie)),
        cacheLecture: 0,
        cacheEcriture: 0,
        recherches: evidence.recherches.length,
        lectures: 0,
      };
      return { sortie, usage, coutUsd: coutUsd(usage, def.modele), modele: def.modele, evidence, citationsInconnues: [], appels: avecWeb ? 2 : 1 };
    },
  };
}
