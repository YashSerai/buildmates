import {MATCH_WEIGHT_VERSION} from "@buildmates/matching";
import {AUTOMATION_CAPABILITY_TTL_MS} from "@buildmates/domain";
import {DESIGN_POLICY_ACTIVATED_AT,DESIGN_POLICY_ID,DESIGN_POLICY_SOURCE,DESIGN_POLICY_SOURCE_HASH,DESIGN_POLICY_VERSION} from "@buildmates/surfaces";
import {initialRoomSurfaceSpec} from "../rooms/initial-surface";

type D1 = D1Database;
type AcceptanceMode = "manual" | "full_autopilot";
type Capability = "available" | "approval_required" | "automation_unavailable";

export async function serverTimestamp():Promise<number>{return Date.now()}

export type CandidateRow = {
  userId: string; displayName: string; summary: string; indexVersion: number; taxonomyVersion: number;
  visibleReasons: string[]; visibleEvidenceIds: string[];
};
export type MatchInboxRow = { proposalId:string; candidateUserId:string; candidateName:string; candidateSummary:string; state:string; expiresAt:number; myEvaluation:string|null; theirEvaluation:string|null; myResponse:string|null; myAcceptanceMode:AcceptanceMode; canAutopilot:boolean };

export async function listMatchInbox(DB:D1,viewerId:string,now:number):Promise<MatchInboxRow[]>{
  const capability=await automationCapability(DB,viewerId);
  const rows=await DB.prepare(`SELECT p.id AS proposalId,p.state,p.expires_at AS expiresAt,
    CASE WHEN mp.user_a_id=? THEN mp.user_b_id ELSE mp.user_a_id END AS candidateUserId,
    other.display_name AS candidateName,other.summary AS candidateSummary,
    mine.decision AS myEvaluation,theirs.decision AS theirEvaluation,response.response AS myResponse,
    me.acceptance_mode AS myAcceptanceMode
    FROM match_proposals p JOIN match_pairs mp ON mp.id=p.match_pair_id
    JOIN profiles me ON me.user_id=?
    JOIN profiles other ON other.user_id=CASE WHEN mp.user_a_id=? THEN mp.user_b_id ELSE mp.user_a_id END AND other.published_at IS NOT NULL
    LEFT JOIN codex_evaluations mine ON mine.proposal_id=p.id AND mine.user_id=?
    LEFT JOIN codex_evaluations theirs ON theirs.proposal_id=p.id AND theirs.user_id<>?
    LEFT JOIN human_responses response ON response.proposal_id=p.id AND response.user_id=?
    WHERE (mp.user_a_id=? OR mp.user_b_id=?) AND (p.state='pending' OR p.terminal_at>?)
      AND NOT EXISTS (SELECT 1 FROM blocks block WHERE block.revoked_at IS NULL AND ((block.blocker_user_id=? AND block.blocked_user_id=other.user_id) OR (block.blocker_user_id=other.user_id AND block.blocked_user_id=?)))
      AND (p.state<>'pending' OR (p.expires_at>? AND other.allow_matching=1 AND p.evidence_version_a=(SELECT version FROM builder_match_index WHERE user_id=mp.user_a_id) AND p.evidence_version_b=(SELECT version FROM builder_match_index WHERE user_id=mp.user_b_id)))
    ORDER BY CASE p.state WHEN 'matched' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,p.created_at DESC LIMIT 50`)
    .bind(viewerId,viewerId,viewerId,viewerId,viewerId,viewerId,viewerId,viewerId,now-30*86_400_000,viewerId,viewerId,now)
    .all<Omit<MatchInboxRow,"canAutopilot">>();
  return rows.results.map((row)=>({...row,canAutopilot:row.myAcceptanceMode==="full_autopilot"&&capability==="available"}));
}

