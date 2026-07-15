CREATE TABLE `calendar_event_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`attached_by_user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`participant_labels_json` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attached_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_provider_event_unique` ON `calendar_event_receipts` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE TABLE `setup_states` (
	`user_id` text PRIMARY KEY NOT NULL,
	`completed_steps_json` text DEFAULT '["identity_link"]' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `source_use_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_app_id` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `source_use_approval_lookup_idx` ON `source_use_approvals` (`user_id`,`source_app_id`,`expires_at`);--> statement-breakpoint
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
	CONSTRAINT "connected_app_access_mode_valid" CHECK("__new_connected_app_preferences"."access_mode" in ('never','ask_each_time','approved_summaries','allow_approved_work_signals','actions_only'))
);
--> statement-breakpoint
INSERT INTO `__new_connected_app_preferences`("id", "user_id", "app_id", "display_name", "category", "access_mode", "last_reviewed_at", "revoked_at") SELECT "id", "user_id", "app_id", "display_name", "category", "access_mode", "last_reviewed_at", "revoked_at" FROM `connected_app_preferences`;--> statement-breakpoint
DROP TABLE `connected_app_preferences`;--> statement-breakpoint
ALTER TABLE `__new_connected_app_preferences` RENAME TO `connected_app_preferences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `connected_app_user_app_unique` ON `connected_app_preferences` (`user_id`,`app_id`);--> statement-breakpoint
ALTER TABLE `work_signals` ADD `canonical_stage_ids_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_signals` ADD `canonical_collaboration_intent_ids_json` text DEFAULT '[]' NOT NULL;