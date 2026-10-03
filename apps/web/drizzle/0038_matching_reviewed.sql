ALTER TABLE `profiles` ADD COLUMN `matching_reviewed_at` integer;
--> statement-breakpoint
UPDATE `profiles`
SET `matching_reviewed_at`=`published_at`
WHERE `allow_matching`=1
  AND `published_at` IS NOT NULL
  AND `audience` IN ('public','signed_in','suggested_connections')
  AND `matching_reviewed_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `profiles_matching_eligibility_idx`
ON `profiles` (`allow_matching`,`matching_reviewed_at`,`published_at`);
