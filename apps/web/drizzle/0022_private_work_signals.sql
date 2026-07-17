UPDATE `work_signals`
SET `audience` = 'suggested_connections', `updated_at` = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE `audience` IN ('public','signed_in');
--> statement-breakpoint
CREATE TRIGGER `work_signals_private_insert`
BEFORE INSERT ON `work_signals`
WHEN NEW.`audience` NOT IN ('suggested_connections','mutual_connections','private')
BEGIN
  SELECT RAISE(ABORT, 'work_signal_public_forbidden');
END;
--> statement-breakpoint
CREATE TRIGGER `work_signals_private_update`
BEFORE UPDATE OF `audience` ON `work_signals`
WHEN NEW.`audience` NOT IN ('suggested_connections','mutual_connections','private')
BEGIN
  SELECT RAISE(ABORT, 'work_signal_public_forbidden');
END;
