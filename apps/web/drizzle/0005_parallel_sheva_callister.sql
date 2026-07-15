PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `match_proposal_pair_identity_unique` ON `match_proposals` (`id`,`match_pair_id`);--> statement-breakpoint
CREATE TABLE `__new_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`match_pair_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`matched_at` integer NOT NULL,
	FOREIGN KEY (`match_pair_id`) REFERENCES `match_pairs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposal_id`) REFERENCES `match_proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposal_id`,`match_pair_id`) REFERENCES `match_proposals`(`id`,`match_pair_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_matches`("id", "match_pair_id", "proposal_id", "matched_at") SELECT "id", "match_pair_id", "proposal_id", "matched_at" FROM `matches`;--> statement-breakpoint
DROP TABLE `matches`;--> statement-breakpoint
ALTER TABLE `__new_matches` RENAME TO `matches`;--> statement-breakpoint
CREATE UNIQUE INDEX `match_pair_terminal_unique` ON `matches` (`match_pair_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `match_proposal_terminal_unique` ON `matches` (`proposal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `match_pair_identity_unique` ON `matches` (`id`,`match_pair_id`);--> statement-breakpoint
CREATE TABLE `__new_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`match_pair_id` text NOT NULL,
	`match_id` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`ended_by_user_id` text,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`match_pair_id`) REFERENCES `match_pairs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ended_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`,`match_pair_id`) REFERENCES `matches`(`id`,`match_pair_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_connections`("id", "match_pair_id", "match_id", "state", "ended_by_user_id", "ended_at", "created_at", "updated_at") SELECT "id", "match_pair_id", "match_id", "state", "ended_by_user_id", "ended_at", "created_at", "updated_at" FROM `connections`;--> statement-breakpoint
DROP TABLE `connections`;--> statement-breakpoint
ALTER TABLE `__new_connections` RENAME TO `connections`;--> statement-breakpoint
CREATE UNIQUE INDEX `connection_pair_unique` ON `connections` (`match_pair_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `connection_match_unique` ON `connections` (`match_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `connection_pair_identity_unique` ON `connections` (`id`,`match_pair_id`);--> statement-breakpoint
CREATE TABLE `__new_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`match_pair_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`theme_topic_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`match_pair_id`) REFERENCES `match_pairs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`theme_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connection_id`,`match_pair_id`) REFERENCES `connections`(`id`,`match_pair_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_rooms`("id", "match_pair_id", "connection_id", "status", "theme_topic_id", "created_at", "updated_at") SELECT "id", "match_pair_id", "connection_id", "status", "theme_topic_id", "created_at", "updated_at" FROM `rooms`;--> statement-breakpoint
DROP TABLE `rooms`;--> statement-breakpoint
ALTER TABLE `__new_rooms` RENAME TO `rooms`;--> statement-breakpoint
CREATE UNIQUE INDEX `room_pair_unique` ON `rooms` (`match_pair_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `room_connection_unique` ON `rooms` (`connection_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
