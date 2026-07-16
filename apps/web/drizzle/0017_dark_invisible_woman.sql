CREATE TABLE `availability_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`timezone` text NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "availability_window_time_order" CHECK("availability_windows"."ends_at" > "availability_windows"."starts_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `availability_window_owner_interval_unique` ON `availability_windows` (`room_id`,`user_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `availability_window_room_status_time_idx` ON `availability_windows` (`room_id`,`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `connection_context_snapshots` (
	`connection_id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`shared_context_json` text DEFAULT '[]' NOT NULL,
	`theme_topic_id` text,
	`captured_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`theme_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invite_redemptions` (
	`invite_id` text NOT NULL,
	`user_id` text NOT NULL,
	`accepted_at` integer NOT NULL,
	PRIMARY KEY(`invite_id`, `user_id`),
	FOREIGN KEY (`invite_id`) REFERENCES `invite_links`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invite_redemptions_user_idx` ON `invite_redemptions` (`user_id`,`accepted_at`);--> statement-breakpoint
ALTER TABLE `calendar_event_receipts` ADD `meeting_proposal_id` text REFERENCES meeting_proposals(id);--> statement-breakpoint
ALTER TABLE `invite_links` ADD `recipient_user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `invite_recipient_active_idx` ON `invite_links` (`recipient_user_id`,`expires_at`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `location_map_opt_in` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `reconnect_one_pending_per_connection` ON `reconnect_requests` (`connection_id`) WHERE "reconnect_requests"."response" = 'pending';