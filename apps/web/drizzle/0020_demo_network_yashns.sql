-- One-time production seed for a reversible, fictional candidate shortlist.
-- Rich relationship-state fixtures remain in scripts/fixtures for local QA;
-- the production migration deliberately limits itself to candidate discovery.

WITH viewer AS (
  SELECT h.user_id
  FROM handles h
  WHERE h.normalized_handle='yashns'
  LIMIT 1
), candidates(user_id) AS (
  VALUES ('demo_network_user_amina'),('demo_network_user_marcus'),('demo_network_user_noor'),('demo_network_user_rowan')
)
INSERT OR IGNORE INTO users(id,status,operator_role,created_at,updated_at)
SELECT candidates.user_id,'active','none',unixepoch()*1000,unixepoch()*1000 FROM candidates,viewer;
--> statement-breakpoint
WITH viewer AS (SELECT 1 FROM handles WHERE normalized_handle='yashns' LIMIT 1), candidates(user_id,handle) AS (VALUES
  ('demo_network_user_amina','amina_demo'),
  ('demo_network_user_marcus','marcus_demo'),
  ('demo_network_user_noor','noor_demo'),
  ('demo_network_user_rowan','rowan_demo')
)
INSERT INTO handles(user_id,handle,normalized_handle,created_at)
SELECT user_id,handle,handle,unixepoch()*1000 FROM candidates,viewer WHERE 1
ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,normalized_handle=excluded.normalized_handle;
--> statement-breakpoint
WITH viewer AS (SELECT 1 FROM handles WHERE normalized_handle='yashns' LIMIT 1), candidates(user_id,profile_id,name,summary,interest) AS (VALUES
  ('demo_network_user_amina','demo_network_profile_amina','Amina Sol','Building evaluation systems for agentic retrieval that make failure modes legible to product teams.','A practical RAG evaluation notebook for teams shipping AI products.'),
  ('demo_network_user_marcus','demo_network_profile_marcus','Marcus Vale','Making MCP-based developer tools easier to observe, test, and operate in production.','A lightweight operations console for local and hosted agents.'),
  ('demo_network_user_noor','demo_network_profile_noor','Noor Bell','Exploring playful social products and calm interaction design for small online communities.','A set of consent-aware rituals for new online groups.'),
  ('demo_network_user_rowan','demo_network_profile_rowan','Rowan Pike','Designing dependable agent workflows that stay understandable to the people using them.','An observability layer for agent handoffs and long-running work.')
)
INSERT INTO profiles(id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at)
SELECT profile_id,user_id,name,summary,interest,'[]','signed_in',1,'manual',0,(unixepoch()-86400)*1000,(unixepoch()-86400)*1000,unixepoch()*1000
FROM candidates,viewer WHERE 1
ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,project_or_interest=excluded.project_or_interest,portfolio_links_json='[]',audience='signed_in',allow_matching=1,acceptance_mode='manual',indexable=0,published_at=excluded.published_at,updated_at=excluded.updated_at;
--> statement-breakpoint
WITH viewer AS (
  SELECT t.id AS taxonomy_version_id
  FROM handles h
  JOIN taxonomy_versions t ON t.status='active'
  WHERE h.normalized_handle='yashns'
  ORDER BY t.version DESC
  LIMIT 1
), candidates(user_id,topics_json) AS (VALUES
  ('demo_network_user_amina','["ai-agents","retrieval-augmented-generation","mcp"]'),
  ('demo_network_user_marcus','["developer-tools","automation","mcp"]'),
  ('demo_network_user_noor','["consumer-products","social-products","design-systems"]'),
  ('demo_network_user_rowan','["ai-agents","observability","developer-tools"]')
)
INSERT INTO builder_match_index(user_id,version,taxonomy_version_id,topics_json,tools_json,domains_json,stages_json,intents_json,updated_at)
SELECT candidates.user_id,1,viewer.taxonomy_version_id,candidates.topics_json,'[]','[]','["building"]','["peer-conversation"]',unixepoch()*1000
FROM candidates,viewer WHERE 1
ON CONFLICT(user_id) DO UPDATE SET version=1,taxonomy_version_id=excluded.taxonomy_version_id,topics_json=excluded.topics_json,tools_json='[]',domains_json='[]',stages_json=excluded.stages_json,intents_json=excluded.intents_json,updated_at=excluded.updated_at;
--> statement-breakpoint
WITH viewer AS (
  SELECT h.user_id,COALESCE(b.version,1) AS index_version,t.version AS taxonomy_version
  FROM handles h
  LEFT JOIN builder_match_index b ON b.user_id=h.user_id
  JOIN taxonomy_versions t ON t.status='active'
  WHERE h.normalized_handle='yashns'
  ORDER BY t.version DESC
  LIMIT 1
), candidates(user_id,score_id,total,components) AS (VALUES
  ('demo_network_user_amina','demo_network_score_amina',9400,'{"topicOverlap":4300,"toolDomainFit":2600,"intentFit":2500}'),
  ('demo_network_user_marcus','demo_network_score_marcus',8150,'{"topicOverlap":3200,"toolDomainFit":2900,"intentFit":2050}'),
  ('demo_network_user_noor','demo_network_score_noor',6200,'{"topicOverlap":1700,"adjacentDomain":2700,"serendipity":1800}'),
  ('demo_network_user_rowan','demo_network_score_rowan',9000,'{"topicOverlap":3900,"toolDomainFit":3100,"intentFit":2000}')
)
INSERT INTO pair_scores(id,user_a_id,user_b_id,index_version_a,index_version_b,taxonomy_version,weight_version,components_json,evidence_ids_json,audience_decisions_json,total_basis_points,expires_at,created_at)
SELECT score_id,
  CASE WHEN viewer.user_id<candidates.user_id THEN viewer.user_id ELSE candidates.user_id END,
  CASE WHEN viewer.user_id<candidates.user_id THEN candidates.user_id ELSE viewer.user_id END,
  CASE WHEN viewer.user_id<candidates.user_id THEN viewer.index_version ELSE 1 END,
  CASE WHEN viewer.user_id<candidates.user_id THEN 1 ELSE viewer.index_version END,
  viewer.taxonomy_version,1,components,'[]',
  json_array(
    json_object('component','topicOverlap','allEvidenceVisible',1,'viewerUserIds',json_array(viewer.user_id,candidates.user_id)),
    json_object('component','toolDomainFit','allEvidenceVisible',1,'viewerUserIds',json_array(viewer.user_id,candidates.user_id)),
    json_object('component','intentFit','allEvidenceVisible',1,'viewerUserIds',json_array(viewer.user_id,candidates.user_id)),
    json_object('component','adjacentDomain','allEvidenceVisible',1,'viewerUserIds',json_array(viewer.user_id,candidates.user_id)),
    json_object('component','serendipity','allEvidenceVisible',1,'viewerUserIds',json_array(viewer.user_id,candidates.user_id))
  ),total,(unixepoch()+1209600)*1000,unixepoch()*1000
FROM candidates,viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET index_version_a=excluded.index_version_a,index_version_b=excluded.index_version_b,taxonomy_version=excluded.taxonomy_version,weight_version=1,components_json=excluded.components_json,evidence_ids_json='[]',audience_decisions_json=excluded.audience_decisions_json,total_basis_points=excluded.total_basis_points,expires_at=excluded.expires_at,created_at=excluded.created_at;
