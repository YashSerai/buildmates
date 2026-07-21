-- Exact cleanup for scripts/fixtures/0031_demo_network_yashns.sql.
-- It removes only demo_network_* rows and never deletes or rewrites the yashns
-- account, profile, projects, Work Signals, settings, or identity links.

DELETE FROM circle_messages WHERE id LIKE 'demo_network_%';
--> statement-breakpoint
DELETE FROM circle_memberships WHERE circle_id='demo_network_circle_agents';
--> statement-breakpoint
DELETE FROM circles WHERE id='demo_network_circle_agents';
--> statement-breakpoint
DELETE FROM notifications WHERE id LIKE 'demo_network_%';
--> statement-breakpoint
DELETE FROM messages WHERE room_id='demo_network_room_rowan' OR id LIKE 'demo_network_%';
--> statement-breakpoint
DELETE FROM room_memberships WHERE room_id='demo_network_room_rowan';
--> statement-breakpoint
DELETE FROM rooms WHERE id='demo_network_room_rowan';
--> statement-breakpoint
DELETE FROM connection_context_snapshots WHERE connection_id='demo_network_connection_rowan';
--> statement-breakpoint
DELETE FROM connection_snapshots WHERE connection_id='demo_network_connection_rowan';
--> statement-breakpoint
DELETE FROM connection_sides WHERE connection_id='demo_network_connection_rowan';
--> statement-breakpoint
DELETE FROM connections WHERE id='demo_network_connection_rowan';
--> statement-breakpoint
DELETE FROM matches WHERE id='demo_network_match_rowan';
--> statement-breakpoint
DELETE FROM human_responses WHERE proposal_id IN ('demo_network_proposal_amina','demo_network_proposal_rowan');
--> statement-breakpoint
DELETE FROM codex_evaluations WHERE proposal_id IN ('demo_network_proposal_amina','demo_network_proposal_rowan');
--> statement-breakpoint
DELETE FROM match_proposals WHERE id IN ('demo_network_proposal_amina','demo_network_proposal_rowan');
--> statement-breakpoint
DELETE FROM candidate_batches WHERE EXISTS (
  SELECT 1 FROM json_each(candidate_ids_json)
  WHERE value IN ('demo_network_user_amina','demo_network_user_marcus','demo_network_user_noor','demo_network_user_rowan')
);
--> statement-breakpoint
DELETE FROM pair_scores WHERE id LIKE 'demo_network_%';
--> statement-breakpoint
DELETE FROM match_pairs WHERE id IN ('demo_network_pair_amina','demo_network_pair_rowan');
--> statement-breakpoint
DELETE FROM builder_match_index WHERE user_id IN ('demo_network_user_amina','demo_network_user_marcus','demo_network_user_noor','demo_network_user_rowan');
--> statement-breakpoint
DELETE FROM handles WHERE user_id IN ('demo_network_user_amina','demo_network_user_marcus','demo_network_user_noor','demo_network_user_rowan');
--> statement-breakpoint
DELETE FROM profiles WHERE user_id IN ('demo_network_user_amina','demo_network_user_marcus','demo_network_user_noor','demo_network_user_rowan');
--> statement-breakpoint
DELETE FROM users WHERE id IN ('demo_network_user_amina','demo_network_user_marcus','demo_network_user_noor','demo_network_user_rowan');

