CREATE TABLE `web_login_attempts` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`code_verifier` text NOT NULL,
	`return_to` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `web_login_attempt_expiry_idx` ON `web_login_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `web_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`principal_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`principal_id`) REFERENCES `identity_principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `web_session_token_hash_unique` ON `web_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `web_session_user_idx` ON `web_sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `web_session_principal_idx` ON `web_sessions` (`principal_id`,`expires_at`);