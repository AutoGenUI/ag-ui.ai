CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`subscriber_id` text NOT NULL,
	`edition_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`provider_id` text,
	`created_at` text NOT NULL,
	`attempted_at` text,
	`updated_at` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `editions` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `news` (
	`slug` text PRIMARY KEY NOT NULL,
	`canonical_url` text NOT NULL,
	`status` text NOT NULL,
	`event_date` text NOT NULL,
	`project` text NOT NULL,
	`category` text NOT NULL,
	`payload` text NOT NULL,
	`hash` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_canonical_url_unique` ON `news` (`canonical_url`);--> statement-breakpoint
CREATE TABLE `mail_quota` (
	`day` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`hash` text NOT NULL,
	`payload` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`result` text
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`checked_at` text,
	`successful_at` text,
	`error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_url_unique` ON `sources` (`url`);--> statement-breakpoint
CREATE TABLE `stats_events` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`path` text NOT NULL,
	`kind` text NOT NULL,
	`visitor` text NOT NULL,
	`source` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stats_dedupe` ON `stats_events` (`id`,`kind`);--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`locale` text NOT NULL,
	`topics` text NOT NULL,
	`status` text NOT NULL,
	`token_hash` text,
	`token_expires` text,
	`created_at` text NOT NULL,
	`confirmed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email_unique` ON `subscribers` (`email`);--> statement-breakpoint
CREATE TABLE `trends` (
	`slug` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
