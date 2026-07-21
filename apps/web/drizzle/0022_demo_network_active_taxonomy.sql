-- Repair the QA account's stale taxonomy pointer so the normal shortlist query
-- can evaluate the reversible demo candidates. Content arrays and version stay
-- unchanged; a real Work Pulse may replace them later.
UPDATE builder_match_index
SET taxonomy_version_id=(
  SELECT id FROM taxonomy_versions WHERE status='active' ORDER BY version DESC LIMIT 1
), updated_at=unixepoch()*1000
WHERE user_id=(SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
  AND EXISTS (SELECT 1 FROM taxonomy_versions WHERE status='active');
