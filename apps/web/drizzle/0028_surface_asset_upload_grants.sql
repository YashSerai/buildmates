CREATE TABLE `surface_asset_upload_grants` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `content_type` text NOT NULL CHECK (`content_type` IN ('image/jpeg','image/png')),
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `consumed_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `surface_asset_upload_grants_user_idx` ON `surface_asset_upload_grants` (`user_id`,`expires_at`);
