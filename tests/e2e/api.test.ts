/* eslint-disable @typescript-eslint/no-explicit-any */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getReport, getStream, getTrial, postAnswers, postResume, postTrial, estTerminal } from "@/lib/server/handlers";
import { creerService, type OptionsService } from "@/lib/server/service";
import { creerStoreSqlite, ouvrirBase } from "@/lib/store/sqlite";
import { clientTest, SAISIE_REFERENCE, sourcesMock } from "../helpers";

const nouveau = (o: Partial<OptionsService> = {}) => {
  const stockage = creerStoreSqlite(ouvrirBase(":memory:"));
  const service = creerService({ stockage, client: clientTest(), sources: sourcesMock(), ...o });
  return { stockage, service };
};
const post = (url: string, corps?: unknown, entetes: Record<string, string> = {}) =>
  new Request(`http://tribunal.test${url}`, { method: "POST", headers: { "Content-Type": "application/json", ...entetes }, body: corps === undefined ? undefined : typeof corps === "string" ? corps : JSON.stringify(corps) });
const get = (url: string, entetes: Record<string, string> = {}, signal?: AbortSignal) => new Request(`http://tribunal.test${url}`, { headers: entetes, signal });

interface Trame {
  id: number;
  event: string;
  data: any;
}
/** Lit un flux SSE jusqu'à sa fin (ou `max` trames) et le découpe en trames. */
async function lireFlux(res: Response, max = Infinity): Promise<{ trames: Trame[]; brut: string }> {
  const lecteur = res.body!.getReader();
  const dec = new TextDecoder();
  let brut = "";
  const trames: Trame[] = [];
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    brut += dec.decode(value);
    const morceaux = brut.split("\n\n");
    for (const m of morceaux.slice(trames.length > 0 || brut.includes("retry") ? 0 : 0)) void m;
    trames.length = 0;
    for (const m of morceaux) {
      const id = m.match(/^id: (\d+)$/m);
      const ev = m.match(/^event: (.+)$/m);
      const data = m.match(/^data: (.+)$/m);
      if (id && ev && data) trames.push({ id: Number(id[1]), event: ev[1], data: JSON.parse(data[1]) });
    }
    if (trames.length >= max) {
      await lecteur.cancel();
      break;
    }
  }
  return { trames, brut };
}

describe("POST /api/trials", () => {
  it("valide, crée, lance en ARRIÈRE-PLAN et renvoie {id} sans attendre la fin du procès", async () => {
    const { service } = nouveau();
    const res = await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service);
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(id).toMatch(/^t-[0-9a-f]{12}$/);
    expect(service.estActif(id)).toBe(true); // le procès tourne encore quand la réponse part
    await service.attendre(id);
    expect(service.trial(id)!.statut).toBe("termine");
  });

  it("refuse un corps illisible (400), une idée vide ou trop longue (400), un pays invalide (400)", async () => {
    const { service } = nouveau();
    expect((await postTrial(post("/api/trials", "pas du json"), service)).status).toBe(400);
    expect((await postTrial(post("/api/trials", { idee: "   " }), service)).status).toBe(400);
    expect((await postTrial(post("/api/trials", { idee: "x".repeat(501) }), service)).status).toBe(400);
    expect((await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE, pays: "france" }), service)).status).toBe(400);
    expect((await postTrial(post("/api/trials", {}), service)).status).toBe(400);
  });

  it("une saisie incomplète : 422 avec ce qui manque, le format et un exemple ; aucun procès créé", async () => {
    const { service, stockage } = nouveau();
    const res = await postTrial(post("/api/trials", { idee: "Brigade IA, agents IA, Lyon" }), service);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ status: "saisie_incomplete", manque: ["cible"] });
    expect(stockage.listerTrials()).toHaveLength(0);
  });

  it("le pays est ajouté à la ville quand la saisie ne le précise pas", async () => {
    const { service, stockage } = nouveau();
    const { id } = await (await postTrial(post("/api/trials", { idee: "Brigade IA, agents IA, aux restaurants, 149 € par mois, Bruxelles", pays: "BE" }), service)).json();
    expect(stockage.trial(id)!.texte).toContain("Bruxelles (BE)");
    expect(stockage.trial(id)!.pays).toBe("BE");
    await service.attendre(id);
  });
});

