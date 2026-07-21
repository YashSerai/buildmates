-- The QA account predates the current match-index lifecycle. Preserve any
-- existing index; create only the missing shell required to read precomputed
-- demo scores, then point it at the active taxonomy.
INSERT OR IGNORE INTO builder_match_index(
  user_id,version,taxonomy_version_id,topics_json,tools_json,domains_json,stages_json,intents_json,updated_at
)
SELECT h.user_id,1,t.id,'[]','[]','[]','[]','[]',unixepoch()*1000
FROM handles h
JOIN taxonomy_versions t ON t.status='active'
WHERE h.normalized_handle='yashns'
ORDER BY t.version DESC
LIMIT 1;
--> statement-breakpoint
UPDATE builder_match_index
SET taxonomy_version_id=(
  SELECT id FROM taxonomy_versions WHERE status='active' ORDER BY version DESC LIMIT 1
), updated_at=unixepoch()*1000
WHERE user_id=(SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
  AND EXISTS (SELECT 1 FROM taxonomy_versions WHERE status='active');
