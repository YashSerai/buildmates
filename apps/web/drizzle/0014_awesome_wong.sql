CREATE TABLE `profile_fields` (
	`profile_id` text NOT NULL,
	`field_key` text NOT NULL,
	`value_json` text NOT NULL,
	`audience` text DEFAULT 'private' NOT NULL,
	`cohort_scope_id` text,
	`allow_matching` integer DEFAULT false NOT NULL,
	`source_status` text DEFAULT 'confirmed' NOT NULL,
	`provenance` text DEFAULT 'self_reported' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`profile_id`, `field_key`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cohort_scope_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "profile_field_audience_valid" CHECK("profile_fields"."audience" in ('public','signed_in','suggested_connections','mutual_connections','private')),
	CONSTRAINT "profile_field_matching_boolean" CHECK("profile_fields"."allow_matching" in (0,1)),
	CONSTRAINT "profile_field_source_valid" CHECK("profile_fields"."source_status" in ('generated','confirmed')),
	CONSTRAINT "profile_field_provenance_valid" CHECK("profile_fields"."provenance" in ('self_reported','codex_summary','connected_app','system'))
);
--> statement-breakpoint
CREATE INDEX `profile_fields_audience_idx` ON `profile_fields` (`profile_id`,`audience`);--> statement-breakpoint
CREATE TABLE `profile_statistics` (
	`profile_id` text NOT NULL,
	`stat_key` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`provenance` text NOT NULL,
	`audience` text DEFAULT 'private' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`profile_id`, `stat_key`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profile_stat_audience_valid" CHECK("profile_statistics"."audience" in ('public','signed_in','suggested_connections','mutual_connections','private')),
	CONSTRAINT "profile_stat_provenance_valid" CHECK("profile_statistics"."provenance" in ('self_reported','connected_app','system'))
);
--> statement-breakpoint
CREATE TABLE `project_links` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_media` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`alt_text` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `surface_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_taxonomy_items` (
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`taxonomy_item_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `kind`, `taxonomy_item_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_taxonomy_kind_valid" CHECK("project_taxonomy_items"."kind" in ('topic','tool','domain'))
);
--> statement-breakpoint
CREATE TABLE `project_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`body` text NOT NULL,
	`audience` text DEFAULT 'public' NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_update_audience_valid" CHECK("project_updates"."audience" in ('public','signed_in','suggested_connections','mutual_connections','private'))
);
--> statement-breakpoint
DROP INDEX `project_owner_slug_unique`;--> statement-breakpoint
ALTER TABLE `projects` ADD `stage` text DEFAULT 'exploring' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `indexable` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `published_at` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `deleted_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `project_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE INDEX `builder_match_index_taxonomy_version_idx` ON `builder_match_index` (`taxonomy_version_id`,`version`);--> statement-breakpoint
CREATE INDEX `pair_scores_user_a_expiry_score_idx` ON `pair_scores` (`user_a_id`,`expires_at`,`total_basis_points`);--> statement-breakpoint
CREATE INDEX `pair_scores_user_b_expiry_score_idx` ON `pair_scores` (`user_b_id`,`expires_at`,`total_basis_points`);