import { describe, expect, it } from "vitest";
import { creerCachePieces, piecesDuGreffe, creerSourcesReelles, type SourcesRegistre } from "@/lib/registry";
import { memeCommune, normaliserLieu, titreCommune } from "@/lib/registry/nettoyage";
import { URL_COMMUNE, URL_REGISTRE } from "@/lib/registry/fr";
import { normaliserCommune } from "@/lib/registry/geo-fr";
import { CacheTtl } from "@/lib/registry/cache";
import { GUARDRAILS } from "@/lib/guardrails/config";
import type { Saisie } from "@/lib/schemas";
import type { FetchLike } from "@/lib/search/lecture";

const saisie = (o: Partial<Saisie> = {}): Saisie => ({ nom: "Brigade IA", offre: "agents IA", cible: "restaurants", prix: null, ville: "Lyon", pays: "FR", probleme: null, ...o });
const entreprise = (siren: string, commune: string) => ({ siren, nom_complet: `ENTREPRISE ${siren}`, activite_principale: "62.01Z", date_creation: "2020-01-01", etat_administratif: "A", nature_juridique: "5710", siege: { libelle_commune: commune } });
const lyon = [{ nom: "Lyon", code: "69123", codeDepartement: "69", population: 519127, departement: { code: "69", nom: "Rhône" } }];

function sources(results: unknown[], compteur = { n: 0 }): SourcesRegistre {
  return {
    registre: async () => {
      compteur.n++;
      return { results };
    },
    commune: async () => lyon,
  };
}

describe("lieux", () => {
  it("normaliserLieu et titreCommune", () => {
    expect(normaliserLieu("Saint-Étienne")).toBe("saint etienne");
    expect(titreCommune("SAINT-ÉTIENNE")).toBe("Saint-Étienne");
    expect(titreCommune("L'ISLE-ADAM")).toBe("L'Isle-Adam");
    expect(titreCommune("LYON")).toBe("Lyon");
  });
  it("memeCommune : « Lyon 3e » est Lyon, « Villeurbanne » ne l'est pas", () => {
    expect(memeCommune("LYON 3EME ARRONDISSEMENT", "Lyon")).toBe(true);
    expect(memeCommune("Lyon", "lyon")).toBe(true);
    expect(memeCommune("Villeurbanne", "Lyon")).toBe(false);
    expect(memeCommune("Lyonnais", "Lyon")).toBe(false);
  });
});

