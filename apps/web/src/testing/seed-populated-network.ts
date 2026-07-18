type SeededNetwork = {
  viewerHandle: string;
  pendingUserId: string;
  connectedUserId: string;
  pendingProposalId: string;
  connectionId: string;
  roomId: string;
  activeCircleId: string;
  invitationCircleId: string;
};

export async function seedPopulatedNetwork(
  DB: D1Database,
  viewerUserId: string,
  now = Date.now(),
): Promise<SeededNetwork> {
  const suffix = viewerUserId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const pendingUserId = `e2e_pending_${suffix}`;
  const connectedUserId = `e2e_connected_${suffix}`;
  const pendingPairId = `e2e_pair_pending_${suffix}`;
  const connectedPairId = `e2e_pair_connected_${suffix}`;
  const pendingProposalId = `e2e_proposal_pending_${suffix}`;
  const connectedProposalId = `e2e_proposal_connected_${suffix}`;
  const matchId = `e2e_match_${suffix}`;
  const connectionId = `e2e_connection_${suffix}`;
  const roomId = `e2e_room_${suffix}`;
  const activeCircleId = `e2e_circle_active_${suffix}`;
  const invitationCircleId = `e2e_circle_invitation_${suffix}`;
  const taxonomy = await DB.prepare(
    "SELECT id,version FROM taxonomy_versions WHERE status='active' ORDER BY version DESC LIMIT 1",
  ).first<{ id: string; version: number }>();
  if (!taxonomy) throw new Error("e2e_active_taxonomy_missing");

  const pendingPair = canonicalPair(viewerUserId, pendingUserId);
  const connectedPair = canonicalPair(viewerUserId, connectedUserId);
  const viewerProfileId = `e2e_profile_viewer_${suffix}`;
  const pendingProfileId = `e2e_profile_pending_${suffix}`;
  const connectedProfileId = `e2e_profile_connected_${suffix}`;
  const viewerHandle = `tester_${suffix.slice(-12)}`;
  const pendingHandle = `mira_${suffix.slice(-12)}`;
  const connectedHandle = `rowan_${suffix.slice(-12)}`;
  const publishedAt = now - 7 * 86_400_000;

  await DB.batch([
    DB.prepare(
      "INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES(?,'active','none',?,?) ON CONFLICT(id) DO UPDATE SET status='active',updated_at=excluded.updated_at,deleted_at=NULL",
    ).bind(pendingUserId, publishedAt, now),
    DB.prepare(
      "INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES(?,'active','none',?,?) ON CONFLICT(id) DO UPDATE SET status='active',updated_at=excluded.updated_at,deleted_at=NULL",
    ).bind(connectedUserId, publishedAt, now),
    DB.prepare(
      "INSERT INTO profiles(id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at) VALUES(?,?,? ,?,?,'[]','suggested_connections',1,'manual',0,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,project_or_interest=excluded.project_or_interest,audience=excluded.audience,allow_matching=1,acceptance_mode='manual',published_at=excluded.published_at,updated_at=excluded.updated_at",
    ).bind(
      viewerProfileId,
      viewerUserId,
      "Buildmates Tester",
      "Building thoughtful AI products and reliable collaboration workflows.",
      "Testing a privacy-aware builder network from introduction to ongoing conversation.",
      publishedAt,
      publishedAt,
      now,
    ),
    DB.prepare(
      "INSERT INTO profiles(id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at) VALUES(?,?,?,?,?,'[]','suggested_connections',1,'manual',0,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,project_or_interest=excluded.project_or_interest,audience=excluded.audience,allow_matching=1,acceptance_mode='manual',published_at=excluded.published_at,updated_at=excluded.updated_at",
    ).bind(
      pendingProfileId,
      pendingUserId,
      "Mira Chen",
      "Exploring retrieval quality and human-friendly evaluation loops for AI products.",
      "A small RAG evaluation toolkit for product teams.",
      publishedAt,
      publishedAt,
      now,
    ),
    DB.prepare(
      "INSERT INTO profiles(id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at) VALUES(?,?,?,?,?,'[]','suggested_connections',1,'manual',0,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,project_or_interest=excluded.project_or_interest,audience=excluded.audience,allow_matching=1,acceptance_mode='manual',published_at=excluded.published_at,updated_at=excluded.updated_at",
    ).bind(
      connectedProfileId,
      connectedUserId,
      "Rowan Patel",
      "Designing dependable agent workflows that stay understandable to the people using them.",
      "An agent observability layer for small product teams.",
      publishedAt,
      publishedAt,
      now,
    ),
    upsertHandle(DB, viewerUserId, viewerHandle, publishedAt),
    upsertHandle(DB, pendingUserId, pendingHandle, publishedAt),
    upsertHandle(DB, connectedUserId, connectedHandle, publishedAt),
    upsertMatchIndex(DB, viewerUserId, taxonomy.id, now),
    upsertMatchIndex(DB, pendingUserId, taxonomy.id, now),
    upsertMatchIndex(DB, connectedUserId, taxonomy.id, now),
  ]);

  await DB.batch([
    upsertPair(DB, pendingPairId, pendingPair, publishedAt),
    upsertPair(DB, connectedPairId, connectedPair, publishedAt),
    DB.prepare(
      "INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,shared_explanation_json,state,expires_at,terminal_at,created_at,taxonomy_version,weight_version) VALUES(?,?,1,1,1,'manual','manual',?,?,?,'pending',?,NULL,?,?,1) ON CONFLICT(id) DO UPDATE SET evidence_version_a=1,evidence_version_b=1,state='pending',expires_at=excluded.expires_at,terminal_at=NULL",
    ).bind(
      pendingProposalId,
      pendingPairId,
      JSON.stringify({ reasons: ["Both exploring practical retrieval quality"] }),
      JSON.stringify({ reasons: ["Both exploring practical retrieval quality"] }),
      JSON.stringify({ reason: "You are both testing how retrieval systems behave in real products." }),
      now + 14 * 86_400_000,
      now - 120_000,
      taxonomy.version,
    ),
    DB.prepare(
      "INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,shared_explanation_json,state,expires_at,terminal_at,created_at,taxonomy_version,weight_version) VALUES(?,?,1,1,1,'manual','manual',?,?,?,'matched',?,?,?, ?,1) ON CONFLICT(id) DO UPDATE SET state='matched',terminal_at=excluded.terminal_at",
    ).bind(
      connectedProposalId,
      connectedPairId,
      JSON.stringify({ reasons: ["Shared interest in reliable agent workflows"] }),
      JSON.stringify({ reasons: ["Shared interest in reliable agent workflows"] }),
      JSON.stringify({ reason: "You both care about making agent workflows reliable and understandable." }),
      now + 14 * 86_400_000,
      now - 5 * 86_400_000,
      now - 5 * 86_400_000,
      taxonomy.version,
    ),
    upsertEvaluation(DB, `${pendingProposalId}_viewer`, pendingProposalId, viewerUserId, now - 110_000),
    upsertEvaluation(DB, `${pendingProposalId}_peer`, pendingProposalId, pendingUserId, now - 100_000),
    DB.prepare(
      "INSERT INTO matches(id,match_pair_id,proposal_id,matched_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET matched_at=excluded.matched_at",
    ).bind(matchId, connectedPairId, connectedProposalId, now - 5 * 86_400_000),
    DB.prepare(
      "INSERT INTO connections(id,match_pair_id,match_id,state,created_at,updated_at) VALUES(?,?,?,'active',?,?) ON CONFLICT(id) DO UPDATE SET state='active',ended_by_user_id=NULL,ended_at=NULL,updated_at=excluded.updated_at",
    ).bind(connectionId, connectedPairId, matchId, now - 5 * 86_400_000, now),
    upsertConnectionSide(DB, connectionId, viewerUserId, now),
    upsertConnectionSide(DB, connectionId, connectedUserId, now),
    DB.prepare(
      "INSERT INTO connection_snapshots(connection_id,subject_user_id,display_name,summary,captured_at) VALUES(?,?,?,?,?) ON CONFLICT(connection_id,subject_user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,captured_at=excluded.captured_at",
    ).bind(connectionId, connectedUserId, "Rowan Patel", "Designing dependable agent workflows that stay understandable to the people using them.", now),
    DB.prepare(
      "INSERT INTO connection_snapshots(connection_id,subject_user_id,display_name,summary,captured_at) VALUES(?,?,?,?,?) ON CONFLICT(connection_id,subject_user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,captured_at=excluded.captured_at",
    ).bind(connectionId, viewerUserId, "Buildmates Tester", "Building thoughtful AI products and reliable collaboration workflows.", now),
    DB.prepare(
      "INSERT INTO connection_context_snapshots(connection_id,reason,shared_context_json,theme_topic_id,captured_at) VALUES(?,?,?,NULL,?) ON CONFLICT(connection_id) DO UPDATE SET reason=excluded.reason,shared_context_json=excluded.shared_context_json,captured_at=excluded.captured_at",
    ).bind(
      connectionId,
      "You both care about dependable agent workflows and clear product feedback loops.",
      JSON.stringify(["Agent reliability", "Human-readable evaluation", "Shipping small production tools"]),
      now,
    ),
    DB.prepare(
      "INSERT INTO rooms(id,match_pair_id,connection_id,status,theme_topic_id,created_at,updated_at) VALUES(?,?,?,'active',NULL,?,?) ON CONFLICT(id) DO UPDATE SET status='active',updated_at=excluded.updated_at",
    ).bind(roomId, connectedPairId, connectionId, now - 5 * 86_400_000, now),
    upsertRoomMembership(DB, roomId, viewerUserId, now - 5 * 86_400_000),
    upsertRoomMembership(DB, roomId, connectedUserId, now - 5 * 86_400_000),
    DB.prepare(
      "INSERT INTO messages(id,room_id,sender_user_id,client_message_id,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(room_id,sender_user_id,client_message_id) DO UPDATE SET body=excluded.body,deleted_at=NULL",
    ).bind(`${roomId}_message_peer`, roomId, connectedUserId, "fixture-peer", "I mapped the failure cases. The surprising part is how often stale context looks like a retrieval miss.", now - 45_000),
    DB.prepare(
      "INSERT INTO messages(id,room_id,sender_user_id,client_message_id,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(room_id,sender_user_id,client_message_id) DO UPDATE SET body=excluded.body,deleted_at=NULL",
    ).bind(`${roomId}_message_viewer`, roomId, viewerUserId, "fixture-viewer", "That overlaps with what I am seeing. I can share the smallest reproducible example next.", now - 30_000),
  ]);

  await DB.batch([
    upsertCircle(DB, activeCircleId, "Reliable Agents Lab", "A small group comparing practical ways to make agent workflows easier to trust.", "active", now - 2 * 86_400_000, now),
    upsertCircleMembership(DB, activeCircleId, viewerUserId, "owner", "active", now - 2 * 86_400_000),
    upsertCircleMembership(DB, activeCircleId, connectedUserId, "member", "active", now - 2 * 86_400_000),
    upsertCircleMembership(DB, activeCircleId, pendingUserId, "member", "invited", null),
    upsertSurface(DB, `${activeCircleId}_surface`, viewerUserId, activeCircleId, now),
    DB.prepare(
      "INSERT INTO circle_messages(id,circle_id,sender_user_id,client_message_id,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(circle_id,sender_user_id,client_message_id) DO UPDATE SET body=excluded.body,deleted_at=NULL",
    ).bind(`${activeCircleId}_message`, activeCircleId, connectedUserId, "fixture-circle", "I added the evaluation notes from this week's agent run.", now - 20_000),
    upsertCircle(DB, invitationCircleId, "RAG Field Notes", "A focused space for builders comparing retrieval experiments and evaluation methods.", "active", now - 86_400_000, now - 10_000),
    upsertCircleMembership(DB, invitationCircleId, pendingUserId, "owner", "active", now - 86_400_000),
    upsertCircleMembership(DB, invitationCircleId, viewerUserId, "member", "invited", null),
    upsertSurface(DB, `${invitationCircleId}_surface`, pendingUserId, invitationCircleId, now),
    DB.prepare(
      "INSERT INTO notifications(id,user_id,kind,delivery,payload_json,read_at,created_at) VALUES(?,?,'new_message','immediate',?,NULL,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,read_at=NULL,created_at=excluded.created_at",
    ).bind(`${roomId}_notification`, viewerUserId, JSON.stringify({ roomId, connectionId, senderName: "Rowan Patel" }), now - 15_000),
    DB.prepare(
      "INSERT INTO notifications(id,user_id,kind,delivery,payload_json,read_at,created_at) VALUES(?,?,'circle_invitation','immediate',?,NULL,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,read_at=NULL,created_at=excluded.created_at",
    ).bind(`${invitationCircleId}_notification`, viewerUserId, JSON.stringify({ circleId: invitationCircleId, circleName: "RAG Field Notes" }), now - 10_000),
  ]);

  return {
    viewerHandle,
    pendingUserId,
    connectedUserId,
    pendingProposalId,
    connectionId,
    roomId,
    activeCircleId,
    invitationCircleId,
  };
}

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function upsertHandle(DB: D1Database, userId: string, handle: string, at: number) {
  return DB.prepare(
    "INSERT INTO handles(user_id,handle,normalized_handle,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,normalized_handle=excluded.normalized_handle",
  ).bind(userId, handle, handle.toLowerCase(), at);
}

