-- Reversible signed-in demo relationship for the account whose handle is
-- exactly `yashns`. The public map, Build Graph, and shortlist fixtures are
-- intentionally untouched. Reapplying this migration refreshes the same rows.

WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at)
SELECT 'demo_network_pair_rowan',
  CASE WHEN viewer.user_id<'demo_network_user_rowan' THEN viewer.user_id ELSE 'demo_network_user_rowan' END,
  CASE WHEN viewer.user_id<'demo_network_user_rowan' THEN 'demo_network_user_rowan' ELSE viewer.user_id END,
  (unixepoch()-259200)*1000
FROM viewer WHERE 1
ON CONFLICT(user_a_id,user_b_id) DO NOTHING;
--> statement-breakpoint
WITH viewer AS (
  SELECT h.user_id,COALESCE(b.version,1) AS index_version,t.version AS taxonomy_version
  FROM handles h LEFT JOIN builder_match_index b ON b.user_id=h.user_id
  JOIN taxonomy_versions t ON t.status='active'
  WHERE h.normalized_handle='yashns' ORDER BY t.version DESC LIMIT 1
), pair AS (
  SELECT id,user_a_id,user_b_id FROM match_pairs
  WHERE (user_a_id=(SELECT user_id FROM viewer) AND user_b_id='demo_network_user_rowan')
     OR (user_b_id=(SELECT user_id FROM viewer) AND user_a_id='demo_network_user_rowan')
  LIMIT 1
)
INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,taxonomy_version,weight_version,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,shared_explanation_json,state,expires_at,terminal_at,created_at)
SELECT 'demo_network_proposal_rowan',pair.id,91,
  CASE WHEN pair.user_a_id=viewer.user_id THEN viewer.index_version ELSE 1 END,
  CASE WHEN pair.user_b_id=viewer.user_id THEN viewer.index_version ELSE 1 END,
  viewer.taxonomy_version,1,'manual','manual',
  '{"reasons":["Shared work on reliable agent systems"]}',
  '{"reasons":["Shared work on reliable agent systems"]}',
  '{"reason":"You both care about dependable agent workflows and human-readable system behavior."}',
  'matched',(unixepoch()+604800)*1000,(unixepoch()-172800)*1000,(unixepoch()-259200)*1000
