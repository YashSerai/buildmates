-- Complete the governed Circle fixture added in 0034. Circle detail reads are
-- intentionally joined through a trusted surface record even when no custom
-- revision has been published yet.
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO surfaces(id,owner_user_id,kind,subject_id,published_revision_id,governance_version,created_at,updated_at)
SELECT 'demo_network_circle_surface',viewer.user_id,'circle','demo_network_circle_agents',NULL,1,(unixepoch()-86400)*1000,unixepoch()*1000
FROM viewer
WHERE EXISTS (SELECT 1 FROM circles WHERE id='demo_network_circle_agents')
ON CONFLICT(kind,subject_id) DO UPDATE SET owner_user_id=excluded.owner_user_id,governance_version=1,updated_at=excluded.updated_at;
