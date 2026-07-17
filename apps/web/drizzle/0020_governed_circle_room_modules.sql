CREATE TABLE `room_module_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`module_id`) REFERENCES `room_modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `room_module_entry_module_time_idx` ON `room_module_entries` (`module_id`,`deleted_at`,`created_at`);
--> statement-breakpoint
ALTER TABLE `circle_module_entries` ADD `deleted_at` integer;
--> statement-breakpoint
CREATE INDEX `circle_module_entry_module_time_idx` ON `circle_module_entries` (`module_id`,`deleted_at`,`created_at`);
--> statement-breakpoint
CREATE TABLE `circle_module_rule_versions` (
	`module_id` text NOT NULL,
	`version` integer NOT NULL,
	`proposal_id` text NOT NULL,
	`rules_json` text NOT NULL,
	`approved_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`module_id`, `version`),
	FOREIGN KEY (`module_id`) REFERENCES `circle_modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposal_id`) REFERENCES `circle_proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circle_module_rule_proposal_unique` ON `circle_module_rule_versions` (`proposal_id`);
