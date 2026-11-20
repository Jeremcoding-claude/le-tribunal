CREATE TABLE `artifacts` (
	`trial_id` text NOT NULL,
	`nom` text NOT NULL,
	`contenu` text NOT NULL,
	`cree_le` text NOT NULL,
	PRIMARY KEY(`trial_id`, `nom`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trial_id` text NOT NULL,
	`seq` integer NOT NULL,
	`type` text NOT NULL,
	`ts` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_trial_seq` ON `events` (`trial_id`,`seq`);--> statement-breakpoint
CREATE TABLE `phases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trial_id` text NOT NULL,
	`phase` text NOT NULL,
	`etat` text NOT NULL,
	`sauve_le` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `phases_trial` ON `phases` (`trial_id`);--> statement-breakpoint
CREATE TABLE `trials` (
	`id` text PRIMARY KEY NOT NULL,
	`texte` text NOT NULL,
	`pays` text DEFAULT 'FR' NOT NULL,
	`statut` text DEFAULT 'en_cours' NOT NULL,
	`message` text,
	`cree_le` text NOT NULL,
	`modifie_le` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage` (
	`trial_id` text NOT NULL,
	`phase` text NOT NULL,
	`cout_usd` real NOT NULL,
	`tokens_entree` integer DEFAULT 0 NOT NULL,
	`tokens_sortie` integer DEFAULT 0 NOT NULL,
	`recherches` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`trial_id`, `phase`)
);
