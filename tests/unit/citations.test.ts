import { describe, expect, it } from "vitest";
import { extraireEvidence, listeCitationsPourPrompt, recopierCitations, type Bloc } from "@/lib/llm/citations";

const URL_A = "https://exemple.test/a";
const URL_B = "https://exemple.test/b";

const blocs: Bloc[] = [
  { type: "server_tool_use", id: "1", name: "web_search", input: { query: "marché" } },
  { type: "web_search_tool_result", tool_use_id: "1", content: [{ type: "web_search_result", url: URL_A, title: "A" }, { type: "web_search_result", url: URL_B, title: "B" }] },
  { type: "server_tool_use", id: "2", name: "web_fetch", input: { url: URL_B } },
  { type: "web_fetch_tool_result", tool_use_id: "2", content: { type: "web_fetch_result", url: URL_B, content: { type: "document" } } },
  {
    type: "text",
    text: "Première phrase. ",
    citations: [
      { type: "web_search_result_location", url: URL_A, title: "A", cited_text: "passage A" },
      { type: "web_search_result_location", url: URL_A, title: "A", cited_text: "passage A" }, // doublon
    ],
  },
  { type: "text", text: "Seconde.", citations: [{ type: "char_location", document_index: 0, document_title: "B", cited_text: "passage B" }] },
  { type: "text", text: " Sans preuve.", citations: [{ type: "web_search_result_location", title: "sans url", cited_text: "orphelin" }] },
];

describe("extraireEvidence", () => {
  const { texte, evidence } = extraireEvidence(blocs);

  it("concatène le texte et garde les recherches et lectures demandées", () => {
    expect(texte).toBe("Première phrase. Seconde. Sans preuve.");
    expect(evidence.recherches).toEqual([{ requete: "marché" }]);
    expect(evidence.lectures).toEqual([{ url: URL_B }]);
  });

  it("garde les URL réellement renvoyées par les outils (matière du vérificateur)", () => {
    expect(evidence.urlsRenvoyees.sort()).toEqual([URL_A, URL_B]);
  });

  it("numérote les citations C1…Cn, sans doublon, et retrouve l'URL d'une citation de lecture par document_index", () => {
    expect(evidence.citations).toEqual([
      { id: "C1", type: "recherche", url: URL_A, titre: "A", passage: "passage A" },
      { id: "C2", type: "lecture", url: URL_B, titre: "B", passage: "passage B" },
    ]);
  });

  it("ignore une citation sans adresse ou sans passage : ce n'est pas une preuve", () => {
    expect(evidence.citations.some((c) => c.passage === "orphelin")).toBe(false);
  });
});

describe("listeCitationsPourPrompt", () => {
  it("écrit « C1 — adresse — « passage » »", () => {
    const { evidence } = extraireEvidence(blocs);
    expect(listeCitationsPourPrompt(evidence.citations)).toBe(`C1 — ${URL_A} — « passage A »\nC2 — ${URL_B} — « passage B »`);
    expect(listeCitationsPourPrompt([])).toBe("(aucune citation)");
  });
});

describe("recopierCitations", () => {
  const citations = extraireEvidence(blocs).evidence.citations;
  const aff = (id: string, citation: string | null) => ({ id, texte: "t", valeur: 1, unite: "", type: "fait", base: [], citation });

  it("remplace `citation` par source_url + extrait, dans affirmations et nouvelles_affirmations", () => {
    const { sortie, inconnues } = recopierCitations({ affirmations: [aff("INV-1", "C1")], tours: { nouvelles_affirmations: [aff("INV-2", "C2")] } }, citations) as {
      sortie: { affirmations: Record<string, unknown>[]; tours: { nouvelles_affirmations: Record<string, unknown>[] } };
      inconnues: string[];
    };
    expect(inconnues).toEqual([]);
    expect(sortie.affirmations[0]).toMatchObject({ id: "INV-1", source_url: URL_A, extrait: "passage A" });
    expect(sortie.affirmations[0]).not.toHaveProperty("citation");
    expect(sortie.tours.nouvelles_affirmations[0]).toMatchObject({ source_url: URL_B, extrait: "passage B" });
  });

  it("une citation inconnue ne produit aucune source et est listée", () => {
    const { sortie, inconnues } = recopierCitations({ affirmations: [aff("INV-3", "C9"), aff("INV-4", null)] }, citations) as {
      sortie: { affirmations: Record<string, unknown>[] };
      inconnues: string[];
    };
    expect(inconnues).toEqual(["INV-3:C9"]);
    expect(sortie.affirmations[0]).toMatchObject({ source_url: null, extrait: null });
    expect(sortie.affirmations[1]).toMatchObject({ source_url: null, extrait: null });
  });

  it("ne modifie pas l'entrée et laisse intact tout le reste", () => {
    const entree = { vote: { note: 6 }, affirmations: [aff("INV-1", "C1")] };
    const copie = JSON.parse(JSON.stringify(entree));
    const { sortie } = recopierCitations(entree, citations) as { sortie: { vote: unknown } };
    expect(entree).toEqual(copie);
    expect(sortie.vote).toEqual({ note: 6 });
  });
});
