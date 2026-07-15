CREATE TABLE `assertion_replays` (
	`jti` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`action` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assertion_replay_issuer_jti_unique` ON `assertion_replays` (`issuer`,`jti`);--> statement-breakpoint
CREATE TABLE `identity_link_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`workspace_scope` text DEFAULT 'global' NOT NULL,
	`expires_at` integer NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_link_code_hash_unique` ON `identity_link_codes` (`code_hash`);--> statement-breakpoint
CREATE TABLE `identity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`principal_id` text NOT NULL,
	`provider_channel` text NOT NULL,
	`provider_issuer` text NOT NULL,
	`provider_subject` text NOT NULL,
	`workspace_scope` text DEFAULT 'global' NOT NULL,
	`linked_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`principal_id`) REFERENCES `identity_principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_link_subject_scope_unique` ON `identity_links` (`provider_channel`,`provider_issuer`,`provider_subject`,`workspace_scope`);--> statement-breakpoint
CREATE UNIQUE INDEX `identity_link_principal_unique` ON `identity_links` (`principal_id`);--> statement-breakpoint
CREATE TABLE `identity_principals` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`workspace_scope` text DEFAULT 'global' NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_principal_subject_scope_unique` ON `identity_principals` (`channel`,`issuer`,`subject`,`workspace_scope`);--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`principal_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_kind` text NOT NULL,
	`audience` text NOT NULL,
	`scopes` text NOT NULL,
	`redirect_uri` text,
	`pkce_challenge` text,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`revoked_at` integer,
	`rotated_from_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`principal_id`) REFERENCES `identity_principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_token_hash_unique` ON `oauth_tokens` (`token_hash`);