describe("piecesDuGreffe", () => {
  it("garde les entreprises de la commune de la saisie, pas celles d'ailleurs", async () => {
    const p = await piecesDuGreffe(saisie(), sources([entreprise("999000011", "LYON"), entreprise("999000012", "PARIS"), entreprise("999000013", "LYON 3EME")]));
    expect(p.statut).toBe("ok");
    expect(p.correspondances.map((c) => c.siren)).toEqual(["999000011", "999000013"]);
    expect(p.commune).toMatchObject({ nom: "Lyon", code_commune: "69123", departement: "Rhône", population: 519127, source_url: "https://geo.api.gouv.fr/communes/69123" });
  });

  it("au plus 5 correspondances (config.ts)", async () => {
    const six = Array.from({ length: 8 }, (_, i) => entreprise(`99900002${i}`, "LYON"));
    const p = await piecesDuGreffe(saisie(), sources(six));
    expect(p.correspondances).toHaveLength(GUARDRAILS.registry.fr.maxCorrespondances);
  });

  it("ignore une entreprise inexploitable (SIREN ou NAF illisible) sans échouer", async () => {
    const p = await piecesDuGreffe(saisie(), sources([{ siren: "abc", siege: { libelle_commune: "LYON" } }, entreprise("999000031", "LYON")]));
    expect(p.correspondances).toHaveLength(1);
  });

  it("hors de France : non_applicable, aucune source interrogée", async () => {
    const c = { n: 0 };
    const p = await piecesDuGreffe(saisie({ pays: "BE", ville: "Bruxelles" }), sources([], c));
    expect(p).toEqual({ statut: "non_applicable", correspondances: [], commune: null });
    expect(c.n).toBe(0);
  });

  it("« en ligne » : pas de fiche de commune et pas de filtre par commune", async () => {
    const p = await piecesDuGreffe(saisie({ ville: "en ligne" }), sources([entreprise("999000041", "PARIS")]));
    expect(p.commune).toBeNull();
    expect(p.correspondances).toHaveLength(1);
  });

  it("panne, délai dépassé ou limite de débit : `indisponible`, jamais une erreur ni une donnée inventée", async () => {
    const casse: SourcesRegistre = { registre: async () => { throw new Error("HTTP 429"); }, commune: async () => lyon };
    expect(await piecesDuGreffe(saisie(), casse)).toEqual({ statut: "indisponible", correspondances: [], commune: null });
    const illisible: SourcesRegistre = { registre: async () => "pas du json", commune: async () => lyon };
    expect((await piecesDuGreffe(saisie(), illisible)).correspondances).toEqual([]);
  });

  it("met en cache 24 h : la 2e demande ne rappelle pas le registre, la demande après 24 h oui", async () => {
    let t = 1_000;
    const cache = creerCachePieces(() => t);
    const c = { n: 0 };
    const s = sources([entreprise("999000051", "LYON")], c);
    await piecesDuGreffe(saisie(), s, { cache });
    await piecesDuGreffe(saisie({ nom: "  brigade ia " }), s, { cache });
    expect(c.n).toBe(1);
    t += GUARDRAILS.registry.fr.cacheHeures * 3_600_000 - 1;
    await piecesDuGreffe(saisie(), s, { cache });
    expect(c.n).toBe(1);
    t += 2;
    await piecesDuGreffe(saisie(), s, { cache });
    expect(c.n).toBe(2);
  });

  it("une panne n'est pas mise en cache", async () => {
    const cache = creerCachePieces();
    let n = 0;
    const s: SourcesRegistre = { registre: async () => { n++; throw new Error("HTTP 503"); }, commune: async () => lyon };
    await piecesDuGreffe(saisie(), s, { cache });
    await piecesDuGreffe(saisie(), s, { cache });
    expect(n).toBe(2);
  });
});

describe("commune", () => {
  it("normaliserCommune : première commune de la réponse, département par son nom", () => {
    expect(normaliserCommune(lyon)).toEqual({ nom: "Lyon", code_commune: "69123", departement: "Rhône", population: 519127, source_url: "https://geo.api.gouv.fr/communes/69123" });
    expect(normaliserCommune([])).toBeNull();
    expect(normaliserCommune({ nom: "x" })).toBeNull();
  });
});

describe("sources réelles (faux fetch : aucun réseau)", () => {
  it("construit les adresses des deux API avec la saisie encodée", async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url);
      return { ok: true, status: 200, text: async () => "", json: async () => (url.startsWith(URL_REGISTRE) ? { results: [] } : lyon) };
    };
    const p = await piecesDuGreffe(saisie({ nom: "Café & Co" }), creerSourcesReelles(fetchImpl));
    expect(p.statut).toBe("ok");
    expect(urls.find((u) => u.startsWith(URL_REGISTRE))).toBe(`${URL_REGISTRE}?q=${encodeURIComponent("Café & Co")}&per_page=10`);
    expect(urls.find((u) => u.startsWith(URL_COMMUNE))).toContain("nom=Lyon&fields=nom,code,codeDepartement,departement,population&boost=population&limit=1");
  });

  it("HTTP 429 → indisponible", async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 429, text: async () => "", json: async () => ({}) });
    expect((await piecesDuGreffe(saisie(), creerSourcesReelles(fetchImpl))).statut).toBe("indisponible");
  });
});

describe("CacheTtl", () => {
  it("expire à l'échéance exacte", () => {
    let t = 0;
    const c = new CacheTtl<number>(100, () => t);
    c.set("a", 1);
    t = 99;
    expect(c.get("a")).toBe(1);
    t = 100;
    expect(c.get("a")).toBeUndefined();
  });
});