function upsertMatchIndex(DB: D1Database, userId: string, taxonomyVersionId: string, at: number) {
  return DB.prepare(
    "INSERT INTO builder_match_index(user_id,version,taxonomy_version_id,topics_json,tools_json,domains_json,stages_json,intents_json,updated_at) VALUES(?,1,?,'[\"ai\",\"mcp\"]','[]','[]','[]','[]',?) ON CONFLICT(user_id) DO UPDATE SET version=1,taxonomy_version_id=excluded.taxonomy_version_id,topics_json=excluded.topics_json,updated_at=excluded.updated_at",
  ).bind(userId, taxonomyVersionId, at);
}

function upsertPair(DB: D1Database, id: string, pair: [string, string], at: number) {
  return DB.prepare(
    "INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
  ).bind(id, pair[0], pair[1], at);
}

function upsertEvaluation(DB: D1Database, id: string, proposalId: string, userId: string, at: number) {
  return DB.prepare(
    "INSERT INTO codex_evaluations(id,proposal_id,user_id,decision,reason_summary,evidence_ids_json,index_version,created_at) VALUES(?,?,?,'approve',?,'[]',1,?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET decision='approve',reason_summary=excluded.reason_summary,index_version=1",
  ).bind(id, proposalId, userId, "Their current work is mutually relevant without assuming either person must provide a service.", at);
}

