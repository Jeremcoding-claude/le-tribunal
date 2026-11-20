// Store SQLite (Drizzle + better-sqlite3) : même interface Store que la mémoire et les fichiers (plan v3.0, étape 10).
// Les migrations sont appliquées à l'ouverture. Jamais de clé API en base : tout passe par masquerProfond (G8).

import Database from "better-sqlite3";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { masquerProfond } from "../guardrails/redact";
import { TrialEvent } from "../schemas";
import * as schema from "./schema";
import type { Store } from "./types";

export type Base = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

/** Ouvre (ou crée) la base et applique les migrations. `:memory:` pour les tests. */
export function ouvrirBase(chemin: string, migrations = join(process.cwd(), "drizzle")): Base {
  if (chemin !== ":memory:") mkdirSync(dirname(chemin), { recursive: true });
  const sqlite = new Database(chemin);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema }) as Base;
  migrate(db, { migrationsFolder: migrations });
  return db;
}

const maintenant = () => new Date().toISOString();

export type LigneTrial = typeof schema.trials.$inferSelect;

export function creerStoreSqlite(db: Base) {
  const store: Store = {
    async sauvegarder(id, phase, etat) {
      const sain = masquerProfond(etat) as { usage?: { entree: number; sortie: number; recherches: number }; coutParPhase?: Record<string, number>; coutUsd?: number };
      db.insert(schema.phases).values({ trialId: id, phase, etat: JSON.stringify(sain), sauveLe: maintenant() }).run();
      // L'usage du procès, par phase, pour « npm run cost » et l'annexe B.
      db.delete(schema.usage).where(eq(schema.usage.trialId, id)).run();
      for (const [p, usd] of Object.entries(sain.coutParPhase ?? {})) db.insert(schema.usage).values({ trialId: id, phase: p, coutUsd: usd }).run();
      if (sain.usage) {
        db.insert(schema.usage)
          .values({ trialId: id, phase: "TOTAL", coutUsd: sain.coutUsd ?? 0, tokensEntree: sain.usage.entree, tokensSortie: sain.usage.sortie, recherches: sain.usage.recherches })
          .run();
      }
      db.update(schema.trials).set({ modifieLe: maintenant() }).where(eq(schema.trials.id, id)).run();
    },
    async dernierEtat(id) {
      const l = db.select().from(schema.phases).where(eq(schema.phases.trialId, id)).orderBy(desc(schema.phases.id)).limit(1).get();
      return l ? { phase: l.phase, etat: JSON.parse(l.etat) } : null;
    },
    async ajouterEvenement(id, e) {
      const sain = masquerProfond(e);
      db.insert(schema.events).values({ trialId: id, seq: sain.seq, type: sain.type, ts: sain.ts, data: JSON.stringify(sain) }).run();
    },
    async evenements(id) {
      return db.select().from(schema.events).where(eq(schema.events.trialId, id)).orderBy(asc(schema.events.seq)).all().map((l) => TrialEvent.parse(JSON.parse(l.data)));
    },
  };

  return {
    store,
    /** Les événements après un numéro (reprise du flux avec Last-Event-ID). */
    evenementsApres(id: string, seq: number): TrialEvent[] {
      return db
        .select()
        .from(schema.events)
        .where(and(eq(schema.events.trialId, id), gt(schema.events.seq, seq)))
        .orderBy(asc(schema.events.seq))
        .all()
        .map((l) => TrialEvent.parse(JSON.parse(l.data)));
    },
    creerTrial(id: string, texte: string, pays: string) {
      const t = maintenant();
      db.insert(schema.trials).values({ id, texte, pays, statut: "en_cours", creeLe: t, modifieLe: t }).run();
    },
    trial(id: string): LigneTrial | undefined {
      return db.select().from(schema.trials).where(eq(schema.trials.id, id)).get();
    },
    listerTrials(): LigneTrial[] {
      return db.select().from(schema.trials).orderBy(desc(schema.trials.creeLe)).all();
    },
    majStatut(id: string, statut: string, message?: string) {
      db.update(schema.trials).set({ statut, message: message === undefined ? null : masquerProfond(message), modifieLe: maintenant() }).where(eq(schema.trials.id, id)).run();
    },
    supprimerTrial(id: string) {
      for (const t of [schema.phases, schema.events, schema.artifacts, schema.usage]) db.delete(t).where(eq(t.trialId, id)).run();
      db.delete(schema.trials).where(eq(schema.trials.id, id)).run();
    },
    artefact(id: string, nom: string): string | undefined {
      return db.select().from(schema.artifacts).where(and(eq(schema.artifacts.trialId, id), eq(schema.artifacts.nom, nom))).get()?.contenu;
    },
    ecrireArtefact(id: string, nom: string, contenu: string) {
      db.delete(schema.artifacts).where(and(eq(schema.artifacts.trialId, id), eq(schema.artifacts.nom, nom))).run();
      db.insert(schema.artifacts).values({ trialId: id, nom, contenu, creeLe: maintenant() }).run();
    },
    usage(id: string) {
      return db.select().from(schema.usage).where(eq(schema.usage.trialId, id)).all();
    },
  };
}

export type StoreSqlite = ReturnType<typeof creerStoreSqlite>;
