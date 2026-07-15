ALTER TABLE `work_signals` ADD `source_approval_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `work_signal_source_approval_unique` ON `work_signals` (`source_approval_id`);