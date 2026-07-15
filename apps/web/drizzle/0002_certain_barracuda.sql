CREATE TABLE `oauth_authorization_handoffs` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`request_uri` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`consumed_by_jti` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `private_capability_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL
);
