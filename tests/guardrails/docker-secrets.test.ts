import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// G13 — docker-secrets : aucun secret dans l'image, le contexte de build ni les fichiers de déploiement (plan §11.7).
// Chaque test est « piégé » : une modification volontaire du fichier (voir `sans`) doit le faire échouer.
const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const sansCommentaires = (t: string) => t.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
const dockerfile = lire("Dockerfile");
const compose = lire("docker-compose.yml");
const ignore = lire(".dockerignore");
const exemple = lire(".env.example");
const runner = dockerfile.slice(dockerfile.lastIndexOf("AS runner"));

describe("G13 · Dockerfile", () => {
  it("aucune clé, jeton ou mot de passe en ARG ou ENV ; aucun « sk-ant- » dans les fichiers de déploiement", () => {
    for (const l of sansCommentaires(dockerfile).split("\n")) if (/^\s*(ARG|ENV)\b/.test(l)) expect(l, l).not.toMatch(/KEY|TOKEN|SECRET|PASSWORD|JETON/i);
    for (const t of [dockerfile, ignore, exemple, compose, lire("deploy/Caddyfile"), lire("deploy/nginx.conf")]) expect(t).not.toContain("sk-ant-");
    expect(dockerfile).not.toMatch(/^\s*ENV[^\n]*(ANTHROPIC|TRIBUNAL_ACCESS)/m);
  });

  it("étape finale : pas de « COPY . . », pas root, MOCK_MODE=true, HEALTHCHECK, VOLUME /data", () => {
    expect(dockerfile).not.toMatch(/^COPY\s+\.\s+\.?\s*$/m);
    expect(dockerfile).not.toMatch(/COPY\s+(--\S+\s+)*\.\s+\./);
    expect(runner).toMatch(/^USER node$/m);
    expect(runner).toMatch(/MOCK_MODE=true/);
    expect(runner).toMatch(/^HEALTHCHECK /m);
    expect(runner).toMatch(/^VOLUME \/data$/m);
    expect(runner).toContain("/api/health");
    expect(runner).not.toMatch(/USER root/);
  });

  it("trois étapes (deps, build, runner), Node ≥ 22, jamais « latest »", () => {
    expect(dockerfile).toMatch(/AS deps/);
    expect(dockerfile).toMatch(/AS build/);
    expect(dockerfile).toMatch(/AS runner/);
    expect(dockerfile).not.toMatch(/:latest|node:lts|node:current/);
    expect(Number(dockerfile.match(/ARG NODE_VERSION=(\d+)/)?.[1])).toBeGreaterThanOrEqual(22);
    expect(dockerfile).toMatch(/FROM node:\$\{NODE_VERSION\}-bookworm-slim/);
  });

  it("l'image emporte prompts/, fixtures/ et drizzle/ (lus à l'exécution) et ni sources ni tests", () => {
    for (const d of ["prompts", "fixtures", "drizzle", ".next/static", ".next/standalone"]) expect(runner, d).toContain(d);
    expect(runner).not.toMatch(/COPY[^\n]*\b(src|tests|docs)\b/);
    expect(runner).not.toMatch(/COPY[^\n]*\.env/); // jamais de .env dans l'image
  });
});

describe("G13 · .dockerignore", () => {
  it("exclut .env*, .tribunal, *.db, node_modules (sauf .env.example)", () => {
    for (const m of [".env*", ".tribunal", "*.db", "node_modules", "data"]) expect(ignore.split("\n"), m).toContain(m);
    expect(ignore).toContain("!.env.example");
  });
  it("n'exclut JAMAIS prompts/, fixtures/ ni drizzle/", () => {
    for (const d of ["prompts", "fixtures", "drizzle"]) expect(ignore, d).not.toMatch(new RegExp(`^/?${d}/?\\*?$`, "m"));
  });
});

describe("G13 · .env.example", () => {
  it("clé et jeton vides, MOCK_MODE=true, pas de PORT, aucun secret", () => {
    expect(exemple).toMatch(/^ANTHROPIC_API_KEY=$/m);
    expect(exemple).toMatch(/^TRIBUNAL_ACCESS_TOKEN=$/m);
    expect(exemple).toMatch(/^MOCK_MODE=true$/m);
    expect(exemple).not.toMatch(/^PORT=/m);
    expect(exemple).not.toMatch(/sk-ant|tvly-/);
  });
});

describe("G13 · docker-compose.yml", () => {
  const c = sansCommentaires(compose);
  it("un seul service, port sur 127.0.0.1, volume nommé sur /data, init, cap_drop ALL", () => {
    expect(c.match(/^ {2}[a-z][\w-]*:\s*$/gm)?.filter((s) => !/volumes:|ports:/.test(s)).length).toBe(2); // 1 service + le volume nommé
    expect(c).toMatch(/"127\.0\.0\.1:\$\{HOST_PORT:-3000\}:3000"/);
    expect(c).toMatch(/tribunal-data:\/data/);
    expect(c).toMatch(/^\s*tribunal-data:\s*$/m);
    expect(c).toMatch(/init:\s*true/);
    expect(c).toMatch(/cap_drop:\s*\n\s*-\s*ALL/);
  });
  it("aucune clé en dur ; la configuration vient de .env", () => {
    expect(c).not.toMatch(/ANTHROPIC_API_KEY|TRIBUNAL_ACCESS_TOKEN|sk-ant/);
    expect(c).toMatch(/env_file:/);
    expect(c).not.toMatch(/"0\.0\.0\.0:|^\s*-\s*"?\d+:\d+"?\s*$/m); // jamais publié sans 127.0.0.1
  });
});

describe("G13 · next.config.ts et reverse proxy", () => {
  it('output: "standalone" est présent', () => {
    expect(lire("next.config.ts")).toMatch(/output:\s*"standalone"/);
  });
  it("les exemples de proxy coupent la mise en mémoire tampon du flux SSE", () => {
    expect(lire("deploy/nginx.conf")).toMatch(/proxy_buffering off/);
    expect(lire("deploy/nginx.conf")).toMatch(/proxy_read_timeout 3600s/);
    expect(lire("deploy/Caddyfile")).toMatch(/flush_interval -1/);
  });
});

describe("G13 · CI", () => {
  const ci = lire(".github/workflows/ci.yml");
  it("MOCK_MODE=true forcé ; échoue si ANTHROPIC_API_KEY est présente ; aucun secret référencé", () => {
    expect(ci).toMatch(/MOCK_MODE:\s*"true"/);
    expect(ci).toMatch(/ANTHROPIC_API_KEY/);
    expect(ci).not.toMatch(/secrets\./);
  });
  it("enchaîne npm ci, lint, typecheck, build, test et la vérification « plugin à jour »", () => {
    for (const c of ["npm ci", "npm run lint", "npm run typecheck", "npm run build", "npm test", "build:plugin -- --check --bundle"]) expect(ci).toContain(c);
  });
});
