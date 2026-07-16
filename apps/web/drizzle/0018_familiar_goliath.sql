CREATE TABLE `circle_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`sender_user_id` text NOT NULL,
	`client_message_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circle_message_client_unique` ON `circle_messages` (`circle_id`,`sender_user_id`,`client_message_id`);--> statement-breakpoint
CREATE INDEX `circle_message_circle_time_idx` ON `circle_messages` (`circle_id`,`created_at`,`id`);