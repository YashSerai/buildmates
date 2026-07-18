import { MATCH_WEIGHT_VERSION } from "@buildmates/matching";

export type TwoPrincipalNetwork = {
  actorUserId: string;
  peerUserId: string;
  proposalId: string;
};

/**
 * Seeds only the matching state that normally precedes two independent human
 * Interested actions. Both users must already own active GitHub-backed web
 * principals; unattached fixture users are rejected.
 */
export async function seedTwoPrincipalNetwork(
  DB: D1Database,
  actorUserId: string,
  peerUserId: string,
  now = Date.now(),
): Promise<TwoPrincipalNetwork> {
  if (!peerUserId || actorUserId === peerUserId) throw new Error("peer_invalid");
  const identities = await DB.prepare(`SELECT DISTINCT link.user_id AS userId
    FROM identity_links link
    JOIN identity_principals principal ON principal.id=link.principal_id
      AND principal.channel='web' AND principal.issuer='github.com' AND principal.revoked_at IS NULL
    JOIN users user ON user.id=link.user_id AND user.status='active'
    WHERE link.user_id IN (?,?) AND link.provider_channel='web'
      AND link.provider_issuer='github.com' AND link.revoked_at IS NULL`)
    .bind(actorUserId, peerUserId).all<{ userId: string }>();
  if (new Set(identities.results.map((row) => row.userId)).size !== 2) {
    throw new Error("authenticated_principals_required");
  }

  const taxonomy = await DB.prepare(
    "SELECT id,version FROM taxonomy_versions WHERE status='active' ORDER BY version DESC LIMIT 1",
  ).first<{ id: string; version: number }>();
  if (!taxonomy) throw new Error("active_taxonomy_missing");

  const [userA, userB] = canonicalPair(actorUserId, peerUserId);
  const suffix = `${compact(userA)}_${compact(userB)}`;
  const pairId = `two_principal_pair_${suffix}`;
  const scoreId = `two_principal_score_${suffix}`;
  const proposalId = `two_principal_proposal_${suffix}`;
  const publishedAt = now - 86_400_000;

  await DB.batch([
    upsertProfile(DB, actorUserId, `two_principal_profile_actor_${suffix}`, "Avery Stone", `avery-${compact(actorUserId)}`, publishedAt, now),
    upsertProfile(DB, peerUserId, `two_principal_profile_peer_${suffix}`, "Blair Lin", `blair-${compact(peerUserId)}`, publishedAt, now),
    matchIndex(DB, actorUserId, taxonomy.id, now),
    matchIndex(DB, peerUserId, taxonomy.id, now),
    DB.prepare("INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at) VALUES(?,?,?,?) ON CONFLICT(user_a_id,user_b_id) DO NOTHING")
      .bind(pairId, userA, userB, now),
    DB.prepare(`INSERT INTO pair_scores(
      id,user_a_id,user_b_id,index_version_a,index_version_b,taxonomy_version,weight_version,
      components_json,evidence_ids_json,audience_decisions_json,total_basis_points,expires_at,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      index_version_a=1,index_version_b=1,taxonomy_version=excluded.taxonomy_version,
      weight_version=excluded.weight_version,components_json=excluded.components_json,
      evidence_ids_json='[]',audience_decisions_json=excluded.audience_decisions_json,
      total_basis_points=excluded.total_basis_points,expires_at=excluded.expires_at`)
      .bind(
        scoreId, userA, userB, 1, 1, taxonomy.version, MATCH_WEIGHT_VERSION,
        JSON.stringify({ topicOverlap: 4200, toolDomainFit: 2600, intentFit: 1800 }),
        "[]",
        JSON.stringify([
          { component: "topicOverlap", allEvidenceVisible: true, viewerUserIds: [userA, userB] },
          { component: "toolDomainFit", allEvidenceVisible: true, viewerUserIds: [userA, userB] },
          { component: "intentFit", allEvidenceVisible: true, viewerUserIds: [userA, userB] },
        ]),
        8600, now + 7 * 86_400_000, now,
      ),
  ]);

  const storedPair = await DB.prepare("SELECT id FROM match_pairs WHERE user_a_id=? AND user_b_id=?")
    .bind(userA, userB).first<{ id: string }>();
  if (!storedPair) throw new Error("pair_unavailable");

  await DB.batch([
    DB.prepare(`INSERT INTO match_proposals(
      id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,taxonomy_version,weight_version,
      acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,shared_explanation_json,
      state,expires_at,terminal_at,created_at
    ) VALUES(?,?,1,1,1,?,?,'manual','manual',?,?,?,'pending',?,NULL,?)
    ON CONFLICT(id) DO UPDATE SET state='pending',expires_at=excluded.expires_at,terminal_at=NULL`)
      .bind(
        proposalId, storedPair.id, taxonomy.version, MATCH_WEIGHT_VERSION,
        JSON.stringify({ reasons: ["Shared work on reliable AI collaboration"] }),
        JSON.stringify({ reasons: ["Shared work on reliable AI collaboration"] }),
        JSON.stringify({ reason: "You are both building reliable, human-readable AI collaboration workflows." }),
        now + 7 * 86_400_000, now,
      ),
    evaluation(DB, `${proposalId}:actor`, proposalId, actorUserId, now),
    evaluation(DB, `${proposalId}:peer`, proposalId, peerUserId, now),
  ]);

  return { actorUserId, peerUserId, proposalId };
}

function upsertProfile(
  DB: D1Database,
  userId: string,
  profileId: string,
  displayName: string,
  handle: string,
  publishedAt: number,
  now: number,
) {
  return DB.prepare(`INSERT INTO profiles(
    id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,
    allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at
  ) VALUES(?,?,?,?,?,'[]','suggested_connections',1,'manual',0,?,?,?)
  ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,summary=excluded.summary,
    project_or_interest=excluded.project_or_interest,audience='suggested_connections',allow_matching=1,
    acceptance_mode='manual',published_at=excluded.published_at,updated_at=excluded.updated_at`)
    .bind(
      profileId,
      userId,
      displayName,
      "Building reliable AI collaboration tools with privacy-aware product boundaries.",
      "Testing retrieval, agents, and useful builder-to-builder workflows.",
      publishedAt,
      publishedAt,
      now,
    );
}

function matchIndex(DB: D1Database, userId: string, taxonomyId: string, now: number) {
  return DB.prepare(`INSERT INTO builder_match_index(
    user_id,version,taxonomy_version_id,topics_json,tools_json,domains_json,stages_json,intents_json,updated_at
  ) VALUES(?,1,?,'["ai","mcp","retrieval"]','[]','[]','[]','[]',?)
  ON CONFLICT(user_id) DO UPDATE SET version=1,taxonomy_version_id=excluded.taxonomy_version_id,
    topics_json=excluded.topics_json,updated_at=excluded.updated_at`)
    .bind(userId, taxonomyId, now);
}

function evaluation(DB: D1Database, id: string, proposalId: string, userId: string, now: number) {
  return DB.prepare(`INSERT INTO codex_evaluations(
    id,proposal_id,user_id,decision,reason_summary,evidence_ids_json,index_version,created_at
  ) VALUES(?,?,?,'approve',?,'[]',1,?)
  ON CONFLICT(proposal_id,user_id) DO UPDATE SET decision='approve',
    reason_summary=excluded.reason_summary,evidence_ids_json='[]',index_version=1,created_at=excluded.created_at`)
    .bind(id, proposalId, userId, "Their current work is mutually relevant.", now);
}

function compact(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(-12) || "principal";
}

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
