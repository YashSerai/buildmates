CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`object_kind` text NOT NULL,
	`object_id` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`idempotency_key` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_idempotency_unique` ON `audit_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `audit_object_idx` ON `audit_events` (`object_kind`,`object_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `automation_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`cursor` text,
	`last_success_at` integer,
	`next_run_at` integer,
	`state_json` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_user_kind_unique` ON `automation_checkpoints` (`user_id`,`kind`);--> statement-breakpoint
CREATE TABLE `blocks` (
	`blocker_user_id` text NOT NULL,
	`blocked_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	PRIMARY KEY(`blocker_user_id`, `blocked_user_id`),
	FOREIGN KEY (`blocker_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`blocked_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "block_no_self" CHECK("blocks"."blocker_user_id" <> "blocks"."blocked_user_id")
);
--> statement-breakpoint
CREATE TABLE `builder_match_index` (
	`user_id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`taxonomy_version_id` text NOT NULL,
	`topics_json` text DEFAULT '[]' NOT NULL,
	`tools_json` text DEFAULT '[]' NOT NULL,
	`domains_json` text DEFAULT '[]' NOT NULL,
	`stages_json` text DEFAULT '[]' NOT NULL,
	`intents_json` text DEFAULT '[]' NOT NULL,
	`coarse_location` text,
	`timezone` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taxonomy_version_id`) REFERENCES `taxonomy_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `candidate_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`index_version` integer NOT NULL,
	`taxonomy_version` integer NOT NULL,
	`candidate_ids_json` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `circle_memberships` (
	`circle_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`joined_at` integer,
	PRIMARY KEY(`circle_id`, `user_id`),
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `circle_metric_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_id` text NOT NULL,
	`user_id` text NOT NULL,
	`value` integer NOT NULL,
	`evidence` text,
	`period_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`metric_id`) REFERENCES `circle_metrics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circle_metric_user_period_unique` ON `circle_metric_entries` (`metric_id`,`user_id`,`period_key`);--> statement-breakpoint
CREATE TABLE `circle_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`name` text NOT NULL,
	`rule_json` text NOT NULL,
	`rules_version` integer DEFAULT 1 NOT NULL,
	`ranking_opt_out_allowed` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `circle_module_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `circle_modules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `circle_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`kind` text NOT NULL,
	`config_json` text NOT NULL,
	`rules_version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `circle_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`proposer_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`governance_version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `circle_votes` (
	`proposal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`vote` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`proposal_id`, `user_id`),
	FOREIGN KEY (`proposal_id`) REFERENCES `circle_proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `circles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`governance_mode` text DEFAULT 'admin' NOT NULL,
	`governance_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `codex_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`decision` text NOT NULL,
	`reason_summary` text NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`index_version` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `match_proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_proposal_user_unique` ON `codex_evaluations` (`proposal_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `cohort_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`inviter_user_id` text NOT NULL,
	`invitee_user_id` text,
	`invitee_address_hash` text,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`responded_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invitee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "cohort_invitation_target_present" CHECK("cohort_invitations"."invitee_user_id" is not null or "cohort_invitations"."invitee_address_hash" is not null),
	CONSTRAINT "cohort_invitation_status_valid" CHECK("cohort_invitations"."status" in ('pending','accepted','declined','revoked','expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cohort_invitation_token_unique` ON `cohort_invitations` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `cohort_invitation_pending_user_unique` ON `cohort_invitations` (`cohort_id`,`invitee_user_id`) WHERE "cohort_invitations"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX `cohort_invitation_pending_address_unique` ON `cohort_invitations` (`cohort_id`,`invitee_address_hash`) WHERE "cohort_invitations"."status" = 'pending';--> statement-breakpoint
CREATE TABLE `cohort_memberships` (
	`cohort_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`joined_at` integer,
	PRIMARY KEY(`cohort_id`, `user_id`),
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`visibility` text DEFAULT 'request' NOT NULL,
	`community_created` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cohort_slug_unique` ON `cohorts` (`slug`);--> statement-breakpoint
CREATE TABLE `collaboration_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`taxonomy_version_id` text NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`taxonomy_version_id`) REFERENCES `taxonomy_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intent_version_slug_unique` ON `collaboration_intents` (`taxonomy_version_id`,`slug`);--> statement-breakpoint
CREATE TABLE `connected_app_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`display_name` text NOT NULL,
	`category` text NOT NULL,
	`access_mode` text DEFAULT 'ask_each_time' NOT NULL,
	`last_reviewed_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "connected_app_access_mode_valid" CHECK("connected_app_preferences"."access_mode" in ('never','ask_each_time','approved_summaries'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connected_app_user_app_unique` ON `connected_app_preferences` (`user_id`,`app_id`);--> statement-breakpoint
CREATE TABLE `connection_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_user_id` text NOT NULL,
	`project_id` text,
	`headline` text NOT NULL,
	`topic_ids_json` text DEFAULT '[]' NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`maximum_uses` integer DEFAULT 20 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`creator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "connection_card_status_valid" CHECK("connection_cards"."status" in ('active','revoked','expired')),
	CONSTRAINT "connection_card_use_bounds" CHECK("connection_cards"."maximum_uses" > 0 and "connection_cards"."use_count" >= 0 and "connection_cards"."use_count" <= "connection_cards"."maximum_uses")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connection_card_token_unique` ON `connection_cards` (`token_hash`);--> statement-breakpoint
CREATE TABLE `connection_private_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `connection_note_owner_idx` ON `connection_private_notes` (`connection_id`,`owner_user_id`);--> statement-breakpoint
CREATE TABLE `connection_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`user_id` text NOT NULL,
	`remind_at` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `connection_sides` (
	`connection_id` text NOT NULL,
	`user_id` text NOT NULL,
	`muted` integer DEFAULT false NOT NULL,
	`renewed_relevance_enabled` integer DEFAULT true NOT NULL,
	`unread_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`connection_id`, `user_id`),
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `connection_update_subscriptions` (
	`connection_id` text NOT NULL,
	`subscriber_user_id` text NOT NULL,
	`subject_user_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`connection_id`, `subscriber_user_id`),
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscriber_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "connection_subscription_other_side" CHECK("connection_update_subscriptions"."subscriber_user_id" <> "connection_update_subscriptions"."subject_user_id")
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`match_pair_id` text NOT NULL,
	`match_id` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`ended_by_user_id` text,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`match_pair_id`) REFERENCES `match_pairs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ended_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connection_pair_unique` ON `connections` (`match_pair_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `connection_match_unique` ON `connections` (`match_id`);--> statement-breakpoint
CREATE TABLE `deletion_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`requested_at` integer NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `design_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`source_hash` text NOT NULL,
	`policy_json` text NOT NULL,
	`activated_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `design_policy_version_unique` ON `design_policies` (`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `design_policy_source_hash_unique` ON `design_policies` (`source_hash`);--> statement-breakpoint
CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`taxonomy_version_id` text NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`taxonomy_version_id`) REFERENCES `taxonomy_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domain_version_slug_unique` ON `domains` (`taxonomy_version_id`,`slug`);--> statement-breakpoint
CREATE TABLE `export_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`object_key` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_user_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	PRIMARY KEY(`follower_user_id`, `target_kind`, `target_id`),
	FOREIGN KEY (`follower_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `handles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`normalized_handle` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handles_normalized_unique` ON `handles` (`normalized_handle`);--> statement-breakpoint
CREATE TABLE `human_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`response` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `match_proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `human_response_proposal_user_unique` ON `human_responses` (`proposal_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`operation` text NOT NULL,
	`key_hash` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_json` text,
	`status` text DEFAULT 'processing' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_actor_operation_key_unique` ON `idempotency_keys` (`actor_user_id`,`operation`,`key_hash`);--> statement-breakpoint
CREATE TABLE `introduction_budgets` (
	`user_id` text PRIMARY KEY NOT NULL,
	`maximum_per_week` integer DEFAULT 3 NOT NULL,
	`used_this_week` integer DEFAULT 0 NOT NULL,
	`week_started_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "intro_budget_nonnegative" CHECK("introduction_budgets"."maximum_per_week" >= 0 and "introduction_budgets"."used_this_week" >= 0)
);
--> statement-breakpoint
CREATE TABLE `introduction_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`user_id` text NOT NULL,
	`useful` integer NOT NULL,
	`reasons_json` text DEFAULT '[]' NOT NULL,
	`similar_match_preference` text,
	`follow_up_intent` text,
	`private_note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_connection_user_unique` ON `introduction_feedback` (`connection_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `invite_links` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`token_hash` text NOT NULL,
	`target_id` text,
	`maximum_uses` integer DEFAULT 1 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`creator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_token_hash_unique` ON `invite_links` (`token_hash`);--> statement-breakpoint
CREATE TABLE `match_pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_a_id` text NOT NULL,
	`user_b_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_a_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_b_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "match_pair_canonical" CHECK("match_pairs"."user_a_id" < "match_pairs"."user_b_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_pair_users_unique` ON `match_pairs` (`user_a_id`,`user_b_id`);--> statement-breakpoint
CREATE TABLE `match_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`match_pair_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`evidence_version_a` integer NOT NULL,
	`evidence_version_b` integer NOT NULL,
	`acceptance_mode_a` text NOT NULL,
	`acceptance_mode_b` text NOT NULL,
	`explanation_a_json` text NOT NULL,
	`explanation_b_json` text NOT NULL,
	`shared_explanation_json` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`terminal_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_pair_id`) REFERENCES `match_pairs`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "match_proposal_acceptance_a_valid" CHECK("match_proposals"."acceptance_mode_a" in ('manual','full_autopilot')),
	CONSTRAINT "match_proposal_acceptance_b_valid" CHECK("match_proposals"."acceptance_mode_b" in ('manual','full_autopilot'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_proposal_attempt_unique` ON `match_proposals` (`match_pair_id`,`attempt_number`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`match_pair_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`matched_at` integer NOT NULL,
	FOREIGN KEY (`match_pair_id`) REFERENCES `match_pairs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposal_id`) REFERENCES `match_proposals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_pair_terminal_unique` ON `matches` (`match_pair_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `match_proposal_terminal_unique` ON `matches` (`proposal_id`);--> statement-breakpoint
CREATE TABLE `matching_exclusions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`normalized_value` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matching_exclusion_unique` ON `matching_exclusions` (`user_id`,`kind`,`normalized_value`);--> statement-breakpoint
CREATE TABLE `matching_snoozes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reason` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`sender_user_id` text NOT NULL,
	`client_message_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_client_id_unique` ON `messages` (`room_id`,`sender_user_id`,`client_message_id`);--> statement-breakpoint
CREATE INDEX `messages_room_created_idx` ON `messages` (`room_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `moderation_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`operator_user_id` text NOT NULL,
	`action` text NOT NULL,
	`reason_code` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `moderation_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `moderation_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`appellant_user_id` text NOT NULL,
	`statement` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`case_id`) REFERENCES `moderation_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appellant_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `moderation_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`assigned_operator_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moderation_case_report_unique` ON `moderation_cases` (`report_id`);--> statement-breakpoint
CREATE TABLE `networking_pulses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`intent_summary` text NOT NULL,
	`similar_adjacent` integer DEFAULT 50 NOT NULL,
	`local_global` integer DEFAULT 50 NOT NULL,
	`serendipity` integer DEFAULT 25 NOT NULL,
	`collaboration_intent_ids_json` text DEFAULT '[]' NOT NULL,
	`starts_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `networking_pulse_user_expiry_idx` ON `networking_pulses` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`delivery` text DEFAULT 'immediate' NOT NULL,
	`payload_json` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notification_inbox_idx` ON `notifications` (`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `pair_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_a_id` text NOT NULL,
	`user_b_id` text NOT NULL,
	`index_version_a` integer NOT NULL,
	`index_version_b` integer NOT NULL,
	`taxonomy_version` integer NOT NULL,
	`weight_version` integer NOT NULL,
	`components_json` text NOT NULL,
	`evidence_ids_json` text DEFAULT '[]' NOT NULL,
	`audience_decisions_json` text DEFAULT '[]' NOT NULL,
	`total_basis_points` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_a_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_b_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pair_score_canonical_pair" CHECK("pair_scores"."user_a_id" < "pair_scores"."user_b_id"),
	CONSTRAINT "pair_score_range" CHECK("pair_scores"."total_basis_points" between 0 and 10000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pair_score_versions_unique` ON `pair_scores` (`user_a_id`,`user_b_id`,`index_version_a`,`index_version_b`,`weight_version`);--> statement-breakpoint
CREATE TABLE `personal_surface_views` (
	`id` text PRIMARY KEY NOT NULL,
	`surface_id` text NOT NULL,
	`user_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`surface_id`) REFERENCES `surfaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `surface_revisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personal_surface_view_unique` ON `personal_surface_views` (`surface_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`summary` text NOT NULL,
	`audience` text DEFAULT 'private' NOT NULL,
	`cohort_scope_id` text,
	`allow_matching` integer DEFAULT false NOT NULL,
	`acceptance_mode` text DEFAULT 'manual' NOT NULL,
	`indexable` integer DEFAULT false NOT NULL,
	`coarse_location` text,
	`timezone` text,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cohort_scope_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "profile_audience_valid" CHECK("profiles"."audience" in ('public','signed_in','suggested_connections','mutual_connections','private')),
	CONSTRAINT "profile_allow_matching_boolean" CHECK("profiles"."allow_matching" in (0,1)),
	CONSTRAINT "profile_acceptance_mode_valid" CHECK("profiles"."acceptance_mode" in ('manual','full_autopilot'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_user_unique` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `project_collaborators` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`approved_at` integer,
	PRIMARY KEY(`project_id`, `user_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`audience` text DEFAULT 'private' NOT NULL,
	`cohort_scope_id` text,
	`allow_matching` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cohort_scope_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_audience_valid" CHECK("projects"."audience" in ('public','signed_in','suggested_connections','mutual_connections','private')),
	CONSTRAINT "project_allow_matching_boolean" CHECK("projects"."allow_matching" in (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_owner_slug_unique` ON `projects` (`owner_user_id`,`slug`);--> statement-breakpoint
CREATE TABLE `quiet_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`timezone` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "quiet_hours_weekday" CHECK("quiet_hours"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiet_hours_slot_unique` ON `quiet_hours` (`user_id`,`weekday`,`start_minute`,`end_minute`);--> statement-breakpoint
CREATE TABLE `reconnect_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`requester_user_id` text NOT NULL,
	`response` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requester_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `redaction_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redaction_source_unique` ON `redaction_jobs` (`user_id`,`source_kind`,`source_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_user_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`reason_code` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'received' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `room_memberships` (
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	`last_read_message_id` text,
	PRIMARY KEY(`room_id`, `user_id`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `room_upgrade_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`proposer_user_id` text NOT NULL,
	`modules_json` text NOT NULL,
	`explanation` text NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`match_pair_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`theme_topic_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`match_pair_id`) REFERENCES `match_pairs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`theme_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_pair_unique` ON `rooms` (`match_pair_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `room_connection_unique` ON `rooms` (`connection_id`);--> statement-breakpoint
CREATE TABLE `stages` (
	`id` text PRIMARY KEY NOT NULL,
	`taxonomy_version_id` text NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`ordinal` integer NOT NULL,
	FOREIGN KEY (`taxonomy_version_id`) REFERENCES `taxonomy_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stage_version_slug_unique` ON `stages` (`taxonomy_version_id`,`slug`);--> statement-breakpoint
CREATE TABLE `surface_approvals` (
	`revision_id` text NOT NULL,
	`user_id` text NOT NULL,
	`governance_version` integer NOT NULL,
	`decision` text NOT NULL,
	`decided_at` integer NOT NULL,
	PRIMARY KEY(`revision_id`, `user_id`),
	FOREIGN KEY (`revision_id`) REFERENCES `surface_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `surface_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `surface_asset_object_key_unique` ON `surface_assets` (`object_key`);--> statement-breakpoint
CREATE TABLE `surface_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`surface_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`base_revision_number` integer,
	`author_user_id` text NOT NULL,
	`design_policy_id` text NOT NULL,
	`spec_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`surface_id`) REFERENCES `surfaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`design_policy_id`) REFERENCES `design_policies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `surface_revision_number_unique` ON `surface_revisions` (`surface_id`,`revision_number`);--> statement-breakpoint
CREATE TABLE `surfaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`published_revision_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `surface_subject_unique` ON `surfaces` (`kind`,`subject_id`);--> statement-breakpoint
CREATE TABLE `taxonomy_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`activated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_version_unique` ON `taxonomy_versions` (`version`);--> statement-breakpoint
CREATE TABLE `tools` (
	`id` text PRIMARY KEY NOT NULL,
	`taxonomy_version_id` text NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`taxonomy_version_id`) REFERENCES `taxonomy_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_version_slug_unique` ON `tools` (`taxonomy_version_id`,`slug`);--> statement-breakpoint
CREATE TABLE `topic_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`normalized_alias` text NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_alias_unique` ON `topic_aliases` (`topic_id`,`normalized_alias`);--> statement-breakpoint
CREATE TABLE `topic_relationships` (
	`from_topic_id` text NOT NULL,
	`to_topic_id` text NOT NULL,
	`kind` text NOT NULL,
	`weight_basis_points` integer DEFAULT 5000 NOT NULL,
	PRIMARY KEY(`from_topic_id`, `to_topic_id`, `kind`),
	FOREIGN KEY (`from_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "topic_relationship_no_self" CHECK("topic_relationships"."from_topic_id" <> "topic_relationships"."to_topic_id")
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`taxonomy_version_id` text NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`taxonomy_version_id`) REFERENCES `taxonomy_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_version_slug_unique` ON `topics` (`taxonomy_version_id`,`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`operator_role` text DEFAULT 'none' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `watches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watch_user_target_unique` ON `watches` (`user_id`,`kind`,`target_id`);--> statement-breakpoint
CREATE TABLE `work_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_app_id` text,
	`taxonomy_version_id` text NOT NULL,
	`free_text_summary` text NOT NULL,
	`canonical_topic_ids_json` text DEFAULT '[]' NOT NULL,
	`canonical_tool_ids_json` text DEFAULT '[]' NOT NULL,
	`canonical_domain_ids_json` text DEFAULT '[]' NOT NULL,
	`audience` text DEFAULT 'private' NOT NULL,
	`cohort_scope_id` text,
	`allow_matching` integer DEFAULT false NOT NULL,
	`approved_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taxonomy_version_id`) REFERENCES `taxonomy_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cohort_scope_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "work_signal_audience_valid" CHECK("work_signals"."audience" in ('public','signed_in','suggested_connections','mutual_connections','private')),
	CONSTRAINT "work_signal_allow_matching_boolean" CHECK("work_signals"."allow_matching" in (0,1))
);
--> statement-breakpoint
CREATE INDEX `work_signal_user_expiry_idx` ON `work_signals` (`user_id`,`expires_at`);--> statement-breakpoint
DROP INDEX `identity_link_subject_scope_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `identity_link_subject_scope_unique` ON `identity_links` (`provider_channel`,`provider_issuer`,`provider_subject`,`workspace_scope`) WHERE "identity_links"."revoked_at" is null;