describe("GET /api/trials/:id/stream (SSE)", () => {
  it("renvoie la Response tout de suite, avec les en-têtes SSE et sans mise en mémoire tampon", async () => {
    const { service } = nouveau();
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    const res = getStream(get(`/api/trials/${id}/stream`), id, service, { pollMs: 5 });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    await res.body!.cancel();
    await service.attendre(id);
  });

  it("les événements arrivent DANS L'ORDRE, un par un, et le flux s'arrête sur « verdict »", async () => {
    const { service } = nouveau();
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    const { trames } = await lireFlux(getStream(get(`/api/trials/${id}/stream`), id, service, { pollMs: 5 }));
    expect(trames.length).toBeGreaterThan(50);
    trames.forEach((t, i) => expect(t.id).toBe(i)); // numéros croissants, sans trou
    expect(trames.at(-1)!.event).toBe("verdict");
    expect(trames.filter((t) => t.event === "verdict")).toHaveLength(1);
    const types = trames.map((t) => t.event);
    expect(types.indexOf("vote1_ouvert")).toBeGreaterThan(types.lastIndexOf("vote_sealed"));
    expect(types.indexOf("ruling")).toBeGreaterThan(types.indexOf("vote1_ouvert"));
    await service.attendre(id);
  });

  it("G14 · avant « vote1_ouvert », aucune note dans le flux", async () => {
    const { service } = nouveau();
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    const { trames } = await lireFlux(getStream(get(`/api/trials/${id}/stream`), id, service, { pollMs: 5 }));
    const avant = JSON.stringify(trames.slice(0, trames.findIndex((t) => t.event === "vote1_ouvert")).map((t) => t.data));
    expect(avant).not.toMatch(/"note"|"verdict"/);
  });

  it("G7 · reprise après coupure : Last-Event-ID rend la suite, sans doublon ni trou", async () => {
    const { service } = nouveau();
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    await service.attendre(id);
    const complet = (await lireFlux(getStream(get(`/api/trials/${id}/stream`), id, service, { pollMs: 5 }))).trames;
    const coupure = complet[20].id;
    const suite = (await lireFlux(getStream(get(`/api/trials/${id}/stream`, { "Last-Event-ID": String(coupure) }), id, service, { pollMs: 5 }))).trames;
    expect(suite[0].id).toBe(coupure + 1);
    expect([...complet.slice(0, 21), ...suite].map((t) => t.id)).toEqual(complet.map((t) => t.id));
    // le paramètre d'adresse fait la même chose (pour les clients sans en-tête)
    const parUrl = (await lireFlux(getStream(get(`/api/trials/${id}/stream?lastEventId=${coupure}`), id, service, { pollMs: 5 }))).trames;
    expect(parUrl.map((t) => t.id)).toEqual(suite.map((t) => t.id));
  });

  it("une connexion coupée en cours de route, rouverte avec le dernier numéro reçu, ne perd rien", async () => {
    const { service } = nouveau();
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    const debut = (await lireFlux(getStream(get(`/api/trials/${id}/stream`), id, service, { pollMs: 5 }), 10)).trames;
    const dernier = debut.at(-1)!.id;
    const reste = (await lireFlux(getStream(get(`/api/trials/${id}/stream`, { "Last-Event-ID": String(dernier) }), id, service, { pollMs: 5 }))).trames;
    await service.attendre(id);
    const tout = (await lireFlux(getStream(get(`/api/trials/${id}/stream`), id, service, { pollMs: 5 }))).trames;
    expect([...debut.filter((t) => t.id <= dernier), ...reste].map((t) => t.id)).toEqual(tout.map((t) => t.id));
  });

  it("heartbeat : un commentaire SSE est envoyé quand rien ne se passe", async () => {
    const { service, stockage } = nouveau();
    stockage.creerTrial("calme", "x", "FR"); // procès « en cours » sans événement
    const res = getStream(get("/api/trials/calme/stream"), "calme", service, { pollMs: 5, heartbeatMs: 20 });
    const lecteur = res.body!.getReader();
    let brut = "";
    const dec = new TextDecoder();
    for (let i = 0; i < 20 && !brut.includes(": heartbeat"); i++) brut += dec.decode((await lecteur.read()).value);
    await lecteur.cancel();
    expect(brut).toContain("retry: 2000");
    expect(brut).toContain(": heartbeat\n\n");
  });

  it("le client qui se déconnecte arrête la boucle", async () => {
    const { service, stockage } = nouveau();
    stockage.creerTrial("coupe", "x", "FR");
    const ctrl = new AbortController();
    const res = getStream(get("/api/trials/coupe/stream", {}, ctrl.signal), "coupe", service, { pollMs: 5, heartbeatMs: 10_000 });
    const lecteur = res.body!.getReader();
    await lecteur.read();
    ctrl.abort();
    const fin = await Promise.race([lecteur.read().then(async (r) => (r.done ? "fini" : (await lecteur.read()).done ? "fini" : "encore")), new Promise((r) => setTimeout(() => r("bloque"), 1000))]);
    expect(fin).toBe("fini");
  });

  it("un procès inconnu : 404", async () => {
    const { service } = nouveau();
    expect(getStream(get("/api/trials/zzz/stream"), "zzz", service).status).toBe(404);
  });

  it("une erreur finale clôt le flux ; une alerte (« juré absent ») ne le clôt pas", () => {
    const e = (code: string) => ({ type: "error", code, message: "x", phase: null, trial_id: "t", seq: 0, ts: "2026-11-20T10:00:00.000Z" }) as never;
    expect(estTerminal(e("echec"))).toBe(true);
    expect(estTerminal(e("budget_depasse"))).toBe(true);
    expect(estTerminal(e("juré absent"))).toBe(false);
    expect(estTerminal({ type: "verdict" } as never)).toBe(true);
    expect(estTerminal({ type: "phase_started" } as never)).toBe(false);
  });

  it("un procès en échec : le flux se termine sur l'événement d'erreur", async () => {
    const { service } = nouveau({ client: clientTest({ avant: (p) => { if (p.phase === "IDENTIFICATION") throw new Error("panne sk-ant-api03-FAUSSECLE123456"); } }) });
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    const { trames, brut } = await lireFlux(getStream(get(`/api/trials/${id}/stream`), id, service, { pollMs: 5 }));
    expect(trames.at(-1)).toMatchObject({ event: "error", data: { code: "echec" } });
    expect(brut).not.toContain("FAUSSECLE"); // G8
    await service.attendre(id);
    expect(service.trial(id)!.statut).toBe("echec");
    expect(service.trial(id)!.message).not.toContain("FAUSSECLE");
  });
});

