import { MATCH_WEIGHT_VERSION } from "@buildmates/matching";

export const QA_SCENARIOS = [
  "candidate_spectrum",
  "incoming_interest",
  "reciprocal_connection",
  "new_message",
  "circle_invitation",
  "renewed_relevance",
  "positive_feedback",
  "permission_exclusion",
  "no_change",
] as const;

export type QaScenario = (typeof QA_SCENARIOS)[number];

export type QaScenarioResult = {
  scenario: QaScenario;
  changed: boolean;
  viewerUserId: string;
  candidateUserIds: Record<string, string>;
  proposalId: string;
  connectionId: string;
  roomId: string;
  circleId: string;
  digest: QaScenarioDigest;
};

type QaScenarioDigest = {
  candidates: number;
  pendingProposals: number;
  connections: number;
  messages: number;
  circleInvitations: number;
  unreadNotifications: number;
  positiveFeedback: number;
  renewedRelevanceUpdates: number;
};

type QaIds = ReturnType<typeof qaIds>;

/**
 * Applies one deterministic, cumulative QA scenario for a single authenticated
 * test principal. Reapplying a scenario is idempotent. `no_change` deliberately
 * performs no writes, which makes it useful for proving that a Work Pulse does
 * not invent a delta when the underlying product state is unchanged.
 */
export async function applyQaScenario(
  DB: D1Database,
  viewerUserId: string,
  scenario: QaScenario,
  now = Date.now(),
): Promise<QaScenarioResult> {
  const ids = qaIds(viewerUserId);
  const before = await digest(DB, viewerUserId, ids);

  if (scenario !== "no_change") {
    await ensureViewer(DB, viewerUserId, ids, now);
  }

  if (scenario === "candidate_spectrum") await seedCandidateSpectrum(DB, viewerUserId, ids, now);
  if (scenario === "incoming_interest") await seedIncomingInterest(DB, viewerUserId, ids, now);
  if (scenario === "reciprocal_connection") await seedReciprocalConnection(DB, viewerUserId, ids, now);
  if (scenario === "new_message") await seedMessage(DB, viewerUserId, ids, now);
  if (scenario === "circle_invitation") await seedCircleInvitation(DB, viewerUserId, ids, now);
  if (scenario === "renewed_relevance") await seedRenewedRelevance(DB, viewerUserId, ids, now);
  if (scenario === "positive_feedback") await seedPositiveFeedback(DB, viewerUserId, ids, now);
  if (scenario === "permission_exclusion") await seedPermissionExclusion(DB, viewerUserId, ids, now);

  const after = await digest(DB, viewerUserId, ids);
  return {
    scenario,
    changed: JSON.stringify(before) !== JSON.stringify(after),
    viewerUserId,
    candidateUserIds: ids.candidates,
    proposalId: ids.proposal,
    connectionId: ids.connection,
    roomId: ids.room,
    circleId: ids.circle,
    digest: after,
  };
}

