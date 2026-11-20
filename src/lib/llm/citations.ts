// Preuves du mode API (plan v3.0, G1) : les sorties structurées et les citations sont incompatibles (erreur 400, [S27]).
// L'agent cherche donc en texte avec citations ; le code numérote les citations C1…Cn, la mise en forme les référence
// (`citation: "C3"`), puis LE CODE recopie l'adresse et le passage cité (`cited_text`) renvoyés par l'API.
// L'agent ne recopie jamais un extrait : il ne peut pas l'inventer.

import { evidenceVide, type Citation, type ToolEvidence } from "./types";

/** Un bloc de contenu d'une réponse de l'API, vu de façon lâche (les noms de champs viennent de la doc du 20/11/2026). */
export interface Bloc {
  type: string;
  [champ: string]: unknown;
}

const texteDe = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Lit les blocs d'une réponse de recherche : le texte, les URL réellement renvoyées par les outils web,
 * les recherches faites, et les citations numérotées (dédoublonnées par adresse + passage).
 */
export function extraireEvidence(contenu: Bloc[]): { texte: string; evidence: ToolEvidence } {
  const evidence = evidenceVide();
  const urls = new Set<string>();
  const lectures: string[] = []; // ordre des documents lus : document_index d'une citation de lecture
  let texte = "";

  for (const b of contenu) {
    if (b.type === "server_tool_use") {
      const entree = (b.input ?? {}) as Record<string, unknown>;
      if (b.name === "web_search") evidence.recherches.push({ requete: texteDe(entree.query) });
      if (b.name === "web_fetch") evidence.lectures.push({ url: texteDe(entree.url) });
    } else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content as Record<string, unknown>[]) if (typeof r.url === "string") urls.add(r.url);
    } else if (b.type === "web_fetch_tool_result") {
      const c = (b.content ?? {}) as Record<string, unknown>;
      if (typeof c.url === "string") {
        urls.add(c.url);
        lectures.push(c.url);
      }
    }
  }

  const vues = new Set<string>();
  for (const b of contenu) {
    if (b.type !== "text") continue;
    texte += texteDe(b.text);
    if (!Array.isArray(b.citations)) continue;
    for (const c of b.citations as Record<string, unknown>[]) {
      const passage = texteDe(c.cited_text).trim();
      const index = typeof c.document_index === "number" ? c.document_index : -1;
      const url = texteDe(c.url) || lectures[index] || "";
      if (!passage || !url) continue; // sans adresse ou sans passage, ce n'est pas une preuve
      const cle = `${url}\n${passage}`;
      if (vues.has(cle)) continue;
      vues.add(cle);
      evidence.citations.push({
        id: `C${evidence.citations.length + 1}`,
        type: texteDe(c.type).startsWith("web_search") ? "recherche" : "lecture",
        url,
        titre: texteDe(c.title) || texteDe(c.document_title) || null,
        passage,
      });
    }
  }
  evidence.urlsRenvoyees = [...urls];
  return { texte, evidence };
}

/** La liste numérotée donnée à la mise en forme : « C1 — adresse — « passage » ». */
export function listeCitationsPourPrompt(citations: Citation[]): string {
  if (citations.length === 0) return "(aucune citation)";
  return citations.map((c) => `${c.id} — ${c.url} — « ${c.passage.replace(/\s+/g, " ")} »`).join("\n");
}

const CLES_AFFIRMATIONS = new Set(["affirmations", "nouvelles_affirmations"]);

/**
 * Remplace chaque `citation: "Cx"` des affirmations par `source_url` + `extrait` (le passage cité par l'API).
 * Une citation inconnue n'est pas inventée : l'affirmation garde source_url et extrait à null, et son id
 * est listé (« INV-2:C9 ») : le vérificateur la rejettera, avec tout ce qui s'appuie dessus (G1).
 */
export function recopierCitations(sortie: unknown, citations: Citation[]): { sortie: unknown; inconnues: string[] } {
  const parId = new Map(citations.map((c) => [c.id, c]));
  const inconnues: string[] = [];

  const resoudre = (aff: Record<string, unknown>): Record<string, unknown> => {
    const { citation, ...reste } = aff;
    if (typeof citation === "string") {
      const c = parId.get(citation);
      if (c) return { ...reste, source_url: c.url, extrait: c.passage };
      inconnues.push(`${texteDe(aff.id)}:${citation}`);
    }
    return { ...reste, source_url: null, extrait: null };
  };

  const parcourir = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(parcourir);
    if (n && typeof n === "object") {
      return Object.fromEntries(
        Object.entries(n as Record<string, unknown>).map(([k, v]) => [
          k,
          CLES_AFFIRMATIONS.has(k) && Array.isArray(v) ? v.map((a) => resoudre(a as Record<string, unknown>)) : parcourir(v),
        ]),
      );
    }
    return n;
  };
  return { sortie: parcourir(sortie), inconnues };
}
