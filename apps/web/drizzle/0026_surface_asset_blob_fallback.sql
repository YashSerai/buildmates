CREATE TABLE `surface_asset_blobs` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`bytes` blob NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `surface_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