export async function listCandidateRows(DB: D1, viewerId: string, now: number, limit = 30): Promise<CandidateRow[]> {
  const boundedLimit = Math.max(1, Math.min(30, limit));
  if (await isQuietHours(DB,viewerId,now)) return [];
  const paused = await DB.prepare("SELECT 1 AS blocked FROM matching_snoozes WHERE user_id=? AND starts_at<=? AND ends_at>? LIMIT 1").bind(viewerId, now, now).first();
  if (paused) return [];
  const rows = await DB.prepare(`
    SELECT CASE WHEN ps.user_a_id=? THEN ps.user_b_id ELSE ps.user_a_id END AS userId,
      p.display_name AS displayName,p.summary,b.version AS indexVersion,ps.taxonomy_version AS taxonomyVersion,
      ps.total_basis_points AS scoreBasisPoints,ps.components_json AS componentsJson,ps.evidence_ids_json AS evidenceIdsJson,
      ps.audience_decisions_json AS audienceDecisionsJson
    FROM pair_scores ps
    JOIN builder_match_index self ON self.user_id=?
    JOIN taxonomy_versions self_taxonomy ON self_taxonomy.id=self.taxonomy_version_id AND self_taxonomy.status='active'
    JOIN builder_match_index b ON b.user_id=CASE WHEN ps.user_a_id=? THEN ps.user_b_id ELSE ps.user_a_id END
    JOIN taxonomy_versions candidate_taxonomy ON candidate_taxonomy.id=b.taxonomy_version_id
    JOIN profiles p ON p.user_id=b.user_id AND p.allow_matching=1 AND p.published_at IS NOT NULL AND p.audience IN ('public','signed_in','suggested_connections')
    WHERE (ps.user_a_id=? OR ps.user_b_id=?) AND ps.expires_at>?
      AND ps.taxonomy_version=self_taxonomy.version AND ps.weight_version=?
      AND ps.taxonomy_version=candidate_taxonomy.version
      AND ((ps.user_a_id=? AND ps.index_version_a=self.version AND ps.index_version_b=b.version)
        OR (ps.user_b_id=? AND ps.index_version_b=self.version AND ps.index_version_a=b.version))
      AND NOT EXISTS (SELECT 1 FROM blocks x WHERE x.revoked_at IS NULL AND ((x.blocker_user_id=? AND x.blocked_user_id=b.user_id) OR (x.blocker_user_id=b.user_id AND x.blocked_user_id=?)))
      AND NOT EXISTS (SELECT 1 FROM matching_exclusions x WHERE x.user_id=? AND x.kind='user' AND x.normalized_value=b.user_id)
      AND (p.cohort_scope_id IS NULL OR EXISTS (SELECT 1 FROM cohort_memberships membership WHERE membership.cohort_id=p.cohort_scope_id AND membership.user_id=? AND membership.status='active'))
      AND NOT EXISTS (SELECT 1 FROM connections c JOIN match_pairs mp ON mp.id=c.match_pair_id WHERE c.state='active' AND ((mp.user_a_id=? AND mp.user_b_id=b.user_id) OR (mp.user_b_id=? AND mp.user_a_id=b.user_id)))
    ORDER BY ps.total_basis_points DESC,b.user_id ASC LIMIT ?`)
    .bind(viewerId, viewerId, viewerId, viewerId, viewerId, now, MATCH_WEIGHT_VERSION, viewerId, viewerId, viewerId, viewerId, viewerId, viewerId, viewerId,viewerId, boundedLimit)
    .all<{ userId: string; displayName: string; summary: string; indexVersion: number; taxonomyVersion: number; scoreBasisPoints: number; componentsJson: string; evidenceIdsJson: string; audienceDecisionsJson: string }>();
  const projected = rows.results.map((row) => ({
    userId: row.userId, displayName: row.displayName, summary: row.summary, indexVersion: row.indexVersion,
    taxonomyVersion: row.taxonomyVersion, visibleReasons: authorizedComponents(row.componentsJson,row.audienceDecisionsJson,viewerId),
    visibleEvidenceIds: authorizedEvidence(row.evidenceIdsJson, row.audienceDecisionsJson, viewerId),
  }));
  const allowed=await Promise.all(projected.map(async(row)=>({row,allowed:!(await violatesClusterDiversity(DB,viewerId,row.userId,now))})));
  return allowed.filter(({allowed})=>allowed).map(({row})=>row);
}

