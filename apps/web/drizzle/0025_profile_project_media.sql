CREATE TABLE `profile_project_media` (
	`profile_id` text NOT NULL,
	`project_key` text NOT NULL,
	`asset_id` text NOT NULL,
	`alt_text` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`profile_id`, `project_key`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `surface_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_project_media_asset_unique` ON `profile_project_media` (`profile_id`,`asset_id`);
