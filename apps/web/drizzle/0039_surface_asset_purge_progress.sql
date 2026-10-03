ALTER TABLE `surface_assets` ADD COLUMN `object_purged_at` integer;
--> statement-breakpoint
CREATE INDEX `surface_asset_purge_idx` ON `surface_assets` (`owner_user_id`,`deleted_at`,`object_purged_at`,`object_key`);
