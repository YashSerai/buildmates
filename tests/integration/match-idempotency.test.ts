import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateCandidate, listCandidateRows, respondToProposal } from "../../apps/web/src/matching/service";
import { getMcpCandidateShortlist, recordMcpCandidateEvaluation, recordMcpManualMatchResponse } from "../../apps/web/src/matching/mcp-adapter";
import {listConnections} from "../../apps/web/src/rooms/service";
import { listDiscovery } from "../../apps/web/src/discovery/service";
import { applyD1Migrations } from "../helpers/migrate-d1";

describe("D1 reciprocal matching", () => {
  let mf: Miniflare; let DB: D1Database; const now = Date.parse("2026-07-15T12:00:00Z");
  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    await applyD1Migrations(DB);
    await DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('alice','active','none',?,?),('bob','active','none',?,?)").bind(now,now,now,now).run();
    await DB.prepare("INSERT INTO taxonomy_versions (id,version,status,created_at,activated_at) VALUES ('taxonomy-v1',1,'active',?,?)").bind(now,now).run();
    await DB.prepare("INSERT INTO profiles (id,user_id,display_name,summary,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at) VALUES ('profile-a','alice','Alice','Retrieval evaluation','public',1,'manual',1,?,?,?),('profile-b','bob','Bob','Hybrid search','public',1,'full_autopilot',1,?,?,?)").bind(now,now,now,now,now,now).run();
    await DB.prepare("INSERT INTO builder_match_index (user_id,version,taxonomy_version_id,topics_json,updated_at) VALUES ('alice',2,'taxonomy-v1','[\"topic-rag\"]',?),('bob',4,'taxonomy-v1','[\"topic-rag\"]',?)").bind(now,now).run();
    await DB.prepare("INSERT INTO pair_scores (id,user_a_id,user_b_id,index_version_a,index_version_b,taxonomy_version,weight_version,components_json,evidence_ids_json,audience_decisions_json,total_basis_points,expires_at,created_at) VALUES ('score','alice','bob',2,4,1,1,'{\"topicOverlap\":2400}','[\"signal-b\"]','[{\"evidenceId\":\"signal-b\",\"viewerUserIds\":[\"alice\"]}]',8000,?,?)").bind(now+86_400_000,now).run();
    await DB.prepare("INSERT INTO candidate_batches (id,user_id,index_version,taxonomy_version,candidate_ids_json,expires_at,created_at) VALUES ('batch-a','alice',2,1,'[\"bob\"]',?,?),('batch-b','bob',4,1,'[\"alice\"]',?,?)").bind(now+60_000,now,now+60_000,now).run();
    await DB.prepare("INSERT INTO automation_checkpoints (id,user_id,kind,state_json,updated_at) VALUES ('auto-a','alice','buildmates','{\"capability\":\"available\",\"checkedAt\":\"2026-07-15T12:00:00.000Z\",\"proofSource\":\"verified_host_event\"}',?),('auto-b','bob','buildmates','{\"capability\":\"available\",\"checkedAt\":\"2026-07-15T12:00:00.000Z\",\"proofSource\":\"verified_host_event\"}',?)").bind(now,now).run();
  });
  afterEach(async()=>mf.dispose());

  it("returns only current viewer-authorized evidence", async () => {
    const result=await listCandidateRows(DB,"alice",now,30);
    expect(result).toEqual([expect.objectContaining({userId:"bob",visibleReasons:[],visibleEvidenceIds:["signal-b"]})]);
  });

  it("matches explicitly reviewed private profiles while keeping them out of anonymous discovery", async () => {
    await DB.batch([
      DB.prepare("UPDATE profiles SET audience='private',published_at=NULL,matching_reviewed_at=? WHERE user_id IN ('alice','bob')").bind(now),
      DB.prepare("INSERT INTO handles(user_id,handle,normalized_handle,created_at) VALUES ('alice','private-alice','private-alice',?),('bob','private-bob','private-bob',?)").bind(now,now),
    ]);

    const privateCandidates = await listCandidateRows(DB, "alice", now, 30);
    expect(privateCandidates).toEqual([expect.objectContaining({ userId: "bob", displayName: "Bob" })]);

    const anonymous = await listDiscovery(DB, null, { query: "" });
    expect(anonymous.builders).toEqual([]);
    expect(anonymous.projects).toEqual([]);
  });

  it("routes MCP shortlist, reciprocal evaluation, consent, and room opening through the canonical state machine", async () => {
    const aliceShortlist = await getMcpCandidateShortlist(DB, { userId: "alice", limit: 20, now: new Date(now).toISOString() });
    expect(aliceShortlist).toMatchObject({
      batchId: expect.any(String),
      expiresAt: new Date(now + 30 * 60_000).toISOString(),
      candidates: [{ userId: "bob", displayName: "Bob", summary: "Hybrid search", indexVersion: 4, visibleEvidenceIds: ["signal-b"], proposalId: null }],
    });
    const alice = await recordMcpCandidateEvaluation(DB, { userId: "alice", evaluationId: "mcp-evaluation-alice", batchId: aliceShortlist.batchId!, candidateUserId: "bob", decision: "approve", reasonSummary: "Relevant retrieval work", evidenceIds: ["signal-b"], indexVersion: 2, now: new Date(now).toISOString() });
    expect(alice).toMatchObject({ evaluationId: "mcp-evaluation-alice", proposalId: expect.any(String), state: "pending" });

    const bobShortlist = await getMcpCandidateShortlist(DB, { userId: "bob", limit: 20, now: new Date(now + 1).toISOString() });
    expect(bobShortlist.candidates[0]).toMatchObject({ userId: "alice", proposalId: alice.proposalId });
    await recordMcpCandidateEvaluation(DB, { userId: "bob", evaluationId: "mcp-evaluation-bob", batchId: bobShortlist.batchId!, candidateUserId: "alice", decision: "approve", reasonSummary: "Useful evaluation overlap", evidenceIds: [], indexVersion: 4, now: new Date(now + 1).toISOString() });
    const opened = await recordMcpManualMatchResponse(DB, { userId: "alice", responseId: "mcp-response-alice", proposalId: alice.proposalId, response: "interested", now: new Date(now + 2).toISOString() });
    expect(opened).toMatchObject({ responseId: "mcp-response-alice", state: "matched", connectionId: expect.any(String), roomId: expect.any(String) });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM notifications").first()).toEqual({ count: 2 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM rooms").first()).toEqual({ count: 1 });
  });

  it("rate limits shortlist refreshes per actor", async () => {
    const windowMs = 10 * 60_000;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    await DB.prepare("INSERT INTO mcp_rate_limits (key,attempt_count,window_expires_at) VALUES (?,?,?)")
      .bind(`web:candidate_shortlist:alice:${windowStart}`, 12, windowStart + windowMs).run();
    await expect(getMcpCandidateShortlist(DB, { userId: "alice", limit: 20, now: new Date(now).toISOString() }))
      .rejects.toThrow("candidate_rate_limited");
  });

  it("does not treat a legacy foreground probe as proof for automatic acceptance", async () => {
    await DB.prepare("UPDATE profiles SET acceptance_mode='full_autopilot' WHERE user_id='alice'").run();
    await DB.prepare("UPDATE automation_checkpoints SET state_json=replace(state_json,'verified_host_event','mcp_delegated_probe')").run();
    const first = await evaluateCandidate(DB, { actorId: "alice", batchId: "batch-a", candidateUserId: "bob", decision: "approve", reasonSummary: "Current overlap", indexVersion: 2, evidenceIds: [], now });
    await evaluateCandidate(DB, { actorId: "bob", batchId: "batch-b", candidateUserId: "alice", decision: "approve", reasonSummary: "Current overlap", indexVersion: 4, evidenceIds: [], now: now + 1 });
    expect((await respondToProposal(DB, { actorId: "alice", proposalId: first.proposalId, response: "interested", now: now + 2 })).state).toBe("pending");
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM rooms").first()).toEqual({ count: 0 });
  });

  it("opens one room after reciprocal Full Autopilot approval with independently verified host proof", async () => {
    await DB.prepare("UPDATE profiles SET acceptance_mode='full_autopilot' WHERE user_id='alice'").run();
    const alice = await evaluateCandidate(DB, { actorId: "alice", batchId: "batch-a", candidateUserId: "bob", decision: "approve", reasonSummary: "Relevant retrieval work", indexVersion: 2, evidenceIds: ["signal-b"], now });
    expect(alice).toMatchObject({ state: "pending", connectionId: null, roomId: null });
    const bob = await evaluateCandidate(DB, { actorId: "bob", batchId: "batch-b", candidateUserId: "alice", decision: "approve", reasonSummary: "Useful evaluation overlap", indexVersion: 4, evidenceIds: [], now: now + 1 });
    expect(bob).toMatchObject({ state: "matched", connectionId: expect.any(String), roomId: expect.any(String) });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM human_responses").first()).toEqual({ count: 0 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM connections").first()).toEqual({ count: 1 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM rooms").first()).toEqual({ count: 1 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM room_memberships").first()).toEqual({ count: 2 });
  });

  it("enforces quiet hours and repeated-cluster diversity before returning candidates",async()=>{
    await DB.prepare("INSERT INTO quiet_hours(id,user_id,timezone,weekday,start_minute,end_minute) VALUES('quiet-alice','alice','UTC',3,660,780)").run();
    expect(await listCandidateRows(DB,"alice",now,30)).toEqual([]);
    await DB.prepare("DELETE FROM quiet_hours WHERE id='quiet-alice'").run();
    await DB.prepare("INSERT INTO networking_pulses(id,user_id,intent_summary,controls_json,starts_at,expires_at,created_at) VALUES('pulse-alice','alice','Meet relevant builders','{\"avoidRepeatedClusters\":true}',?,?,?)").bind(now-1,now+86_400_000,now-1).run();
    for(const suffix of ['c','d']){
      const user=`user-${suffix}`,pair=`pair-${suffix}`,proposal=`proposal-${suffix}`,match=`match-${suffix}`,connection=`connection-${suffix}`;
      await DB.batch([
        DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES(?,'active','none',?,?)").bind(user,now,now),
        DB.prepare("INSERT INTO builder_match_index(user_id,version,taxonomy_version_id,topics_json,updated_at) VALUES(?,1,'taxonomy-v1','[\"topic-rag\"]',?)").bind(user,now),
        DB.prepare("INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at) VALUES(?,'alice',?,?)").bind(pair,user,now),
        DB.prepare("INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES(?,?,1,2,1,'manual','manual','{}','{}','matched',?,?)").bind(proposal,pair,now+86_400_000,now),
        DB.prepare("INSERT INTO matches(id,match_pair_id,proposal_id,matched_at) VALUES(?,?,?,?)").bind(match,pair,proposal,now),
        DB.prepare("INSERT INTO connections(id,match_pair_id,match_id,state,created_at,updated_at) VALUES(?,?,?,'active',?,?)").bind(connection,pair,match,now,now),
      ]);
    }
    expect(await listCandidateRows(DB,"alice",now,30)).toEqual([]);
  });

  it("does not use an expired automation proof to auto-open a room",async()=>{
    await DB.prepare("UPDATE profiles SET acceptance_mode='full_autopilot' WHERE user_id='alice'").run();
    await DB.prepare("UPDATE automation_checkpoints SET state_json='{\"capability\":\"available\",\"checkedAt\":\"2026-07-01T12:00:00.000Z\",\"proofSource\":\"verified_host_event\"}' WHERE user_id='bob'").run();
    const first=await evaluateCandidate(DB,{actorId:"alice",batchId:"batch-a",candidateUserId:"bob",decision:"approve",reasonSummary:"Current overlap",indexVersion:2,evidenceIds:[],now});
    await evaluateCandidate(DB,{actorId:"bob",batchId:"batch-b",candidateUserId:"alice",decision:"approve",reasonSummary:"Current overlap",indexVersion:4,evidenceIds:[],now:now+1});
    expect((await respondToProposal(DB,{actorId:"alice",proposalId:first.proposalId,response:"interested",now:now+2})).state).toBe("pending");
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM rooms").first()).toEqual({count:0});
  });

  it("requires two evaluations and the manual side, then converges concurrent opens", async () => {
    const alice=await evaluateCandidate(DB,{actorId:"alice",batchId:"batch-a",candidateUserId:"bob",decision:"approve",reasonSummary:"Relevant retrieval work",indexVersion:2,evidenceIds:["signal-b"],now});
    expect(alice.state).toBe("pending");
    const bob=await evaluateCandidate(DB,{actorId:"bob",batchId:"batch-b",candidateUserId:"alice",decision:"approve",reasonSummary:"Useful evaluation overlap",indexVersion:4,evidenceIds:[],now:now+1});
    expect(bob.state).toBe("pending");
    const results=await Promise.all([respondToProposal(DB,{actorId:"alice",proposalId:alice.proposalId,response:"interested",now:now+2}),respondToProposal(DB,{actorId:"alice",proposalId:alice.proposalId,response:"interested",now:now+2})]);
    expect(new Set(results.map((result)=>result.connectionId)).size).toBe(1);
    expect(results.every((result)=>result.state==="matched")).toBe(true);
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM connections").first()).toEqual({count:1});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM rooms").first()).toEqual({count:1});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM room_memberships").first()).toEqual({count:2});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM connection_snapshots").first()).toEqual({count:2});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM notifications").first()).toEqual({count:2});
    await DB.prepare("UPDATE profiles SET display_name='Private new name',summary='Private new summary',audience='private' WHERE user_id='bob'").run();
    expect((await listConnections(DB,"alice"))[0]).toEqual(expect.objectContaining({otherName:"Bob",otherSummary:"Hybrid search"}));
  });

  it("does not let one side evaluate for the other or open stale evidence", async () => {
    await expect(evaluateCandidate(DB,{actorId:"alice",batchId:"batch-a",candidateUserId:"bob",decision:"approve",reasonSummary:"x",indexVersion:4,evidenceIds:[],now})).rejects.toThrow("candidate_stale");
    await DB.prepare("UPDATE builder_match_index SET version=5 WHERE user_id='bob'").run();
    await expect(evaluateCandidate(DB,{actorId:"alice",batchId:"batch-a",candidateUserId:"bob",decision:"approve",reasonSummary:"x",indexVersion:2,evidenceIds:[],now})).rejects.toThrow("candidate_stale");
  });

  it("rechecks current mode, snooze, and weekly introduction budget before opening", async () => {
    await DB.prepare("UPDATE profiles SET acceptance_mode='full_autopilot' WHERE user_id='alice'").run();
    await DB.prepare("INSERT INTO introduction_budgets (user_id,maximum_per_week,used_this_week,week_started_at) VALUES ('alice',0,0,?),('bob',3,0,?)").bind(now,now).run();
    const first=await evaluateCandidate(DB,{actorId:"alice",batchId:"batch-a",candidateUserId:"bob",decision:"approve",reasonSummary:"Current overlap",indexVersion:2,evidenceIds:[],now});
    const second=await evaluateCandidate(DB,{actorId:"bob",batchId:"batch-b",candidateUserId:"alice",decision:"approve",reasonSummary:"Current overlap",indexVersion:4,evidenceIds:[],now:now+1});
    expect(first.proposalId).toBe(second.proposalId); expect(second.state).toBe("pending");
    await DB.prepare("UPDATE introduction_budgets SET maximum_per_week=1 WHERE user_id='alice'").run();
    await DB.prepare("INSERT INTO matching_snoozes (id,user_id,starts_at,ends_at,created_at) VALUES ('pause','bob',?,?,?)").bind(now,now+60_000,now).run();
    expect((await respondToProposal(DB,{actorId:"alice",proposalId:first.proposalId,response:"interested",now:now+2})).state).toBe("pending");
    await DB.prepare("DELETE FROM matching_snoozes WHERE id='pause'").run();
    const opened=await respondToProposal(DB,{actorId:"alice",proposalId:first.proposalId,response:"interested",now:now+3});
    expect(opened.state).toBe("matched");
    expect(await DB.prepare("SELECT used_this_week AS used FROM introduction_budgets WHERE user_id='alice'").first()).toEqual({used:1});
  });
});