describe("GET /api/trials/:id, rapport, reprise, réponses", () => {
  it("l'état ne montre jamais l'état brut : pas de vote 1 ni de dossier, seulement le résultat final", async () => {
    const { service } = nouveau();
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    await service.attendre(id);
    const e = await (await getTrial(id, service)).json();
    expect(e).toMatchObject({ id, statut: "termine", phase: "TERMINE", enCours: false, resultat: { verdict: "PIVOT", phrase: "Modifie ton plan." } });
    expect(JSON.stringify(e)).not.toMatch(/votes1|dossiers|raison_principale|"vote"/);
    expect((await getTrial("inconnu", service)).status).toBe(404);
  });

  it("le rapport PDF : 409 avant la fin, 200 application/pdf après, 404 si inconnu", async () => {
    const { service, stockage } = nouveau();
    stockage.creerTrial("vide", "x", "FR");
    expect((await getReport("vide", service)).status).toBe(409);
    expect((await getReport("zzz", service)).status).toBe(404);
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    await service.attendre(id);
    const res = await getReport(id, service);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(stockage.artefact(id, "rapport.pdf")).toBeDefined(); // mis en cache
    expect(Buffer.from(await (await getReport(id, service)).arrayBuffer()).equals(buf)).toBe(true);
  });

  it("G7 · POST /resume reprend un procès coupé à la phase suivante, sans refaire l'instruction", async () => {
    const premier = clientTest();
    const { service, stockage } = nouveau({ client: premier, runOptions: { arretApres: "P3" } });
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    await service.attendre(id);
    expect(stockage.trial(id)!.statut).toBe("interrompu");
    expect((await getTrial(id, service).then((r) => r.json())).phase).toBe("P3");

    // le serveur redémarre : un nouveau service sur la MÊME base ; le procès « en cours » est marqué « interrompu »
    const second = clientTest();
    const service2 = creerService({ stockage, client: second, sources: sourcesMock() });
    const res = await postResume(id, service2);
    expect(res.status).toBe(202);
    await service2.attendre(id);
    expect(stockage.trial(id)!.statut).toBe("termine");
    const phases = new Set(second.appels.map((a) => a.phase));
    expect(phases.has("INSTRUCTION")).toBe(false);
    expect(phases.has("CORRECTION")).toBe(true);
    // et les événements continuent la même suite
    (await stockage.store.evenements(id)).forEach((e, i) => expect(e.seq).toBe(i));
    // reprendre un procès terminé, déjà en cours ou inconnu est refusé
    expect((await postResume(id, service2)).status).toBe(409);
    expect((await postResume("zzz", service2)).status).toBe(404);
  });

  it("un redémarrage du serveur marque « interrompu » tout procès resté « en cours »", () => {
    const stockage = creerStoreSqlite(ouvrirBase(":memory:"));
    stockage.creerTrial("orphelin", "x", "FR");
    creerService({ stockage, client: clientTest(), sources: sourcesMock() });
    expect(stockage.trial("orphelin")).toMatchObject({ statut: "interrompu" });
  });

  it("G10 · les questions de mise en état : événement « questions », POST /answers (validé par Zod), puis le procès continue", async () => {
    const sansPrix = clientTest({
      apres: (p, r) => {
        const s = r.sortie as any;
        if (p.phase === "IDENTIFICATION") s.saisie_confirmee.prix = null;
        // le prix donné en réponse (149 € par mois) devient celui du dossier, avec son origine
        if (p.phase === "MISE_EN_ETAT") s.case_file.prix.origine = "reponse_question";
        return r;
      },
    });
    const { service } = nouveau({ client: sansPrix });
    const { id } = await (await postTrial(post("/api/trials", { idee: "Brigade IA, agents IA, aux restaurants indépendants, Lyon" }), service)).json();
    for (let i = 0; i < 200 && !(await service.etat(id))?.questions; i++) await new Promise((r) => setTimeout(r, 10));
    const attente = await (await getTrial(id, service)).json();
    expect(attente.questions).toEqual([{ code: "prix_absent", texte: "Quel est le prix, et sa fréquence ? (ex. 149 € par mois, 30 € par commande)", choix: [] }]);
    expect(attente.enCours).toBe(true);

    expect((await postAnswers(post(`/api/trials/${id}/answers`, "pas du json"), id, service)).status).toBe(400);
    expect((await postAnswers(post(`/api/trials/${id}/answers`, { reponses: [{ code: "homonymes", reponse: "x" }] }), id, service)).status).toBe(400);
    expect((await postAnswers(post(`/api/trials/${id}/answers`, { reponses: 42 }), id, service)).status).toBe(400);
    expect((await postAnswers(post(`/api/trials/${id}/answers`, { reponses: [{ code: "prix_absent", reponse: "149 € par mois" }] }), id, service)).status).toBe(200);
    await service.attendre(id);
    expect(service.trial(id)!.statut).toBe("termine");
    // plus aucune question n'attend : 409 ; procès inconnu : 404
    expect((await postAnswers(post("/x", { reponses: [] }), id, service)).status).toBe(409);
    expect((await postAnswers(post("/x", { reponses: [] }), "zzz", service)).status).toBe(404);
  });
});

