ALTER TABLE `deliveries` ADD `is_test` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `editions` ADD `is_test` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscribers` ADD `is_test` integer DEFAULT 0 NOT NULL;