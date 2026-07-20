UPDATE `profiles`
SET `audience` = 'public', `indexable` = 1
WHERE `published_at` IS NOT NULL;
--> statement-breakpoint
UPDATE `profiles`
SET `audience` = 'private', `indexable` = 0
WHERE `published_at` IS NULL;
--> statement-breakpoint
UPDATE `projects`
SET `indexable` = CASE
  WHEN `status` = 'active' AND `audience` = 'public' AND `published_at` IS NOT NULL THEN 1
  ELSE 0
END;