/** Removes only records created for this viewer by applyQaScenario. */
export async function resetQaScenarios(DB: D1Database, viewerUserId: string): Promise<void> {
  const ids = qaIds(viewerUserId);
  const candidateIds = Object.values(ids.candidates);
  const pairIds = Object.values(ids.pairs);
  const scoreIds = Object.values(ids.scores);
  const seededUserPlaceholders = candidateIds.map(() => "?").join(",");

  // Delete viewer-owned leaves first. The canonical schema intentionally does
  // not cascade every user reference, so cleanup is explicit and auditable.
  await DB.batch([
    DB.prepare("DELETE FROM notifications WHERE id LIKE ?").bind(`${ids.prefix}%`),
    DB.prepare("DELETE FROM notifications WHERE id=?").bind(`renewed-relevance:${ids.connection}:${ids.projectUpdate}:${viewerUserId}`),
    DB.prepare("DELETE FROM introduction_feedback WHERE id=?").bind(ids.feedback),
    DB.prepare("DELETE FROM room_module_entries WHERE module_id IN (SELECT id FROM room_modules WHERE room_id=?)").bind(ids.room),
    DB.prepare("DELETE FROM room_modules WHERE room_id=?").bind(ids.room),
    DB.prepare("DELETE FROM room_upgrade_responses WHERE proposal_id IN (SELECT id FROM room_upgrade_proposals WHERE room_id=?)").bind(ids.room),
    DB.prepare("DELETE FROM room_upgrade_proposals WHERE room_id=?").bind(ids.room),
    DB.prepare("DELETE FROM circle_votes WHERE proposal_id IN (SELECT id FROM circle_proposals WHERE circle_id=?)").bind(ids.circle),
    DB.prepare("DELETE FROM circle_module_entries WHERE module_id IN (SELECT id FROM circle_modules WHERE circle_id=?)").bind(ids.circle),
    DB.prepare("DELETE FROM circle_module_rule_versions WHERE module_id IN (SELECT id FROM circle_modules WHERE circle_id=?)").bind(ids.circle),
    DB.prepare("DELETE FROM circle_metric_entries WHERE metric_id IN (SELECT id FROM circle_metrics WHERE circle_id=?)").bind(ids.circle),
    DB.prepare("DELETE FROM circle_metrics WHERE circle_id=?").bind(ids.circle),
    DB.prepare("DELETE FROM circle_modules WHERE circle_id=?").bind(ids.circle),
    DB.prepare("DELETE FROM circle_proposals WHERE circle_id=?").bind(ids.circle),
    DB.prepare("DELETE FROM circle_messages WHERE circle_id=?").bind(ids.circle),
    DB.prepare("DELETE FROM circle_memberships WHERE circle_id=?").bind(ids.circle),
    DB.prepare("DELETE FROM surfaces WHERE kind='circle' AND subject_id=?").bind(ids.circle),
    DB.prepare("DELETE FROM circles WHERE id=?").bind(ids.circle),
    DB.prepare("DELETE FROM messages WHERE room_id=?").bind(ids.room),
    DB.prepare("DELETE FROM room_memberships WHERE room_id=?").bind(ids.room),
    DB.prepare("DELETE FROM surfaces WHERE kind='room' AND subject_id=?").bind(ids.room),
    DB.prepare("DELETE FROM rooms WHERE id=?").bind(ids.room),
    DB.prepare("DELETE FROM connection_update_subscriptions WHERE connection_id=?").bind(ids.connection),
    DB.prepare("DELETE FROM connection_reminders WHERE connection_id=?").bind(ids.connection),
    DB.prepare("DELETE FROM connection_private_notes WHERE connection_id=?").bind(ids.connection),
    DB.prepare("DELETE FROM reconnect_requests WHERE connection_id=?").bind(ids.connection),
    DB.prepare("DELETE FROM connection_context_snapshots WHERE connection_id=?").bind(ids.connection),
    DB.prepare("DELETE FROM connection_snapshots WHERE connection_id=?").bind(ids.connection),
    DB.prepare("DELETE FROM connection_sides WHERE connection_id=?").bind(ids.connection),
    DB.prepare("DELETE FROM connections WHERE id=?").bind(ids.connection),
    DB.prepare("DELETE FROM matches WHERE id=?").bind(ids.match),
    DB.prepare("DELETE FROM human_responses WHERE proposal_id IN (?,?)").bind(ids.proposal, ids.connectedProposal),
    DB.prepare("DELETE FROM codex_evaluations WHERE proposal_id IN (?,?)").bind(ids.proposal, ids.connectedProposal),
    DB.prepare("DELETE FROM match_proposals WHERE id IN (?,?)").bind(ids.proposal, ids.connectedProposal),
    DB.prepare(`DELETE FROM candidate_batches WHERE user_id=? AND EXISTS (SELECT 1 FROM json_each(candidate_ids_json) WHERE value IN (${seededUserPlaceholders}))`).bind(viewerUserId, ...candidateIds),
    DB.prepare(`DELETE FROM matching_exclusions WHERE user_id=? AND normalized_value IN (${seededUserPlaceholders})`).bind(viewerUserId, ...candidateIds),
    ...scoreIds.map((id) => DB.prepare("DELETE FROM pair_scores WHERE id=?").bind(id)),
    ...pairIds.map((id) => DB.prepare("DELETE FROM match_pairs WHERE id=?").bind(id)),
    DB.prepare("DELETE FROM project_updates WHERE id=?").bind(ids.projectUpdate),
    DB.prepare("DELETE FROM projects WHERE id=?").bind(ids.project),
    ...candidateIds.map((id) => DB.prepare("DELETE FROM builder_match_index WHERE user_id=?").bind(id)),
    ...candidateIds.map((id) => DB.prepare("DELETE FROM handles WHERE user_id=?").bind(id)),
    ...candidateIds.map((id) => DB.prepare("DELETE FROM profiles WHERE user_id=?").bind(id)),
    DB.prepare(`DELETE FROM users WHERE id IN (${seededUserPlaceholders})`).bind(...candidateIds),
  ]);
}

