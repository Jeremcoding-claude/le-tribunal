// Schéma SQLite (Drizzle) du Tribunal (plan v3.0, étape 10) : procès, points de sauvegarde par phase, événements (seq croissant),
// artefacts (rapport PDF mis en cache) et usage. Les idées sont stockées sur le serveur de celui qui héberge (§12.2).

import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const trials = sqliteTable("trials", {
  id: text("id").primaryKey(),
  texte: text("texte").notNull(),
  pays: text("pays").notNull().default("FR"),
  statut: text("statut").notNull().default("en_cours"),
  message: text("message"),
  creeLe: text("cree_le").notNull(),
  modifieLe: text("modifie_le").notNull(),
});

export const phases = sqliteTable(
  "phases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trialId: text("trial_id").notNull(),
    phase: text("phase").notNull(),
    etat: text("etat").notNull(),
    sauveLe: text("sauve_le").notNull(),
  },
  (t) => [index("phases_trial").on(t.trialId)],
);

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trialId: text("trial_id").notNull(),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    ts: text("ts").notNull(),
    data: text("data").notNull(),
  },
  (t) => [uniqueIndex("events_trial_seq").on(t.trialId, t.seq)],
);

export const artifacts = sqliteTable(
  "artifacts",
  {
    trialId: text("trial_id").notNull(),
    nom: text("nom").notNull(),
    contenu: text("contenu").notNull(),
    creeLe: text("cree_le").notNull(),
  },
  (t) => [primaryKey({ columns: [t.trialId, t.nom] })],
);

export const usage = sqliteTable(
  "usage",
  {
    trialId: text("trial_id").notNull(),
    phase: text("phase").notNull(),
    coutUsd: real("cout_usd").notNull(),
    tokensEntree: integer("tokens_entree").notNull().default(0),
    tokensSortie: integer("tokens_sortie").notNull().default(0),
    recherches: integer("recherches").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.trialId, t.phase] })],
);
