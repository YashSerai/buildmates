ALTER TABLE `users` ADD COLUMN `data_origin` text DEFAULT 'live' NOT NULL CHECK (`data_origin` in ('live','qa_fixture'));
--> statement-breakpoint
CREATE INDEX `users_data_origin_status_idx` ON `users` (`data_origin`,`status`);
--> statement-breakpoint
-- Existing retained demo rows are synthetic QA data. Label them at the data
-- boundary so future public aggregates never depend on names or display text.
UPDATE `users`
SET `data_origin`='qa_fixture'
WHERE `id` GLOB 'qa_visual_user_*'
   OR `id` GLOB 'demo_network_user_*'
   OR `id`='fixture_yashns_user';
