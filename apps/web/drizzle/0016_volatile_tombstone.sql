CREATE TABLE `connection_snapshots` (
	`connection_id` text NOT NULL,
	`subject_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`summary` text NOT NULL,
	`captured_at` integer NOT NULL,
	PRIMARY KEY(`connection_id`, `subject_user_id`),
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meeting_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`proposer_user_id` text NOT NULL,
	`parent_proposal_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`timezone` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'proposed' NOT NULL,
	`responded_by_user_id` text,
	`responded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`responded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "meeting_proposal_time_order" CHECK("meeting_proposals"."ends_at" > "meeting_proposals"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `meeting_proposal_room_status_idx` ON `meeting_proposals` (`room_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `room_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`kind` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposal_id`) REFERENCES `room_upgrade_proposals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_module_kind_unique` ON `room_modules` (`room_id`,`kind`);--> statement-breakpoint
CREATE INDEX `room_module_room_idx` ON `room_modules` (`room_id`,`active`);--> statement-breakpoint
CREATE TABLE `room_upgrade_responses` (
	`proposal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`response` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`proposal_id`, `user_id`),
	FOREIGN KEY (`proposal_id`) REFERENCES `room_upgrade_proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
