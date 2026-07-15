-- Fixed historical backfill for pre-0006 rows. Runtime writes always provide
-- an explicit policy version; this default must not follow future releases.
ALTER TABLE `surface_revisions` ADD `design_policy_version` text DEFAULT '2026-07-14.1' NOT NULL;
