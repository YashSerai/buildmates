-- Reversible production-demo network for the existing Buildmates account whose
-- normalized handle is exactly `yashns`.
--
-- Every synthetic principal is clearly fictional, signed-in-only, unindexed,
-- and excluded from anonymous profile reads. Applying this file again refreshes
-- the same rows instead of creating duplicates. If `yashns` (or its current
-- active match index) does not exist, every insert is a no-op.

WITH viewer AS (
  SELECT h.user_id, b.version AS index_version, b.taxonomy_version_id, t.version AS taxonomy_version
  FROM handles h
  JOIN builder_match_index b ON b.user_id=h.user_id
  JOIN taxonomy_versions t ON t.status='active'
  WHERE h.normalized_handle='yashns'
  LIMIT 1
), candidates(user_id) AS (
  VALUES ('demo_network_user_amina'),('demo_network_user_marcus'),('demo_network_user_noor'),('demo_network_user_rowan')
)
INSERT OR IGNORE INTO users(id,status,operator_role,data_origin,created_at,updated_at)
SELECT candidates.user_id,'active','none','qa_fixture',unixepoch()*1000,unixepoch()*1000 FROM candidates,viewer;
--> statement-breakpoint
UPDATE users SET status='active',deleted_at=NULL,updated_at=unixepoch()*1000
WHERE id IN ('demo_network_user_amina','demo_network_user_marcus','demo_network_user_noor','demo_network_user_rowan')
  AND EXISTS (SELECT 1 FROM handles WHERE normalized_handle='yashns');
--> statement-breakpoint
WITH viewer AS (
  SELECT t.id AS taxonomy_version_id FROM handles h
  JOIN taxonomy_versions t ON t.status='active'
  WHERE h.normalized_handle='yashns' LIMIT 1
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
  SELECT h.user_id,b.version AS index_version,t.version AS taxonomy_version
  FROM handles h JOIN builder_match_index b ON b.user_id=h.user_id
  JOIN taxonomy_versions t ON t.status='active'
  WHERE h.normalized_handle='yashns' LIMIT 1
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
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), peers(user_id,pair_id) AS (VALUES
  ('demo_network_user_amina','demo_network_pair_amina'),
  ('demo_network_user_rowan','demo_network_pair_rowan')
)
INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at)
SELECT pair_id,CASE WHEN viewer.user_id<peers.user_id THEN viewer.user_id ELSE peers.user_id END,CASE WHEN viewer.user_id<peers.user_id THEN peers.user_id ELSE viewer.user_id END,(unixepoch()-86400)*1000
FROM peers,viewer WHERE 1
ON CONFLICT(user_a_id,user_b_id) DO NOTHING;
--> statement-breakpoint
WITH viewer AS (
  SELECT h.user_id,b.version AS index_version,t.version AS taxonomy_version
  FROM handles h JOIN builder_match_index b ON b.user_id=h.user_id JOIN taxonomy_versions t ON t.status='active'
  WHERE h.normalized_handle='yashns' LIMIT 1
), pair AS (SELECT id,user_a_id,user_b_id FROM match_pairs WHERE id='demo_network_pair_amina')
INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,taxonomy_version,weight_version,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,shared_explanation_json,state,expires_at,terminal_at,created_at)
SELECT 'demo_network_proposal_amina',pair.id,1,
  CASE WHEN pair.user_a_id=viewer.user_id THEN viewer.index_version ELSE 1 END,
  CASE WHEN pair.user_b_id=viewer.user_id THEN viewer.index_version ELSE 1 END,
  viewer.taxonomy_version,1,'manual','manual',
  '{"reasons":["Shared work on agentic retrieval and evaluation"]}',
  '{"reasons":["Shared work on agentic retrieval and evaluation"]}',
  '{"reason":"You are both turning retrieval failures into practical product feedback loops."}',
  'pending',(unixepoch()+604800)*1000,NULL,(unixepoch()-3600)*1000
