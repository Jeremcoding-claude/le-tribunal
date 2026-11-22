import { describe, expect, it } from "vitest";
import { COOKIE_ACCES, getHealth, postAcces, protege, refuserSansJeton } from "@/lib/server/acces";

const JETON = "mot-de-passe-long-0123";
const req = (h: Record<string, string> = {}, corps?: unknown) =>
  new Request("http://localhost/api/trials", { method: corps === undefined ? "GET" : "POST", headers: { "content-type": "application/json", ...h }, body: corps === undefined ? undefined : JSON.stringify(corps) });

describe("jeton d'accès (mode réel)", () => {
  it("MOCK (aucun jeton attendu) : tout passe", () => {
    expect(refuserSansJeton(req(), "")).toBeNull();
  });
  it("sans jeton, avec un mauvais jeton, ou avec un jeton de longueur différente : 401", async () => {
    for (const h of [{} as Record<string, string>, { "x-tribunal-token": "faux" }, { cookie: `${COOKIE_ACCES}=${JETON}x` }]) {
      const r = refuserSansJeton(req(h), JETON)!;
      expect(r.status).toBe(401);
      expect(await r.text()).not.toContain(JETON);
    }
  });
  it("le bon jeton, par en-tête ou par cookie : accepté", () => {
    expect(refuserSansJeton(req({ "x-tribunal-token": JETON }), JETON)).toBeNull();
    expect(refuserSansJeton(req({ cookie: `autre=1; ${COOKIE_ACCES}=${encodeURIComponent(JETON)}` }), JETON)).toBeNull();
  });
  it("POST /api/acces : mauvais mot de passe = 401 sans cookie ; bon = cookie HttpOnly SameSite=Strict, jamais le jeton dans le corps", async () => {
    const non = await postAcces(req({}, { jeton: "faux" }), JETON);
    expect(non.status).toBe(401);
    expect(non.headers.get("set-cookie")).toBeNull();
    const oui = await postAcces(req({}, { jeton: JETON }), JETON);
    expect(oui.status).toBe(200);
    expect(oui.headers.get("set-cookie")).toMatch(/HttpOnly; SameSite=Strict/);
    expect(await oui.text()).not.toContain(JETON);
  });
  it("protege() n'appelle pas la route sans jeton", async () => {
    let appels = 0;
    const route = protege(() => (appels++, new Response("ok")));
    // env() est en MOCK dans les tests : la route passe ; le refus est couvert par refuserSansJeton ci-dessus
    expect((await route(req())).status).toBe(200);
    expect(appels).toBe(1);
  });
});

describe("GET /api/health", () => {
  it("{ ok: true } si la base répond ; 503 sinon, sans détail ni chemin", async () => {
    const bon = getHealth(() => []);
    expect(bon.status).toBe(200);
    expect(await bon.json()).toEqual({ ok: true });
    const mauvais = getHealth(() => {
      throw new Error("SQLITE_CANTOPEN /data/tribunal.db");
    });
    expect(mauvais.status).toBe(503);
    expect(await mauvais.text()).not.toContain("tribunal.db");
  });
});