function qaIds(viewerUserId: string) {
  const suffix = viewerUserId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-20) || "viewer";
  const prefix = `qa_${suffix}_`;
  const candidates = {
    strong: `${prefix}strong`,
    adjacent: `${prefix}adjacent`,
    weak: `${prefix}weak`,
    duplicate: `${prefix}duplicate`,
    excluded: `${prefix}excluded`,
    connected: `${prefix}connected`,
  };
  const pairs = Object.fromEntries(Object.entries(candidates).map(([key, id]) => [key, `${prefix}pair_${key}_${id < viewerUserId ? "a" : "b"}`])) as Record<keyof typeof candidates, string>;
  const scores = Object.fromEntries(Object.keys(candidates).map((key) => [key, `${prefix}score_${key}`])) as Record<keyof typeof candidates, string>;
  return {
    prefix,
    candidates,
    pairs,
    scores,
    proposal: `${prefix}proposal_incoming`,
    connectedProposal: `${prefix}proposal_connected`,
    match: `${prefix}match`,
    connection: `${prefix}connection`,
    room: `${prefix}room`,
    circle: `${prefix}circle`,
    feedback: `${prefix}feedback`,
    project: `${prefix}project`,
    projectUpdate: `${prefix}project_update`,
  };
}

async function ensureViewer(DB: D1Database, viewerUserId: string, ids: QaIds, now: number) {
  const taxonomy = await activeTaxonomy(DB);
  await DB.batch([
    DB.prepare("INSERT INTO profiles(id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at) VALUES(?,?,?,?,?,'[]','suggested_connections',1,'manual',0,?,?,?) ON CONFLICT(user_id) DO UPDATE SET allow_matching=1,updated_at=excluded.updated_at")
      .bind(`${ids.prefix}viewer_profile`, viewerUserId, "QA Builder", "Building privacy-aware collaboration tools.", "Testing Buildmates end to end.", now - 86_400_000, now - 86_400_000, now),
    matchIndex(DB, viewerUserId, taxonomy.id, '["ai","mcp","retrieval"]', now),
  ]);
}

async function seedCandidateSpectrum(DB: D1Database, viewerUserId: string, ids: QaIds, now: number) {
  const taxonomy = await activeTaxonomy(DB);
  const rows = [
    ["strong", "Mira Chen", "Building practical retrieval evaluation for AI products.", '["ai","retrieval","evaluation"]', 9400, ["topicOverlap", "intentFit"]],
    ["adjacent", "Amara Okafor", "Exploring human-centered agent observability and product research.", '["ai","observability","research"]', 7600, ["topicAdjacency", "toolDomainFit"]],
    ["weak", "Theo Martin", "Building developer tooling for local-first creative software.", '["developer-tools","creative-software"]', 3100, ["serendipity"]],
    ["duplicate", "Mira Labs", "Building a lightweight retrieval testing workspace for applied AI teams.", '["ai","retrieval"]', 9100, ["topicOverlap"]],
    ["excluded", "Hidden Candidate", "This candidate must never appear in suggestions or explanations.", '["ai","retrieval"]', 9900, ["topicOverlap", "intentFit"]],
  ] as const;

  for (const [key, name, summary, topics, score, components] of rows) {
    const candidateId = ids.candidates[key];
    await upsertCandidate(DB, candidateId, `${ids.prefix}profile_${key}`, `${key}_${ids.prefix.slice(3, 11)}`, name, summary, topics, taxonomy.id, now);
    await upsertScore(DB, viewerUserId, candidateId, ids.scores[key], score, components, taxonomy.version, now);
  }

  await DB.prepare("INSERT INTO matching_exclusions(id,user_id,kind,normalized_value,created_at) VALUES(?,?,'user',?,?) ON CONFLICT(user_id,kind,normalized_value) DO NOTHING")
    .bind(`${ids.prefix}exclude_user`, viewerUserId, ids.candidates.excluded, now).run();
}