FROM pair,viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET evidence_version_a=excluded.evidence_version_a,evidence_version_b=excluded.evidence_version_b,taxonomy_version=excluded.taxonomy_version,state='pending',expires_at=excluded.expires_at,terminal_at=NULL;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO codex_evaluations(id,proposal_id,user_id,decision,reason_summary,evidence_ids_json,index_version,created_at)
SELECT 'demo_network_evaluation_amina','demo_network_proposal_amina','demo_network_user_amina','approve','The current work is mutually relevant without assuming either person must provide a service.','[]',1,(unixepoch()-3000)*1000 FROM viewer WHERE 1
ON CONFLICT(proposal_id,user_id) DO UPDATE SET decision='approve',reason_summary=excluded.reason_summary,index_version=1,created_at=excluded.created_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO human_responses(id,proposal_id,user_id,response,created_at)
SELECT 'demo_network_interest_amina','demo_network_proposal_amina','demo_network_user_amina','interested',(unixepoch()-2400)*1000 FROM viewer WHERE 1
ON CONFLICT(proposal_id,user_id) DO UPDATE SET response='interested',created_at=excluded.created_at;
--> statement-breakpoint
WITH viewer AS (
  SELECT h.user_id,b.version AS index_version,t.version AS taxonomy_version
  FROM handles h JOIN builder_match_index b ON b.user_id=h.user_id JOIN taxonomy_versions t ON t.status='active'
  WHERE h.normalized_handle='yashns' LIMIT 1
), pair AS (SELECT id,user_a_id,user_b_id FROM match_pairs WHERE id='demo_network_pair_rowan')
INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,taxonomy_version,weight_version,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,shared_explanation_json,state,expires_at,terminal_at,created_at)
SELECT 'demo_network_proposal_rowan',pair.id,1,
  CASE WHEN pair.user_a_id=viewer.user_id THEN viewer.index_version ELSE 1 END,
  CASE WHEN pair.user_b_id=viewer.user_id THEN viewer.index_version ELSE 1 END,
  viewer.taxonomy_version,1,'manual','manual',
  '{"reasons":["Shared work on reliable agent systems"]}','{"reasons":["Shared work on reliable agent systems"]}',
  '{"reason":"You both care about dependable agent workflows and human-readable system behavior."}',
  'matched',(unixepoch()+604800)*1000,(unixepoch()-172800)*1000,(unixepoch()-259200)*1000