function upsertConnectionSide(DB: D1Database, connectionId: string, userId: string, at: number) {
  return DB.prepare(
    "INSERT INTO connection_sides(connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at) VALUES(?,?,0,1,?,?) ON CONFLICT(connection_id,user_id) DO UPDATE SET muted=0,updated_at=excluded.updated_at",
  ).bind(connectionId, userId, at, at);
}

function upsertRoomMembership(DB: D1Database, roomId: string, userId: string, at: number) {
  return DB.prepare(
    "INSERT INTO room_memberships(room_id,user_id,joined_at,left_at) VALUES(?,?,?,NULL) ON CONFLICT(room_id,user_id) DO UPDATE SET left_at=NULL",
  ).bind(roomId, userId, at);
}

function upsertCircle(DB: D1Database, id: string, name: string, purpose: string, status: string, createdAt: number, updatedAt: number) {
  return DB.prepare(
    "INSERT INTO circles(id,name,purpose,status,governance_mode,governance_version,created_at,updated_at) VALUES(?,?,?,?,'admin',1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,purpose=excluded.purpose,status=excluded.status,updated_at=excluded.updated_at",
  ).bind(id, name, purpose, status, createdAt, updatedAt);
}

function upsertCircleMembership(DB: D1Database, circleId: string, userId: string, role: string, status: string, joinedAt: number | null) {
  return DB.prepare(
    "INSERT INTO circle_memberships(circle_id,user_id,role,status,joined_at) VALUES(?,?,?,?,?) ON CONFLICT(circle_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status,joined_at=excluded.joined_at",
  ).bind(circleId, userId, role, status, joinedAt);
}

function upsertSurface(DB: D1Database, id: string, ownerUserId: string, subjectId: string, at: number) {
  return DB.prepare(
    "INSERT INTO surfaces(id,owner_user_id,kind,subject_id,published_revision_id,governance_version,created_at,updated_at) VALUES(?,?,'circle',?,NULL,1,?,?) ON CONFLICT(kind,subject_id) DO UPDATE SET owner_user_id=excluded.owner_user_id,updated_at=excluded.updated_at",
  ).bind(id, ownerUserId, subjectId, at, at);
}