describe("G8 · rien de secret ne sort de l'API", () => {
  it("toutes les réponses JSON et le flux sont masqués, la base ne contient aucune clé", async () => {
    const CLE = "sk-ant-api03-FAUSSECLEDETEST123456";
    const { service, stockage } = nouveau({ client: clientTest({ avant: (p) => { if (p.phase === "IDENTIFICATION") throw new Error(`401 ${CLE}`); } }) });
    const { id } = await (await postTrial(post("/api/trials", { idee: SAISIE_REFERENCE }), service)).json();
    await service.attendre(id);
    const sorties = [await (await getTrial(id, service)).text(), (await lireFlux(getStream(get(`/api/trials/${id}/stream`), id, service, { pollMs: 5 }))).brut];
    for (const s of sorties) expect(s).not.toContain("FAUSSECLE");
    const brut = JSON.stringify([stockage.trial(id), await stockage.store.evenements(id), await stockage.store.dernierEtat(id)]);
    expect(brut).not.toContain("FAUSSECLE");
  });

  it("client-bundle : aucune clé ni ANTHROPIC_API_KEY dans .next/static, et les routes n'exposent pas process.env", () => {
    const statique = join(process.cwd(), ".next", "static");
    const lire = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? lire(join(d, f)) : [readFileSync(join(d, f), "utf8")]));
    try {
      for (const t of lire(statique)) {
        expect(t).not.toContain("sk-ant");
        expect(t).not.toContain("ANTHROPIC_API_KEY");
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; // pas de build : le test est ignoré
    }
    for (const f of ["src/lib/server/handlers.ts", "src/lib/server/service.ts"]) expect(readFileSync(join(process.cwd(), f), "utf8")).not.toContain("process.env");
  });
});