async function seedIncomingInterest(DB: D1Database, viewerUserId: string, ids: QaIds, now: number) {
  await seedCandidateSpectrum(DB, viewerUserId, ids, now);
  const taxonomy = await activeTaxonomy(DB);
  const pair = canonicalPair(viewerUserId, ids.candidates.strong);
  await DB.batch([
    DB.prepare("INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at) VALUES(?,?,?,?) ON CONFLICT(user_a_id,user_b_id) DO NOTHING").bind(ids.pairs.strong, pair[0], pair[1], now - 60_000),
    DB.prepare("INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,taxonomy_version,weight_version,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,shared_explanation_json,state,expires_at,terminal_at,created_at) VALUES(?,?,1,1,1,?,?,'manual','manual',?,?,?,'pending',?,NULL,?) ON CONFLICT(id) DO UPDATE SET state='pending',expires_at=excluded.expires_at,terminal_at=NULL")
      .bind(ids.proposal, ids.pairs.strong, taxonomy.version, MATCH_WEIGHT_VERSION, JSON.stringify({ reasons: ["Practical retrieval evaluation"] }), JSON.stringify({ reasons: ["Practical retrieval evaluation"] }), JSON.stringify({ reason: "You are both testing retrieval quality in real products." }), now + 7 * 86_400_000, now - 50_000),
    evaluation(DB, `${ids.prefix}evaluation_viewer`, ids.proposal, viewerUserId, now - 40_000),
    evaluation(DB, `${ids.prefix}evaluation_peer`, ids.proposal, ids.candidates.strong, now - 35_000),
    DB.prepare("INSERT INTO human_responses(id,proposal_id,user_id,response,created_at) VALUES(?,?,?,'interested',?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET response='interested',created_at=excluded.created_at")
      .bind(`${ids.prefix}interest_peer`, ids.proposal, ids.candidates.strong, now - 30_000),
    DB.prepare("INSERT INTO notifications(id,user_id,kind,delivery,payload_json,read_at,created_at) VALUES(?,?,'match_interest','immediate',?,NULL,?) ON CONFLICT(id) DO NOTHING")
      .bind(`${ids.prefix}notification_interest`, viewerUserId, JSON.stringify({ proposalId: ids.proposal, builderName: "Mira Chen" }), now - 25_000),
  ]);
}

