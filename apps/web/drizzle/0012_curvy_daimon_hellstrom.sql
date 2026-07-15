CREATE INDEX `assertion_replay_expiry_idx` ON `assertion_replays` (`expires_at`);--> statement-breakpoint
CREATE INDEX `mcp_rate_limit_expiry_idx` ON `mcp_rate_limits` (`window_expires_at`);--> statement-breakpoint
CREATE INDEX `candidate_batch_user_expiry_id_idx` ON `candidate_batches` (`user_id`,`expires_at`,`id`);--> statement-breakpoint
CREATE INDEX `circle_membership_user_status_circle_idx` ON `circle_memberships` (`user_id`,`status`,`circle_id`);--> statement-breakpoint
CREATE INDEX `connection_note_owner_id_idx` ON `connection_private_notes` (`owner_user_id`,`id`);--> statement-breakpoint
CREATE INDEX `connection_note_owner_connection_id_idx` ON `connection_private_notes` (`owner_user_id`,`connection_id`,`id`);--> statement-breakpoint
CREATE INDEX `connection_reminder_user_id_idx` ON `connection_reminders` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `connection_reminder_user_connection_id_idx` ON `connection_reminders` (`user_id`,`connection_id`,`id`);--> statement-breakpoint
CREATE INDEX `connection_side_user_connection_idx` ON `connection_sides` (`user_id`,`connection_id`);--> statement-breakpoint
CREATE INDEX `room_membership_user_active_room_idx` ON `room_memberships` (`user_id`,`left_at`,`room_id`);