FROM pair,viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET state='matched',terminal_at=excluded.terminal_at,expires_at=excluded.expires_at;
--> statement-breakpoint
WITH viewer AS (
  SELECT h.user_id,COALESCE(b.version,1) AS index_version
  FROM handles h LEFT JOIN builder_match_index b ON b.user_id=h.user_id
  WHERE h.normalized_handle='yashns' LIMIT 1
)
INSERT INTO codex_evaluations(id,proposal_id,user_id,decision,reason_summary,evidence_ids_json,index_version,created_at)
SELECT 'demo_network_evaluation_rowan_viewer','demo_network_proposal_rowan',viewer.user_id,'approve','A useful overlap in reliable agent workflows.','[]',viewer.index_version,(unixepoch()-259000)*1000 FROM viewer
UNION ALL
SELECT 'demo_network_evaluation_rowan_peer','demo_network_proposal_rowan','demo_network_user_rowan','approve','A useful overlap in reliable agent workflows.','[]',1,(unixepoch()-258000)*1000 FROM viewer WHERE 1
ON CONFLICT(proposal_id,user_id) DO UPDATE SET decision='approve',reason_summary=excluded.reason_summary,index_version=excluded.index_version;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO human_responses(id,proposal_id,user_id,response,created_at)
SELECT 'demo_network_interest_rowan_viewer','demo_network_proposal_rowan',viewer.user_id,'interested',(unixepoch()-257000)*1000 FROM viewer
UNION ALL
SELECT 'demo_network_interest_rowan_peer','demo_network_proposal_rowan','demo_network_user_rowan','interested',(unixepoch()-256000)*1000 FROM viewer WHERE 1
ON CONFLICT(proposal_id,user_id) DO UPDATE SET response='interested',created_at=excluded.created_at;
--> statement-breakpoint
WITH pair AS (SELECT match_pair_id FROM match_proposals WHERE id='demo_network_proposal_rowan')
INSERT INTO matches(id,match_pair_id,proposal_id,matched_at)
SELECT 'demo_network_match_rowan',pair.match_pair_id,'demo_network_proposal_rowan',(unixepoch()-172800)*1000 FROM pair WHERE 1
ON CONFLICT(id) DO UPDATE SET matched_at=excluded.matched_at;
--> statement-breakpoint
WITH matched AS (SELECT match_pair_id FROM matches WHERE id='demo_network_match_rowan')
INSERT INTO connections(id,match_pair_id,match_id,state,created_at,updated_at)
SELECT 'demo_network_connection_rowan',matched.match_pair_id,'demo_network_match_rowan','active',(unixepoch()-172800)*1000,unixepoch()*1000 FROM matched WHERE 1
ON CONFLICT(id) DO UPDATE SET state='active',ended_by_user_id=NULL,ended_at=NULL,updated_at=excluded.updated_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), members(user_id) AS (
  SELECT user_id FROM viewer UNION ALL SELECT 'demo_network_user_rowan' FROM viewer
)
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
WITH viewer AS (SELECT 1 FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO connection_context_snapshots(connection_id,reason,shared_context_json,theme_topic_id,captured_at)
SELECT 'demo_network_connection_rowan','You both care about dependable agent workflows and clear product feedback loops.','["Agent reliability","MCP tooling","Human-readable evaluation"]',NULL,unixepoch()*1000 FROM viewer WHERE 1
ON CONFLICT(connection_id) DO UPDATE SET reason=excluded.reason,shared_context_json=excluded.shared_context_json,captured_at=excluded.captured_at;
--> statement-breakpoint
WITH matched AS (SELECT match_pair_id FROM matches WHERE id='demo_network_match_rowan')
INSERT INTO rooms(id,match_pair_id,connection_id,status,theme_topic_id,created_at,updated_at)
SELECT 'demo_network_room_rowan',matched.match_pair_id,'demo_network_connection_rowan','active',NULL,(unixepoch()-172800)*1000,unixepoch()*1000 FROM matched WHERE 1
ON CONFLICT(id) DO UPDATE SET status='active',updated_at=excluded.updated_at;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), members(user_id) AS (
  SELECT user_id FROM viewer UNION ALL SELECT 'demo_network_user_rowan' FROM viewer
)
INSERT INTO room_memberships(room_id,user_id,joined_at,left_at)
SELECT 'demo_network_room_rowan',user_id,(unixepoch()-172800)*1000,NULL FROM members WHERE 1
ON CONFLICT(room_id,user_id) DO UPDATE SET left_at=NULL;
--> statement-breakpoint
WITH viewer AS (SELECT 1 FROM handles WHERE normalized_handle='yashns' LIMIT 1), demo(id,client_id,body,age) AS (VALUES
  ('demo_network_message_rowan_1','demo-network-rowan-1','I mapped the agent handoff failures. Want to compare the smallest reproducible traces?',7200),
  ('demo_network_message_rowan_2','demo-network-rowan-2','The surprising pattern is stale context presenting like a retrieval miss.',1800)
)
INSERT INTO messages(id,room_id,sender_user_id,client_message_id,body,created_at)
SELECT id,'demo_network_room_rowan','demo_network_user_rowan',client_id,body,(unixepoch()-age)*1000 FROM demo,viewer WHERE 1
ON CONFLICT(room_id,sender_user_id,client_message_id) DO UPDATE SET body=excluded.body,created_at=excluded.created_at,deleted_at=NULL;
--> statement-breakpoint
WITH viewer AS (SELECT 1 FROM handles WHERE normalized_handle='yashns' LIMIT 1)
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
WITH viewer AS (SELECT 1 FROM handles WHERE normalized_handle='yashns' LIMIT 1)
INSERT INTO circle_messages(id,circle_id,sender_user_id,client_message_id,body,created_at)
SELECT 'demo_network_circle_message','demo_network_circle_agents','demo_network_user_rowan','demo-network-circle-1','I added a compact failure taxonomy from this week''s agent run.',(unixepoch()-1200)*1000 FROM viewer WHERE 1
ON CONFLICT(circle_id,sender_user_id,client_message_id) DO UPDATE SET body=excluded.body,created_at=excluded.created_at,deleted_at=NULL;
--> statement-breakpoint
WITH viewer AS (SELECT user_id FROM handles WHERE normalized_handle='yashns' LIMIT 1), notices(id,kind,payload,age) AS (VALUES
  ('demo_network_notification_opened','match_opened','{"roomId":"demo_network_room_rowan","connectionId":"demo_network_connection_rowan","builderName":"Rowan Pike"}',2300),
  ('demo_network_notification_message','new_message','{"roomId":"demo_network_room_rowan","connectionId":"demo_network_connection_rowan","senderName":"Rowan Pike"}',1700),
  ('demo_network_notification_circle','circle_message','{"circleId":"demo_network_circle_agents","circleName":"Reliable Agents Lab","senderName":"Rowan Pike"}',1100)
)
INSERT INTO notifications(id,user_id,kind,delivery,payload_json,read_at,created_at)
SELECT id,viewer.user_id,kind,'immediate',payload,NULL,(unixepoch()-age)*1000 FROM notices,viewer WHERE 1
ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,kind=excluded.kind,payload_json=excluded.payload_json,read_at=NULL,created_at=excluded.created_at;
