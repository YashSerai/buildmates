CREATE TABLE `profile_topic_contributions` (
	`user_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `topic_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_topic_contributions_topic_idx` ON `profile_topic_contributions` (`topic_id`,`updated_at`);
