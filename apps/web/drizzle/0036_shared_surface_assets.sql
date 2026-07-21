CREATE TABLE `surface_asset_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`surface_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`attached_by_user_id` text NOT NULL,
	`binding_key` text NOT NULL,
	`alt_text` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`surface_id`) REFERENCES `surfaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `surface_assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attached_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `surface_asset_attachment_asset_unique` ON `surface_asset_attachments` (`surface_id`,`asset_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `surface_asset_attachment_binding_unique` ON `surface_asset_attachments` (`surface_id`,`binding_key`);
