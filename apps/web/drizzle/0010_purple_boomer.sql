PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_connected_app_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`display_name` text NOT NULL,
	`category` text NOT NULL,
	`access_mode` text DEFAULT 'ask_each_time' NOT NULL,
	`last_reviewed_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "connected_app_access_mode_valid" CHECK("__new_connected_app_preferences"."access_mode" in ('never','ask_each_time','allow_approved_work_signals','actions_only'))
);
--> statement-breakpoint
INSERT INTO `__new_connected_app_preferences`("id", "user_id", "app_id", "display_name", "category", "access_mode", "last_reviewed_at", "revoked_at") SELECT "id", "user_id", "app_id", "display_name", "category", CASE WHEN "access_mode"='approved_summaries' THEN 'allow_approved_work_signals' ELSE "access_mode" END, "last_reviewed_at", "revoked_at" FROM `connected_app_preferences`;--> statement-breakpoint
DROP TABLE `connected_app_preferences`;--> statement-breakpoint
ALTER TABLE `__new_connected_app_preferences` RENAME TO `connected_app_preferences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `connected_app_user_app_unique` ON `connected_app_preferences` (`user_id`,`app_id`);--> statement-breakpoint
ALTER TABLE `networking_pulses` ADD `controls_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `project_or_interest` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `portfolio_links_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `surface_revisions` ADD `visibility` text DEFAULT 'private_preview' NOT NULL;
