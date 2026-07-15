CREATE TABLE `mcp_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempt_count` integer NOT NULL,
	`window_expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `platform_capability_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `identity_link_codes` ADD `consumed_by_principal_id` text;--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD `client_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD `family_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `oauth_tokens` ADD `consumed_by_id` text;