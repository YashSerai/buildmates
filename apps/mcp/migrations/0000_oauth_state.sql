-- The external MCP Worker stores OAuth and short-lived handoff state only.
-- Canonical Buildmates product data remains in the ChatGPT Sites D1 database.
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
CREATE UNIQUE INDEX `identity_principal_subject_scope_unique` ON `identity_principals` (`channel`,`issuer`,`subject`,`workspace_scope`);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `principal_id` text NOT NULL,
  `token_hash` text NOT NULL,
  `token_kind` text NOT NULL,
  `client_id` text NOT NULL,
  `family_id` text NOT NULL,
  `audience` text NOT NULL,
  `scopes` text NOT NULL,
  `redirect_uri` text,
  `pkce_challenge` text,
  `expires_at` integer NOT NULL,
  `consumed_at` integer,
  `consumed_by_id` text,
  `revoked_at` integer,
  `rotated_from_id` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`principal_id`) REFERENCES `identity_principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_token_hash_unique` ON `oauth_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `oauth_token_family_idx` ON `oauth_tokens` (`family_id`);
--> statement-breakpoint
CREATE TABLE `oauth_authorization_handoffs` (
  `state_hash` text PRIMARY KEY NOT NULL,
  `request_uri` text NOT NULL,
  `expires_at` integer NOT NULL,
  `consumed_at` integer,
  `consumed_by_jti` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_handoff_expiry_idx` ON `oauth_authorization_handoffs` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `assertion_replays` (
  `jti` text PRIMARY KEY NOT NULL,
  `issuer` text NOT NULL,
  `subject` text NOT NULL,
  `action` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assertion_replay_issuer_jti_unique` ON `assertion_replays` (`issuer`,`jti`);
--> statement-breakpoint
CREATE INDEX `assertion_replay_expiry_idx` ON `assertion_replays` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `mcp_rate_limits` (
  `key` text PRIMARY KEY NOT NULL,
  `attempt_count` integer NOT NULL,
  `window_expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mcp_rate_limit_expiry_idx` ON `mcp_rate_limits` (`window_expires_at`);