async function seedReciprocalConnection(DB: D1Database, viewerUserId: string, ids: QaIds, now: number) {
  await seedCandidateSpectrum(DB, viewerUserId, ids, now);
  const peer = ids.candidates.connected;
  const taxonomy = await activeTaxonomy(DB);
  await upsertCandidate(DB, peer, `${ids.prefix}profile_connected`, `rowan_${ids.prefix.slice(3, 11)}`, "Rowan Patel", "Designing dependable agent workflows that stay understandable.", '["ai","mcp","observability"]', taxonomy.id, now);
  await upsertScore(DB, viewerUserId, peer, ids.scores.connected, 9000, ["topicOverlap", "toolDomainFit"], taxonomy.version, now);
  const pair = canonicalPair(viewerUserId, peer);
  await DB.batch([
    DB.prepare("INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at) VALUES(?,?,?,?) ON CONFLICT(user_a_id,user_b_id) DO NOTHING").bind(ids.pairs.connected, pair[0], pair[1], now - 86_400_000),
    DB.prepare("INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,taxonomy_version,weight_version,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,shared_explanation_json,state,expires_at,terminal_at,created_at) VALUES(?,?,1,1,1,?,?,'manual','manual',?,?,?,'matched',?,?,?) ON CONFLICT(id) DO UPDATE SET state='matched',terminal_at=excluded.terminal_at")
      .bind(ids.connectedProposal, ids.pairs.connected, taxonomy.version, MATCH_WEIGHT_VERSION, JSON.stringify({ reasons: ["Dependable agent workflows"] }), JSON.stringify({ reasons: ["Dependable agent workflows"] }), JSON.stringify({ reason: "You both care about dependable agent workflows." }), now + 7 * 86_400_000, now - 86_400_000, now - 86_400_000),
    evaluation(DB, `${ids.prefix}evaluation_connected_viewer`, ids.connectedProposal, viewerUserId, now - 86_400_000),
    evaluation(DB, `${ids.prefix}evaluation_connected_peer`, ids.connectedProposal, peer, now - 86_400_000),
    DB.prepare("INSERT INTO human_responses(id,proposal_id,user_id,response,created_at) VALUES(?,?,?,'interested',?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET response='interested'").bind(`${ids.prefix}interest_connected_viewer`, ids.connectedProposal, viewerUserId, now - 86_400_000),
    DB.prepare("INSERT INTO human_responses(id,proposal_id,user_id,response,created_at) VALUES(?,?,?,'interested',?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET response='interested'").bind(`${ids.prefix}interest_connected_peer`, ids.connectedProposal, peer, now - 86_400_000),
    DB.prepare("INSERT INTO matches(id,match_pair_id,proposal_id,matched_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(ids.match, ids.pairs.connected, ids.connectedProposal, now - 86_400_000),
    DB.prepare("INSERT INTO connections(id,match_pair_id,match_id,state,created_at,updated_at) VALUES(?,?,?,'active',?,?) ON CONFLICT(id) DO UPDATE SET state='active',updated_at=excluded.updated_at").bind(ids.connection, ids.pairs.connected, ids.match, now - 86_400_000, now),
    connectionSide(DB, ids.connection, viewerUserId, now),
    connectionSide(DB, ids.connection, peer, now),
    DB.prepare("INSERT INTO connection_snapshots(connection_id,subject_user_id,display_name,summary,captured_at) VALUES(?,?,?,?,?) ON CONFLICT(connection_id,subject_user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary")
      .bind(ids.connection, peer, "Rowan Patel", "Designing dependable agent workflows that stay understandable.", now),
    DB.prepare("INSERT INTO connection_context_snapshots(connection_id,reason,shared_context_json,theme_topic_id,captured_at) VALUES(?,?,?,NULL,?) ON CONFLICT(connection_id) DO UPDATE SET reason=excluded.reason,shared_context_json=excluded.shared_context_json")
      .bind(ids.connection, "You both care about dependable agent workflows.", JSON.stringify(["Agent reliability", "MCP tooling"]), now),
    DB.prepare("INSERT INTO rooms(id,match_pair_id,connection_id,status,theme_topic_id,created_at,updated_at) VALUES(?,?,?,'active',NULL,?,?) ON CONFLICT(id) DO UPDATE SET status='active',updated_at=excluded.updated_at")
      .bind(ids.room, ids.pairs.connected, ids.connection, now - 86_400_000, now),
    roomMembership(DB, ids.room, viewerUserId, now - 86_400_000),
    roomMembership(DB, ids.room, peer, now - 86_400_000),
    DB.prepare("INSERT INTO notifications(id,user_id,kind,delivery,payload_json,read_at,created_at) VALUES(?,?,'match_opened','immediate',?,NULL,?) ON CONFLICT(id) DO NOTHING")
      .bind(`${ids.prefix}notification_match`, viewerUserId, JSON.stringify({ connectionId: ids.connection, roomId: ids.room, builderName: "Rowan Patel" }), now - 80_000),
  ]);
}

async function seedMessage(DB: D1Database, viewerUserId: string, ids: QaIds, now: number) {
  await seedReciprocalConnection(DB, viewerUserId, ids, now);
  await DB.batch([
    DB.prepare("INSERT INTO messages(id,room_id,sender_user_id,client_message_id,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(room_id,sender_user_id,client_message_id) DO NOTHING")
      .bind(`${ids.prefix}message_1`, ids.room, ids.candidates.connected, `${ids.prefix}client_message_1`, "I mapped the failure cases. Want to compare the smallest reproducible examples?", now - 3_000),
    DB.prepare("INSERT INTO messages(id,room_id,sender_user_id,client_message_id,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(room_id,sender_user_id,client_message_id) DO NOTHING")
      .bind(`${ids.prefix}message_2`, ids.room, viewerUserId, `${ids.prefix}client_message_2`, "Yes. I have a stale-context case that should make a useful comparison.", now - 2_000),
    DB.prepare("INSERT INTO messages(id,room_id,sender_user_id,client_message_id,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(room_id,sender_user_id,client_message_id) DO NOTHING")
      .bind(`${ids.prefix}message_3`, ids.room, ids.candidates.connected, `${ids.prefix}client_message_3`, "Great. I will share the smallest trace and the expected boundary.", now - 1_000),
    DB.prepare("INSERT INTO messages(id,room_id,sender_user_id,client_message_id,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(room_id,sender_user_id,client_message_id) DO NOTHING")
      .bind(`${ids.prefix}message_4`, ids.room, viewerUserId, `${ids.prefix}client_message_4`, "That works. I will bring the matching trace from my side.", now),
    DB.prepare("INSERT INTO notifications(id,user_id,kind,delivery,payload_json,read_at,created_at) VALUES(?,?,'new_message','immediate',?,NULL,?) ON CONFLICT(id) DO NOTHING")
      .bind(`${ids.prefix}notification_message`, viewerUserId, JSON.stringify({ roomId: ids.room, connectionId: ids.connection, senderName: "Rowan Patel" }), now),
  ]);
}

async function seedCircleInvitation(DB: D1Database, viewerUserId: string, ids: QaIds, now: number) {
  await seedCandidateSpectrum(DB, viewerUserId, ids, now);
  await DB.batch([
    DB.prepare("INSERT INTO circles(id,name,purpose,status,governance_mode,governance_version,created_at,updated_at) VALUES(?,? ,?,'active','admin',1,?,?) ON CONFLICT(id) DO UPDATE SET status='active',updated_at=excluded.updated_at")
      .bind(ids.circle, "RAG Field Notes", "A small Circle comparing retrieval experiments and evaluation methods.", now - 86_400_000, now),
    DB.prepare("INSERT INTO circle_memberships(circle_id,user_id,role,status,joined_at) VALUES(?,?,'owner','active',?) ON CONFLICT(circle_id,user_id) DO UPDATE SET role='owner',status='active',joined_at=excluded.joined_at")
      .bind(ids.circle, ids.candidates.strong, now - 86_400_000),
    DB.prepare("INSERT INTO circle_memberships(circle_id,user_id,role,status,joined_at) VALUES(?,?,'member','invited',NULL) ON CONFLICT(circle_id,user_id) DO UPDATE SET role='member',status='invited',joined_at=NULL")
      .bind(ids.circle, viewerUserId),
    DB.prepare("INSERT INTO notifications(id,user_id,kind,delivery,payload_json,read_at,created_at) VALUES(?,?,'circle_invitation','immediate',?,NULL,?) ON CONFLICT(id) DO NOTHING")
      .bind(`${ids.prefix}notification_circle`, viewerUserId, JSON.stringify({ circleId: ids.circle, circleName: "RAG Field Notes" }), now),
  ]);
}

async function seedRenewedRelevance(DB: D1Database, viewerUserId: string, ids: QaIds, now: number) {
  await seedReciprocalConnection(DB, viewerUserId, ids, now);
  await DB.batch([
    DB.prepare("INSERT INTO projects(id,owner_user_id,slug,title,summary,audience,allow_matching,status,stage,indexable,published_at,created_at,updated_at) VALUES(?,?,?,?,?,'public',1,'active','building',0,?,?,?) ON CONFLICT(id) DO UPDATE SET summary=excluded.summary,status='active',published_at=excluded.published_at,updated_at=excluded.updated_at")
      .bind(ids.project, ids.candidates.connected, `qa-agent-observability-${ids.prefix.slice(3, 11)}`, "Agent Observability Notes", "New failure-mode notes now overlap with your current work.", now - 86_400_000, now - 86_400_000, now),
    DB.prepare("INSERT INTO project_updates(id,project_id,author_user_id,body,audience,created_at) VALUES(?,?,?,?,'public',?) ON CONFLICT(id) DO NOTHING")
      .bind(ids.projectUpdate, ids.project, ids.candidates.connected, "Published a compact taxonomy for stale-context failures in retrieval pipelines.", now),
  ]);
}

async function seedPositiveFeedback(DB: D1Database, viewerUserId: string, ids: QaIds, now: number) {
  await seedMessage(DB, viewerUserId, ids, now);
  await DB.prepare("INSERT INTO introduction_feedback(id,connection_id,user_id,useful,reasons_json,similar_match_preference,follow_up_intent,private_note,created_at) VALUES(?,?,?,1,?,'more','collaborate',NULL,?) ON CONFLICT(connection_id,user_id) DO UPDATE SET useful=1,reasons_json=excluded.reasons_json,similar_match_preference='more',follow_up_intent='collaborate'")
    .bind(ids.feedback, ids.connection, viewerUserId, JSON.stringify(["useful_context", "would_continue"]), now).run();
}

async function seedPermissionExclusion(DB: D1Database, viewerUserId: string, ids: QaIds, now: number) {
  await seedCandidateSpectrum(DB, viewerUserId, ids, now);
  await DB.batch([
    DB.prepare("INSERT INTO profile_fields(profile_id,field_key,value_json,audience,allow_matching,source_status,provenance,updated_at) VALUES(?,?,?,'private',0,'confirmed','self_reported',?) ON CONFLICT(profile_id,field_key) DO UPDATE SET value_json=excluded.value_json,audience='private',allow_matching=0,updated_at=excluded.updated_at")
      .bind(`${ids.prefix}profile_excluded`, "qa_private_fact", JSON.stringify("QA_PRIVATE_SENTINEL_NEVER_RENDER"), now),
    DB.prepare("INSERT INTO matching_exclusions(id,user_id,kind,normalized_value,created_at) VALUES(?,?,'user',?,?) ON CONFLICT(user_id,kind,normalized_value) DO NOTHING")
      .bind(`${ids.prefix}exclude_user`, viewerUserId, ids.candidates.excluded, now),
  ]);
}

async function digest(DB: D1Database, viewerUserId: string, ids: QaIds): Promise<QaScenarioDigest> {
  const row = await DB.prepare(`SELECT
    (SELECT COUNT(*) FROM pair_scores score WHERE score.id LIKE ?) AS candidates,
    (SELECT COUNT(*) FROM match_proposals proposal JOIN match_pairs pair ON pair.id=proposal.match_pair_id WHERE proposal.state='pending' AND (pair.user_a_id=? OR pair.user_b_id=?) AND proposal.id LIKE ?) AS pendingProposals,
    (SELECT COUNT(*) FROM connection_sides side JOIN connections connection_row ON connection_row.id=side.connection_id WHERE side.user_id=? AND connection_row.id=? AND connection_row.state='active') AS connections,
    (SELECT COUNT(*) FROM messages WHERE room_id=? AND id LIKE ?) AS messages,
    (SELECT COUNT(*) FROM circle_memberships WHERE circle_id=? AND user_id=? AND status='invited') AS circleInvitations,
    (SELECT COUNT(*) FROM notifications WHERE user_id=? AND read_at IS NULL AND id LIKE ?) AS unreadNotifications,
    (SELECT COUNT(*) FROM introduction_feedback WHERE connection_id=? AND user_id=? AND useful=1) AS positiveFeedback,
    (SELECT COUNT(*) FROM project_updates WHERE id=?) AS renewedRelevanceUpdates`)
    .bind(`${ids.prefix}score_%`, viewerUserId, viewerUserId, `${ids.prefix}%`, viewerUserId, ids.connection, ids.room, `${ids.prefix}%`, ids.circle, viewerUserId, viewerUserId, `${ids.prefix}%`, ids.connection, viewerUserId, ids.projectUpdate)
    .first<Record<keyof QaScenarioDigest, number>>();
  return {
    candidates: Number(row?.candidates ?? 0),
    pendingProposals: Number(row?.pendingProposals ?? 0),
    connections: Number(row?.connections ?? 0),
    messages: Number(row?.messages ?? 0),
    circleInvitations: Number(row?.circleInvitations ?? 0),
    unreadNotifications: Number(row?.unreadNotifications ?? 0),
    positiveFeedback: Number(row?.positiveFeedback ?? 0),
    renewedRelevanceUpdates: Number(row?.renewedRelevanceUpdates ?? 0),
  };
}

async function activeTaxonomy(DB: D1Database) {
  const taxonomy = await DB.prepare("SELECT id,version FROM taxonomy_versions WHERE status='active' ORDER BY version DESC LIMIT 1").first<{ id: string; version: number }>();
  if (!taxonomy) throw new Error("qa_active_taxonomy_missing");
  return taxonomy;
}

async function upsertCandidate(DB: D1Database, userId: string, profileId: string, handle: string, name: string, summary: string, topics: string, taxonomyId: string, now: number) {
  await DB.batch([
    DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES(?,'active','none',?,?) ON CONFLICT(id) DO UPDATE SET status='active',updated_at=excluded.updated_at,deleted_at=NULL").bind(userId, now - 86_400_000, now),
    DB.prepare("INSERT INTO profiles(id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at) VALUES(?,?,?,?,?,'[]','suggested_connections',1,'manual',0,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,allow_matching=1,published_at=excluded.published_at,updated_at=excluded.updated_at")
      .bind(profileId, userId, name, summary, summary, now - 86_400_000, now - 86_400_000, now),
    DB.prepare("INSERT INTO handles(user_id,handle,normalized_handle,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET handle=excluded.handle,normalized_handle=excluded.normalized_handle").bind(userId, handle, handle.toLowerCase(), now),
    matchIndex(DB, userId, taxonomyId, topics, now),
  ]);
}

async function upsertScore(DB: D1Database, viewerUserId: string, candidateUserId: string, scoreId: string, total: number, components: readonly string[], taxonomyVersion: number, now: number) {
  const [a, b] = canonicalPair(viewerUserId, candidateUserId);
  const componentObject = Object.fromEntries(components.map((key, index) => [key, Math.max(500, 5000 - index * 500)]));
  const decisions = components.map((component) => ({ component, allEvidenceVisible: true, viewerUserIds: [viewerUserId, candidateUserId] }));
  await DB.prepare("INSERT INTO pair_scores(id,user_a_id,user_b_id,index_version_a,index_version_b,taxonomy_version,weight_version,components_json,evidence_ids_json,audience_decisions_json,total_basis_points,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET components_json=excluded.components_json,audience_decisions_json=excluded.audience_decisions_json,total_basis_points=excluded.total_basis_points,expires_at=excluded.expires_at")
    .bind(scoreId, a, b, 1, 1, taxonomyVersion, MATCH_WEIGHT_VERSION, JSON.stringify(componentObject), "[]", JSON.stringify(decisions), total, now + 14 * 86_400_000, now).run();
}

function matchIndex(DB: D1Database, userId: string, taxonomyId: string, topics: string, now: number) {
  return DB.prepare("INSERT INTO builder_match_index(user_id,version,taxonomy_version_id,topics_json,tools_json,domains_json,stages_json,intents_json,updated_at) VALUES(?,1,?,?,'[]','[]','[]','[]',?) ON CONFLICT(user_id) DO UPDATE SET version=1,taxonomy_version_id=excluded.taxonomy_version_id,topics_json=excluded.topics_json,updated_at=excluded.updated_at")
    .bind(userId, taxonomyId, topics, now);
}

function evaluation(DB: D1Database, id: string, proposalId: string, userId: string, now: number) {
  return DB.prepare("INSERT INTO codex_evaluations(id,proposal_id,user_id,decision,reason_summary,evidence_ids_json,index_version,created_at) VALUES(?,?,?,'approve',?,'[]',1,?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET decision='approve',reason_summary=excluded.reason_summary,index_version=1")
    .bind(id, proposalId, userId, "Their current work is mutually relevant.", now);
}

function connectionSide(DB: D1Database, connectionId: string, userId: string, now: number) {
  return DB.prepare("INSERT INTO connection_sides(connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at) VALUES(?,?,0,1,?,?) ON CONFLICT(connection_id,user_id) DO UPDATE SET muted=0,renewed_relevance_enabled=1,updated_at=excluded.updated_at")
    .bind(connectionId, userId, now, now);
}

function roomMembership(DB: D1Database, roomId: string, userId: string, now: number) {
  return DB.prepare("INSERT INTO room_memberships(room_id,user_id,joined_at,left_at) VALUES(?,?,?,NULL) ON CONFLICT(room_id,user_id) DO UPDATE SET left_at=NULL")
    .bind(roomId, userId, now);
}

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