FROM pair,viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET evidence_version_a=excluded.evidence_version_a,evidence_version_b=excluded.evidence_version_b,taxonomy_version=excluded.taxonomy_version,state='matched',expires_at=excluded.expires_at,terminal_at=excluded.terminal_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id,index_version FROM (SELECT h.user_id,b.version AS index_version FROM handles h JOIN builder_match_index b ON b.user_id=h.user_id WHERE h.normalized_handle='yashns' LIMIT 1)), evaluations(id,user_id,index_version) AS (VALUES
  ('demo_network_evaluation_rowan_peer','demo_network_user_rowan',1)
)
INSERT INTO codex_evaluations(id,proposal_id,user_id,decision,reason_summary,evidence_ids_json,index_version,created_at)
SELECT 'demo_network_evaluation_rowan_viewer','demo_network_proposal_rowan',viewer.user_id,'approve','A useful overlap in reliable agent workflows.','[]',viewer.index_version,(unixepoch()-259000)*1000 FROM viewer WHERE 1
UNION ALL SELECT evaluations.id,'demo_network_proposal_rowan',evaluations.user_id,'approve','A useful overlap in reliable agent workflows.','[]',evaluations.index_version,(unixepoch()-258000)*1000 FROM evaluations,viewer WHERE 1
ON CONFLICT(proposal_id,user_id) DO UPDATE SET decision='approve',reason_summary=excluded.reason_summary,index_version=excluded.index_version,created_at=excluded.created_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), responses(id,user_id) AS (VALUES
  ('demo_network_interest_rowan_peer','demo_network_user_rowan')
)
INSERT INTO human_responses(id,proposal_id,user_id,response,created_at)
SELECT 'demo_network_interest_rowan_viewer','demo_network_proposal_rowan',viewer.user_id,'interested',(unixepoch()-257000)*1000 FROM viewer WHERE 1
UNION ALL SELECT responses.id,'demo_network_proposal_rowan',responses.user_id,'interested',(unixepoch()-256000)*1000 FROM responses,viewer WHERE 1
ON CONFLICT(proposal_id,user_id) DO UPDATE SET response='interested',created_at=excluded.created_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO matches(id,match_pair_id,proposal_id,matched_at)
SELECT 'demo_network_match_rowan','demo_network_pair_rowan','demo_network_proposal_rowan',(unixepoch()-172800)*1000 FROM viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET matched_at=excluded.matched_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO connections(id,match_pair_id,match_id,state,created_at,updated_at)
SELECT 'demo_network_connection_rowan','demo_network_pair_rowan','demo_network_match_rowan','active',(unixepoch()-172800)*1000,unixepoch()*1000 FROM viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET state='active',ended_by_user_id=NULL,ended_at=NULL,updated_at=excluded.updated_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), members(user_id) AS (SELECT user_id FROM viewer UNION ALL SELECT 'demo_network_user_rowan' FROM viewer)
INSERT INTO connection_sides(connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at)
SELECT 'demo_network_connection_rowan',user_id,0,1,(unixepoch()-172800)*1000,unixepoch()*1000 FROM members WHERE 1
ON CONFLICT(connection_id,user_id) DO UPDATE SET muted=0,renewed_relevance_enabled=1,updated_at=excluded.updated_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), snapshots(user_id,name,summary) AS (
  SELECT viewer.user_id,'Yash Serai','Building products and agentic workflows.' FROM viewer
  UNION ALL SELECT 'demo_network_user_rowan','Rowan Pike','Designing dependable agent workflows that stay understandable.' FROM viewer
)
INSERT INTO connection_snapshots(connection_id,subject_user_id,display_name,summary,captured_at)
SELECT 'demo_network_connection_rowan',user_id,name,summary,unixepoch()*1000 FROM snapshots WHERE 1
ON CONFLICT(connection_id,subject_user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,captured_at=excluded.captured_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO connection_context_snapshots(connection_id,reason,shared_context_json,theme_topic_id,captured_at)
SELECT 'demo_network_connection_rowan','You both care about dependable agent workflows and clear product feedback loops.','["Agent reliability","MCP tooling","Human-readable evaluation"]',NULL,unixepoch()*1000 FROM viewer WHERE 1
ON CONFLICT(connection_id) DO UPDATE SET reason=excluded.reason,shared_context_json=excluded.shared_context_json,captured_at=excluded.captured_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO rooms(id,match_pair_id,connection_id,status,theme_topic_id,created_at,updated_at)
SELECT 'demo_network_room_rowan','demo_network_pair_rowan','demo_network_connection_rowan','active',NULL,(unixepoch()-172800)*1000,unixepoch()*1000 FROM viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET status='active',updated_at=excluded.updated_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), members(user_id) AS (SELECT user_id FROM viewer UNION ALL SELECT 'demo_network_user_rowan' FROM viewer)
INSERT INTO room_memberships(room_id,user_id,joined_at,left_at)
SELECT 'demo_network_room_rowan',user_id,(unixepoch()-172800)*1000,NULL FROM members WHERE 1
ON CONFLICT(room_id,user_id) DO UPDATE SET left_at=NULL;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), demo(id,sender_user_id,client_id,body,age) AS (VALUES
  ('demo_network_message_rowan_1','demo_network_user_rowan','demo-network-rowan-1','I mapped the agent handoff failures. Want to compare the smallest reproducible traces?',7200),
  ('demo_network_message_rowan_2','demo_network_user_rowan','demo-network-rowan-2','The surprising pattern is stale context presenting like a retrieval miss.',1800)
)
INSERT INTO messages(id,room_id,sender_user_id,client_message_id,body,created_at)
SELECT id,'demo_network_room_rowan',sender_user_id,client_id,body,(unixepoch()-age)*1000 FROM demo,viewer WHERE 1
ON CONFLICT(room_id,sender_user_id,client_message_id) DO UPDATE SET body=excluded.body,created_at=excluded.created_at,deleted_at=NULL;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO circles(id,name,purpose,status,governance_mode,governance_version,created_at,updated_at)
SELECT 'demo_network_circle_agents','Reliable Agents Lab','A small Circle comparing practical ways to make agent workflows easier to trust.','active','admin',1,(unixepoch()-86400)*1000,unixepoch()*1000 FROM viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET name=excluded.name,purpose=excluded.purpose,status='active',updated_at=excluded.updated_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), members(user_id,role,status,joined_at) AS (
  SELECT viewer.user_id,'owner','active',(unixepoch()-86400)*1000 FROM viewer
  UNION ALL SELECT 'demo_network_user_rowan','member','active',(unixepoch()-80000)*1000 FROM viewer
  UNION ALL SELECT 'demo_network_user_amina','member','invited',NULL FROM viewer
)
INSERT INTO circle_memberships(circle_id,user_id,role,status,joined_at)
SELECT 'demo_network_circle_agents',user_id,role,status,joined_at FROM members WHERE 1
ON CONFLICT(circle_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status,joined_at=excluded.joined_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO circle_messages(id,circle_id,sender_user_id,client_message_id,body,created_at)
SELECT 'demo_network_circle_message','demo_network_circle_agents','demo_network_user_rowan','demo-network-circle-1','I added a compact failure taxonomy from this week''s agent run.',(unixepoch()-1200)*1000 FROM viewer WHERE 1
ON CONFLICT(circle_id,sender_user_id,client_message_id) DO UPDATE SET body=excluded.body,created_at=excluded.created_at,deleted_at=NULL;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), notices(id,kind,payload,age) AS (VALUES
  ('demo_network_notification_interest','match_interest','{"proposalId":"demo_network_proposal_amina","builderName":"Amina Sol"}',2100),
  ('demo_network_notification_message','new_message','{"roomId":"demo_network_room_rowan","connectionId":"demo_network_connection_rowan","senderName":"Rowan Pike"}',1700),
  ('demo_network_notification_circle','circle_message','{"circleId":"demo_network_circle_agents","circleName":"Reliable Agents Lab","senderName":"Rowan Pike"}',1100)
)
INSERT INTO notifications(id,user_id,kind,delivery,payload_json,read_at,created_at)
SELECT id,viewer.user_id,kind,'immediate',payload,NULL,(unixepoch()-age)*1000 FROM notices,viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,kind=excluded.kind,payload_json=excluded.payload_json,read_at=NULL,created_at=excluded.created_at;