export async function saveCandidateBatch(DB: D1, viewerId: string, candidates: readonly CandidateRow[], now: number) {
  const self = await DB.prepare("SELECT b.version,t.version AS taxonomyVersion FROM builder_match_index b JOIN taxonomy_versions t ON t.id=b.taxonomy_version_id WHERE b.user_id=?").bind(viewerId).first<{ version: number; taxonomyVersion: number }>();
  if (!self) return null;
  const id = crypto.randomUUID();
  await DB.prepare("INSERT INTO candidate_batches (id,user_id,index_version,taxonomy_version,candidate_ids_json,expires_at,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(id, viewerId, self.version, self.taxonomyVersion, JSON.stringify(candidates.map((candidate) => candidate.userId)), now + 30 * 60_000, now).run();
  return id;
}

export async function evaluateCandidate(DB: D1, input: { actorId: string; evaluationId?: string; batchId:string; candidateUserId: string; decision: "approve" | "decline" | "defer"; reasonSummary: string; indexVersion: number; evidenceIds: string[]; now: number }) {
  if (input.actorId === input.candidateUserId) throw new Error("candidate_invalid");
  const [userAId, userBId] = [input.actorId, input.candidateUserId].sort();
  const batch=await DB.prepare("SELECT 1 AS ok FROM candidate_batches cb JOIN builder_match_index self ON self.user_id=cb.user_id JOIN taxonomy_versions taxonomy ON taxonomy.id=self.taxonomy_version_id AND taxonomy.status='active' WHERE cb.id=? AND cb.user_id=? AND cb.expires_at>? AND cb.index_version=self.version AND cb.taxonomy_version=taxonomy.version AND EXISTS (SELECT 1 FROM json_each(cb.candidate_ids_json) WHERE value=?) LIMIT 1").bind(input.batchId,input.actorId,input.now,input.candidateUserId).first();
  if(!batch)throw new Error("candidate_batch_invalid");
  const paused=await DB.prepare("SELECT 1 AS blocked FROM matching_snoozes WHERE user_id=? AND starts_at<=? AND ends_at>? LIMIT 1").bind(input.actorId,input.now,input.now).first();
  const blocked=await DB.prepare("SELECT 1 AS blocked FROM blocks WHERE revoked_at IS NULL AND ((blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)) LIMIT 1").bind(input.actorId,input.candidateUserId,input.candidateUserId,input.actorId).first();
  const excluded=await DB.prepare("SELECT 1 AS excluded FROM matching_exclusions WHERE user_id=? AND kind='user' AND normalized_value=? LIMIT 1").bind(input.actorId,input.candidateUserId).first();
  if(paused||blocked||excluded||await isQuietHours(DB,input.actorId,input.now)||await violatesClusterDiversity(DB,input.actorId,input.candidateUserId,input.now))throw new Error("candidate_unavailable");
  const window=Math.floor(input.now/600_000),rateKey=`candidate-evaluation:${input.actorId}:${window}`;await DB.prepare("INSERT INTO mcp_rate_limits (key,attempt_count,window_expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempt_count=attempt_count+1").bind(rateKey,(window+1)*600_000).run();const rate=await DB.prepare("SELECT attempt_count AS attempts FROM mcp_rate_limits WHERE key=?").bind(rateKey).first<{attempts:number}>();if((rate?.attempts??999)>30)throw new Error("candidate_rate_limited");
  const score = await DB.prepare(`SELECT ps.index_version_a AS indexVersionA,ps.index_version_b AS indexVersionB,ps.taxonomy_version AS taxonomyVersion,ps.weight_version AS weightVersion,ps.expires_at AS expiresAt,ps.evidence_ids_json AS evidenceIdsJson,ps.audience_decisions_json AS audienceDecisionsJson
    FROM pair_scores ps JOIN builder_match_index a ON a.user_id=ps.user_a_id JOIN builder_match_index b ON b.user_id=ps.user_b_id JOIN taxonomy_versions taxonomy ON taxonomy.id=a.taxonomy_version_id AND taxonomy.id=b.taxonomy_version_id AND taxonomy.status='active'
    WHERE ps.user_a_id=? AND ps.user_b_id=? AND ps.index_version_a=a.version AND ps.index_version_b=b.version AND ps.taxonomy_version=taxonomy.version AND ps.weight_version=? AND ps.expires_at>? ORDER BY ps.total_basis_points DESC LIMIT 1`)
    .bind(userAId, userBId,MATCH_WEIGHT_VERSION,input.now).first<{ indexVersionA: number; indexVersionB: number; taxonomyVersion:number;weightVersion:number;expiresAt: number; evidenceIdsJson: string; audienceDecisionsJson: string }>();
  if (!score || input.indexVersion !== (input.actorId === userAId ? score.indexVersionA : score.indexVersionB)) throw new Error("candidate_stale");
  const profiles = await DB.prepare("SELECT user_id AS userId,acceptance_mode AS acceptanceMode FROM profiles WHERE user_id IN (?,?) AND allow_matching=1 AND published_at IS NOT NULL")
    .bind(userAId, userBId).all<{ userId: string; acceptanceMode: AcceptanceMode }>();
  if (profiles.results.length !== 2) throw new Error("candidate_unavailable");
  const pairId = await stableId("pair", `${userAId}\0${userBId}`);
  await DB.prepare("INSERT INTO match_pairs (id,user_a_id,user_b_id,created_at) VALUES (?,?,?,?) ON CONFLICT(user_a_id,user_b_id) DO NOTHING").bind(pairId, userAId, userBId, input.now).run();
  const storedPair = await DB.prepare("SELECT id FROM match_pairs WHERE user_a_id=? AND user_b_id=?").bind(userAId, userBId).first<{ id: string }>();
  if (!storedPair) throw new Error("pair_unavailable");
  let proposal = await DB.prepare("SELECT id FROM match_proposals WHERE match_pair_id=? AND state='pending' AND expires_at>? ORDER BY attempt_number DESC LIMIT 1").bind(storedPair.id, input.now).first<{ id: string }>();
  if (!proposal) {
    const attempt = await DB.prepare("SELECT COALESCE(MAX(attempt_number),0)+1 AS attempt FROM match_proposals WHERE match_pair_id=?").bind(storedPair.id).first<{ attempt: number }>();
    const proposalId = crypto.randomUUID(); const mode = new Map(profiles.results.map((row) => [row.userId, row.acceptanceMode]));
    try {
      await DB.prepare("INSERT INTO match_proposals (id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,taxonomy_version,weight_version,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)")
        .bind(proposalId, storedPair.id, attempt?.attempt ?? 1, score.indexVersionA, score.indexVersionB,score.taxonomyVersion,score.weightVersion, mode.get(userAId) ?? "manual", mode.get(userBId) ?? "manual", "{}", "{}", Math.min(score.expiresAt, input.now + 7 * 86_400_000), input.now).run();
      proposal = { id: proposalId };
    } catch {
      proposal = await DB.prepare("SELECT id FROM match_proposals WHERE match_pair_id=? AND state='pending' AND expires_at>? ORDER BY attempt_number DESC LIMIT 1").bind(storedPair.id, input.now).first<{ id: string }>();
      if (!proposal) throw new Error("proposal_conflict");
    }
  }
  const isMember = await DB.prepare("SELECT 1 AS ok FROM match_proposals p JOIN match_pairs mp ON mp.id=p.match_pair_id WHERE p.id=? AND p.state='pending' AND (mp.user_a_id=? OR mp.user_b_id=?)").bind(proposal.id, input.actorId, input.actorId).first();
  if (!isMember) throw new Error("proposal_forbidden");
  const allowedEvidence = new Set(authorizedEvidence(score.evidenceIdsJson, score.audienceDecisionsJson, input.actorId));
  await DB.prepare("INSERT INTO codex_evaluations (id,proposal_id,user_id,decision,reason_summary,evidence_ids_json,index_version,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET decision=excluded.decision,reason_summary=excluded.reason_summary,evidence_ids_json=excluded.evidence_ids_json,index_version=excluded.index_version,created_at=excluded.created_at")
    .bind(input.evaluationId ?? crypto.randomUUID(), proposal.id, input.actorId, input.decision, input.reasonSummary, JSON.stringify([...new Set(input.evidenceIds)].filter((id) => allowedEvidence.has(id)).slice(0, 50)), input.indexVersion, input.now).run();
  const evaluation = await DB.prepare("SELECT id FROM codex_evaluations WHERE proposal_id=? AND user_id=? LIMIT 1").bind(proposal.id, input.actorId).first<{ id: string }>();
  if (!evaluation) throw new Error("evaluation_unavailable");
  if (input.decision === "decline") await DB.prepare("UPDATE match_proposals SET state='declined',terminal_at=? WHERE id=? AND state='pending'").bind(input.now, proposal.id).run();
  const opening = input.decision === "approve" ? await tryOpenProposal(DB, proposal.id, input.now) : null;
  return { evaluationId: evaluation.id, proposalId: proposal.id, state: opening?.state ?? (input.decision === "decline" ? "declined" : "pending"), connectionId: opening?.connectionId ?? null, roomId: opening?.roomId ?? null };
}

export async function respondToProposal(DB: D1, input: { actorId: string; responseId?: string; proposalId: string; response: "interested" | "decline" | "undo"; now: number }) {
  const membership = await DB.prepare("SELECT 1 AS ok FROM match_proposals p JOIN match_pairs mp ON mp.id=p.match_pair_id WHERE p.id=? AND p.state='pending' AND p.expires_at>? AND (mp.user_a_id=? OR mp.user_b_id=?)")
    .bind(input.proposalId, input.now, input.actorId, input.actorId).first();
  if (!membership) throw new Error("proposal_unavailable");
  if (input.response === "undo") await DB.prepare("DELETE FROM human_responses WHERE proposal_id=? AND user_id=?").bind(input.proposalId, input.actorId).run();
  else await DB.prepare("INSERT INTO human_responses (id,proposal_id,user_id,response,created_at) VALUES (?,?,?,?,?) ON CONFLICT(proposal_id,user_id) DO UPDATE SET response=excluded.response,created_at=excluded.created_at")
    .bind(input.responseId ?? crypto.randomUUID(), input.proposalId, input.actorId, input.response, input.now).run();
  if (input.response === "decline") await DB.prepare("UPDATE match_proposals SET state='declined',terminal_at=? WHERE id=? AND state='pending'").bind(input.now, input.proposalId).run();
  const opening = input.response === "interested" ? await tryOpenProposal(DB, input.proposalId, input.now) : null;
  const response = input.response === "undo" ? null : await DB.prepare("SELECT id FROM human_responses WHERE proposal_id=? AND user_id=? LIMIT 1").bind(input.proposalId, input.actorId).first<{ id: string }>();
  return { responseId: response?.id ?? input.responseId ?? "", ...(opening ?? { state: input.response === "decline" ? "declined" : "pending", connectionId: null, roomId: null }) };
}

export async function tryOpenProposal(DB: D1, proposalId: string, now: number) {
  const row = await DB.prepare("SELECT p.match_pair_id AS pairId,mp.user_a_id AS userA,mp.user_b_id AS userB FROM match_proposals p JOIN match_pairs mp ON mp.id=p.match_pair_id WHERE p.id=? LIMIT 1").bind(proposalId).first<{pairId:string;userA:string;userB:string}>();
  if (!row) return null;
  if(await isQuietHours(DB,row.userA,now)||await isQuietHours(DB,row.userB,now)||await violatesClusterDiversity(DB,row.userA,row.userB,now)||await violatesClusterDiversity(DB,row.userB,row.userA,now))return null;
  const matchId=await stableId("match",proposalId),connectionId=await stableId("connection",proposalId),roomId=await stableId("room",proposalId);
  const presentation=await connectionPresentation(DB,{proposalId,userA:row.userA,userB:row.userB});
  const surfaceId=await stableId("surface-room",roomId),revisionId=await stableId("revision-room-initial",roomId);
  const existing=await DB.prepare("SELECT c.id AS connectionId,r.id AS roomId FROM connections c JOIN rooms r ON r.connection_id=c.id WHERE c.match_pair_id=? LIMIT 1").bind(row.pairId).first<{connectionId:string;roomId:string}>();
  if(existing) return {state:"matched" as const,...existing};
  try {
    await DB.batch([
      DB.prepare(`UPDATE match_proposals SET state='matched',terminal_at=? WHERE id=? AND state='pending' AND expires_at>? AND weight_version=? AND EXISTS (
        SELECT 1 FROM match_pairs pair
        JOIN builder_match_index ia ON ia.user_id=pair.user_a_id JOIN builder_match_index ib ON ib.user_id=pair.user_b_id
        JOIN taxonomy_versions taxonomy ON taxonomy.id=ia.taxonomy_version_id AND taxonomy.id=ib.taxonomy_version_id AND taxonomy.status='active'
        JOIN profiles pa ON pa.user_id=pair.user_a_id AND pa.allow_matching=1 AND pa.published_at IS NOT NULL
        JOIN profiles pb ON pb.user_id=pair.user_b_id AND pb.allow_matching=1 AND pb.published_at IS NOT NULL
        JOIN users ua ON ua.id=pair.user_a_id AND ua.status='active' JOIN users ub ON ub.id=pair.user_b_id AND ub.status='active'
        WHERE pair.id=match_proposals.match_pair_id AND ia.version=match_proposals.evidence_version_a AND ib.version=match_proposals.evidence_version_b
          AND taxonomy.version=match_proposals.taxonomy_version
          AND EXISTS (SELECT 1 FROM pair_scores score WHERE score.user_a_id=pair.user_a_id AND score.user_b_id=pair.user_b_id AND score.index_version_a=ia.version AND score.index_version_b=ib.version AND score.taxonomy_version=taxonomy.version AND score.weight_version=match_proposals.weight_version AND score.expires_at>?)
          AND EXISTS (SELECT 1 FROM codex_evaluations evaluation WHERE evaluation.proposal_id=match_proposals.id AND evaluation.user_id=pair.user_a_id AND evaluation.decision='approve' AND evaluation.index_version=ia.version)
          AND EXISTS (SELECT 1 FROM codex_evaluations evaluation WHERE evaluation.proposal_id=match_proposals.id AND evaluation.user_id=pair.user_b_id AND evaluation.decision='approve' AND evaluation.index_version=ib.version)
          AND (EXISTS (SELECT 1 FROM human_responses response WHERE response.proposal_id=match_proposals.id AND response.user_id=pair.user_a_id AND response.response='interested') OR (pa.acceptance_mode='full_autopilot' AND EXISTS (SELECT 1 FROM automation_checkpoints checkpoint WHERE checkpoint.user_id=pair.user_a_id AND checkpoint.kind='buildmates' AND json_extract(checkpoint.state_json,'$.capability')='available' AND json_extract(checkpoint.state_json,'$.proofSource')='mcp_delegated_probe' AND json_extract(checkpoint.state_json,'$.checkedAt') BETWEEN ? AND ?)))
          AND (EXISTS (SELECT 1 FROM human_responses response WHERE response.proposal_id=match_proposals.id AND response.user_id=pair.user_b_id AND response.response='interested') OR (pb.acceptance_mode='full_autopilot' AND EXISTS (SELECT 1 FROM automation_checkpoints checkpoint WHERE checkpoint.user_id=pair.user_b_id AND checkpoint.kind='buildmates' AND json_extract(checkpoint.state_json,'$.capability')='available' AND json_extract(checkpoint.state_json,'$.proofSource')='mcp_delegated_probe' AND json_extract(checkpoint.state_json,'$.checkedAt') BETWEEN ? AND ?)))
          AND NOT EXISTS (SELECT 1 FROM blocks block WHERE block.revoked_at IS NULL AND ((block.blocker_user_id=pair.user_a_id AND block.blocked_user_id=pair.user_b_id) OR (block.blocker_user_id=pair.user_b_id AND block.blocked_user_id=pair.user_a_id)))
          AND NOT EXISTS (SELECT 1 FROM matching_snoozes snooze WHERE snooze.user_id IN (pair.user_a_id,pair.user_b_id) AND snooze.starts_at<=? AND snooze.ends_at>?)
          AND NOT EXISTS (SELECT 1 FROM matching_exclusions exclusion WHERE exclusion.kind='user' AND ((exclusion.user_id=pair.user_a_id AND exclusion.normalized_value=pair.user_b_id) OR (exclusion.user_id=pair.user_b_id AND exclusion.normalized_value=pair.user_a_id)))
          AND NOT EXISTS (SELECT 1 FROM introduction_budgets budget WHERE budget.user_id IN (pair.user_a_id,pair.user_b_id) AND budget.used_this_week>=budget.maximum_per_week)
      )`).bind(now,proposalId,now,MATCH_WEIGHT_VERSION,now,new Date(now-AUTOMATION_CAPABILITY_TTL_MS).toISOString(),new Date(now+5*60_000).toISOString(),new Date(now-AUTOMATION_CAPABILITY_TTL_MS).toISOString(),new Date(now+5*60_000).toISOString(),now,now),
      DB.prepare("INSERT INTO matches (id,match_pair_id,proposal_id,matched_at) SELECT ?,match_pair_id,id,? FROM match_proposals WHERE id=? AND state='matched' AND terminal_at=?").bind(matchId,now,proposalId,now),
      DB.prepare("INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) VALUES (?,?,?,'active',?,?)").bind(connectionId,row.pairId,matchId,now,now),
      DB.prepare("INSERT INTO connection_sides (connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at) VALUES (?,?,0,1,?,?)").bind(connectionId,row.userA,now,now),
      DB.prepare("INSERT INTO connection_sides (connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at) VALUES (?,?,0,1,?,?)").bind(connectionId,row.userB,now,now),
      DB.prepare("INSERT INTO connection_snapshots (connection_id,subject_user_id,display_name,summary,captured_at) SELECT ?,user_id,display_name,summary,? FROM profiles WHERE user_id=?").bind(connectionId,now,row.userA),
      DB.prepare("INSERT INTO connection_snapshots (connection_id,subject_user_id,display_name,summary,captured_at) SELECT ?,user_id,display_name,summary,? FROM profiles WHERE user_id=?").bind(connectionId,now,row.userB),
      DB.prepare("INSERT INTO connection_context_snapshots (connection_id,reason,shared_context_json,theme_topic_id,captured_at) VALUES (?,?,?,?,?)").bind(connectionId,presentation.reason,JSON.stringify(presentation.sharedContext),presentation.themeTopicId,now),
      DB.prepare("INSERT INTO rooms (id,match_pair_id,connection_id,status,theme_topic_id,created_at,updated_at) VALUES (?,?,?,'active',?,?,?)").bind(roomId,row.pairId,connectionId,presentation.themeTopicId,now,now),
      DB.prepare("INSERT INTO room_memberships (room_id,user_id,joined_at) VALUES (?,?,?)").bind(roomId,row.userA,now),
      DB.prepare("INSERT INTO room_memberships (room_id,user_id,joined_at) VALUES (?,?,?)").bind(roomId,row.userB,now),
      DB.prepare("INSERT INTO surfaces (id,owner_user_id,kind,subject_id,published_revision_id,governance_version,created_at,updated_at) VALUES (?,?,'room',?,?,1,?,?)").bind(surfaceId,row.userA,roomId,revisionId,now,now),
      DB.prepare("INSERT INTO surface_revisions (id,surface_id,revision_number,base_revision_number,author_user_id,design_policy_id,design_policy_version,visibility,spec_json,status,created_at) VALUES (?,?,1,NULL,?,?,?,'private_preview',?,'published',?)").bind(revisionId,surfaceId,row.userA,DESIGN_POLICY_ID,DESIGN_POLICY_VERSION,JSON.stringify(initialRoomSurfaceSpec()),now),
      DB.prepare("UPDATE introduction_budgets SET used_this_week=used_this_week+1 WHERE user_id IN (?,?) AND EXISTS (SELECT 1 FROM matches WHERE id=?)").bind(row.userA,row.userB,matchId),
      DB.prepare("INSERT INTO notifications (id,user_id,kind,delivery,payload_json,created_at) VALUES (?,?,'match_opened','immediate',?,?)").bind(crypto.randomUUID(),row.userA,JSON.stringify({connectionId,roomId}),now),
      DB.prepare("INSERT INTO notifications (id,user_id,kind,delivery,payload_json,created_at) VALUES (?,?,'match_opened','immediate',?,?)").bind(crypto.randomUUID(),row.userB,JSON.stringify({connectionId,roomId}),now),
      DB.prepare("INSERT INTO audit_events (id,actor_user_id,action,object_kind,object_id,metadata_json,idempotency_key,created_at) VALUES (?,NULL,'match.opened','connection',?,?,'match-open:'||?,?)").bind(crypto.randomUUID(),connectionId,JSON.stringify({proposalId,roomId}),proposalId,now),
    ]);
  } catch (error) {
    const raced=await DB.prepare("SELECT c.id AS connectionId,r.id AS roomId FROM connections c JOIN rooms r ON r.connection_id=c.id WHERE c.match_pair_id=? LIMIT 1").bind(row.pairId).first<{connectionId:string;roomId:string}>();
    if(raced) return {state:"matched" as const,...raced};
    const stillPending=await DB.prepare("SELECT 1 AS pending FROM match_proposals WHERE id=? AND state='pending'").bind(proposalId).first();
    if(stillPending)return null;
    throw error;
  }
  return {state:"matched" as const,connectionId,roomId};
}

const CONNECTION_REASON_LABELS:Record<string,string>={topicOverlap:"shared topics",topicAdjacency:"adjacent technical work",toolDomainFit:"compatible tools and domains",stageFit:"a similar building stage",intentFit:"aligned collaboration intent",offerNeedFit:"complementary experience",locationFit:"nearby work",timezoneFit:"workable time zones",cohortFit:"a shared cohort",serendipity:"a useful adjacent perspective"};
async function connectionPresentation(DB:D1,input:{proposalId:string;userA:string;userB:string}){
  const activatedAt=new Date(DESIGN_POLICY_ACTIVATED_AT).getTime();
  await DB.prepare("INSERT OR IGNORE INTO design_policies (id,version,source_hash,policy_json,activated_at,created_at) VALUES (?,?,?,?,?,?)").bind(DESIGN_POLICY_ID,DESIGN_POLICY_VERSION,DESIGN_POLICY_SOURCE_HASH,DESIGN_POLICY_SOURCE,activatedAt,activatedAt).run();
  const policy=await DB.prepare("SELECT 1 AS ok FROM design_policies WHERE id=? AND version=? AND source_hash=? AND policy_json=? AND activated_at IS NOT NULL LIMIT 1").bind(DESIGN_POLICY_ID,DESIGN_POLICY_VERSION,DESIGN_POLICY_SOURCE_HASH,DESIGN_POLICY_SOURCE).first();
  if(!policy)throw new Error("design_policy_missing");
  const score=await DB.prepare(`SELECT score.components_json AS componentsJson,score.audience_decisions_json AS decisionsJson
    FROM match_proposals proposal JOIN match_pairs pair ON pair.id=proposal.match_pair_id
    JOIN pair_scores score ON score.user_a_id=pair.user_a_id AND score.user_b_id=pair.user_b_id
      AND score.index_version_a=proposal.evidence_version_a AND score.index_version_b=proposal.evidence_version_b
      AND score.taxonomy_version=proposal.taxonomy_version AND score.weight_version=proposal.weight_version
    WHERE proposal.id=? ORDER BY score.total_basis_points DESC LIMIT 1`).bind(input.proposalId).first<{componentsJson:string;decisionsJson:string}>();
  const sharedCodes=score?authorizedComponents(score.componentsJson,score.decisionsJson,input.userA).filter((code)=>authorizedComponents(score.componentsJson,score.decisionsJson,input.userB).includes(code)):[];
  const topic=sharedCodes.some((code)=>code==="topicOverlap"||code==="topicAdjacency")?await DB.prepare(`SELECT topic.id,topic.label FROM builder_match_index a JOIN builder_match_index b
    JOIN json_each(a.topics_json) a_topic JOIN json_each(b.topics_json) b_topic ON b_topic.value=a_topic.value
    JOIN topics topic ON topic.id=a_topic.value WHERE a.user_id=? AND b.user_id=? ORDER BY topic.label LIMIT 1`).bind(input.userA,input.userB).first<{id:string;label:string}>():null;
  const labels=[...new Set(sharedCodes.map((code)=>CONNECTION_REASON_LABELS[code]).filter((label):label is string=>Boolean(label)))].slice(0,3);
  const sharedContext=[...(topic?[`Shared focus: ${topic.label}`]:[]),...labels.map((label)=>`Matched through ${label}`)].slice(0,4);
  return {themeTopicId:topic?.id??null,sharedContext,reason:topic?`Your current work overlaps around ${topic.label}.`:labels.length?`Buildmates found mutual relevance through ${labels.join(", ")}.`:"Buildmates found mutual relevance in your current work."};
}

async function automationCapability(DB:D1,userId:string):Promise<Capability>{
  const row=await DB.prepare("SELECT state_json AS stateJson FROM automation_checkpoints WHERE user_id=? AND kind='buildmates' LIMIT 1").bind(userId).first<{stateJson:string}>();
  const state=safeObject(row?.stateJson??"{}");const value=state.capability;
  if(value==="available"){const checkedAt=Date.parse(String(state.checkedAt??""));if(state.proofSource!=="mcp_delegated_probe"||!Number.isFinite(checkedAt)||checkedAt<Date.now()-AUTOMATION_CAPABILITY_TTL_MS||checkedAt>Date.now()+5*60_000)return "approval_required";}
  return value==="available"||value==="approval_required"||value==="automation_unavailable"?value:"approval_required";
}

async function isQuietHours(DB:D1,userId:string,now:number):Promise<boolean>{
  const rows=(await DB.prepare("SELECT timezone,weekday,start_minute AS startMinute,end_minute AS endMinute FROM quiet_hours WHERE user_id=? ORDER BY weekday,start_minute").bind(userId).all<{timezone:string;weekday:number;startMinute:number;endMinute:number}>()).results;
  if(!rows.length)return false;
  const timezone=rows[0].timezone;let parts:Record<string,string>={};
  try{parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:timezone,weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(now)).filter((part)=>part.type!=="literal").map((part)=>[part.type,part.value]));}catch{return true;}
  const weekdays:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};const weekday=weekdays[parts.weekday];const minute=Number(parts.hour)*60+Number(parts.minute);if(weekday===undefined||!Number.isFinite(minute))return true;
  return rows.some((row)=>row.timezone!==timezone||quietIntervalContains(row,weekday,minute));
}
function quietIntervalContains(row:{weekday:number;startMinute:number;endMinute:number},weekday:number,minute:number):boolean{
  if(row.startMinute===row.endMinute)return false;
  if(row.startMinute<row.endMinute)return row.weekday===weekday&&minute>=row.startMinute&&minute<row.endMinute;
  return (row.weekday===weekday&&minute>=row.startMinute)||((row.weekday+1)%7===weekday&&minute<row.endMinute);
}
async function violatesClusterDiversity(DB:D1,userId:string,candidateUserId:string,now:number):Promise<boolean>{
  const pulse=await DB.prepare("SELECT controls_json AS controlsJson FROM networking_pulses WHERE user_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(userId,now).first<{controlsJson:string}>();
  if(safeObject(pulse?.controlsJson??"{}").avoidRepeatedClusters!==true)return false;
  const candidate=await DB.prepare("SELECT json_extract(topics_json,'$[0]') AS cluster FROM builder_match_index WHERE user_id=?").bind(candidateUserId).first<{cluster:string|null}>();
  if(!candidate?.cluster)return false;
  const row=await DB.prepare(`SELECT COUNT(*) AS count FROM connections c JOIN match_pairs pair ON pair.id=c.match_pair_id JOIN builder_match_index other_index ON other_index.user_id=CASE WHEN pair.user_a_id=? THEN pair.user_b_id ELSE pair.user_a_id END WHERE c.state='active' AND c.created_at>? AND (pair.user_a_id=? OR pair.user_b_id=?) AND json_extract(other_index.topics_json,'$[0]')=?`).bind(userId,now-30*86_400_000,userId,userId,candidate.cluster).first<{count:number}>();
  return Number(row?.count??0)>=2;
}
function safeObject(value:string):Record<string,unknown>{try{const parsed:unknown=JSON.parse(value);return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{} }catch{return {}}}
function authorizedComponents(componentsJson:string,decisionsJson:string,viewerId:string):string[]{const components=safeObject(componentsJson);const decisions=safeArray(decisionsJson);return Object.keys(components).filter((component)=>decisions.some((decision)=>{if(!decision||typeof decision!=="object"||Array.isArray(decision))return false;const row=decision as Record<string,unknown>;return row.component===component&&row.allEvidenceVisible===true&&Array.isArray(row.viewerUserIds)&&row.viewerUserIds.includes(viewerId)})).slice(0,6)}
function authorizedEvidence(idsJson:string,decisionsJson:string,viewerId:string):string[]{const ids=safeArray(idsJson).filter((id):id is string=>typeof id==="string");const decisions=safeArray(decisionsJson);return ids.filter((id)=>decisions.some((decision)=>{if(!decision||typeof decision!=="object"||Array.isArray(decision))return false;const row=decision as Record<string,unknown>;return row.evidenceId===id&&Array.isArray(row.viewerUserIds)&&row.viewerUserIds.includes(viewerId)})).slice(0,50)}
function safeArray(value:string):unknown[]{try{const parsed:unknown=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return []}}
async function stableId(prefix:string,value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return `${prefix}_${Array.from(new Uint8Array(digest)).slice(0,16).map((b)=>b.toString(16).padStart(2,"0")).join("")}`}
