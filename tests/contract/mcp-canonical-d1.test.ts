import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createD1Repositories } from "@buildmates/database";
import { createD1McpProductRepository, createMemoryMcpProductRepository, executeBuildmatesTool, inspectIdempotencyRecovery, pruneExpiredAssertionReplays, pruneExpiredMcpRateLimits, recoverIdempotencyOperation, type BuildmatesToolServices } from "@buildmates/mcp-core";
import { seedDesignPolicy } from "@buildmates/surfaces";
import { fieldNotesRoomSpec, workshopProfileSpec } from "../../apps/web/app/surface-lab/fixtures";

const ALICE_SUB = "mcp_subject_alice_canonical";
const BOB_SUB = "mcp_subject_bob_canonical__";
const CAROL_SUB = "mcp_subject_carol_canonical";
const at = Date.parse("2026-07-15T12:00:00.000Z");
const toolNow = Date.parse("2026-07-18T12:00:00.000Z");

describe("canonical MCP D1 execution", () => {
  let mf: Miniflare;
  let DB: D1Database;
  let services: BuildmatesToolServices;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    for (const file of (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
      const sql = await readFile(`apps/web/drizzle/${file}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await DB.prepare(statement).run();
    }
    await DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('user_alice','active','none',?,?),('user_bob','active','none',?,?),('user_carol','active','none',?,?)").bind(at, at, at, at, at, at).run();
    await DB.prepare("INSERT INTO taxonomy_versions (id,version,status,created_at,activated_at) VALUES ('taxonomy-v1',1,'active',?,?)").bind(at, at).run();
    await DB.prepare("INSERT INTO topics (id,taxonomy_version_id,slug,label) VALUES ('topic-matching','taxonomy-v1','matching','Matching')").run();
    const links = new Map([[ALICE_SUB, "user_alice"], [BOB_SUB, "user_bob"], [CAROL_SUB, "user_carol"]]);
    services = {
      linkBaseUrl: "https://buildmates.example",
      repository: createD1McpProductRepository(DB),
      now: () => new Date(toolNow),
      completeIdentityLink: async () => ({ linked: false, reason: "invalid_or_expired" }),
      allowAttempt: async () => true,
      resolveLinkedUser: async ({ mcpSubject }) => links.has(mcpSubject) ? { userId: links.get(mcpSubject)! } : null,
      validateTaxonomy: async ({ taxonomyVersion, topicIds }) => taxonomyVersion === "1" && topicIds.every((id) => id === "topic-matching"),
    };
  });

  afterEach(async () => mf.dispose());

  it("writes canonical source, Work Signal, profile, pulse, acceptance, automation, and setup rows without cross-user ID squatting", async () => {
    await saveSource(ALICE_SUB, "allow_approved_work_signals", "alice-source");
    await saveSource(BOB_SUB, "allow_approved_work_signals", "bob-source");
    const alice = await call(ALICE_SUB, "submit_work_signal", { signal: signal("shared-client-reference", "alice-signal") }) as MutationResult;
    const bob = await call(BOB_SUB, "submit_work_signal", { signal: signal("shared-client-reference", "bob-signal") }) as MutationResult;
    expect(alice.result.id).not.toBe(bob.result.id);
    const malicious = await call(BOB_SUB, "submit_work_signal", { signal: signal(alice.result.id, "bob-malicious-canonical-id") }) as MutationResult;
    expect(malicious.result.id).not.toBe(alice.result.id);
    await expect(DB.prepare("SELECT user_id AS owner,free_text_summary AS summary FROM work_signals WHERE id=?").bind(alice.result.id).first()).resolves.toEqual({ owner: "user_alice", summary: "Canonical work shared-client-reference" });
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM work_signals WHERE free_text_summary LIKE 'Canonical work %'").first()).resolves.toEqual({ count: 3 });
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM mcp_product_records").first()).rejects.toThrow();

    const profile = await call(ALICE_SUB, "update_profile_model", { profile: { profileId: "caller-profile", handle: "canonical_alice", displayName: "Alice", builderSummary: "Builds canonical collaboration tools", projectOrInterest: "Voice-first builder matching", portfolioLinks: ["https://example.com/alice", "https://github.com/example/alice"], audience: "public", allowMatching: true, acceptanceMode: "manual", indexable: false, fields: [{ key: "ambitions", value: "Build lasting tools for builders", audience: "public", allowMatching: true, provenance: "codex_summary", sourceStatus: "confirmed" }, { key: "style_preferences", value: "Editorial, compact, and warm", audience: "private", allowMatching: false, provenance: "self_reported", sourceStatus: "confirmed" }], statistics: [{ key: "active_users", label: "Daily active users", value: "1,200", provenance: "self_reported", audience: "public" }], idempotencyKey: "profile-write-01" } }) as MutationResult;
    const pulse = await call(ALICE_SUB, "update_networking_pulse", { pulse: { pulseId: "caller-pulse", intentSummary: "Meet adjacent builders", builderSimilarity: "adjacent", geography: "global", maximumIntroductionsPerWeek: 4, serendipity: 40, timezone: "America/Vancouver", quietHours: [{ weekday: 1, startMinute: 0, endMinute: 480 }], snoozedUntil: null, exclusions: [{ kind: "industry", value: "Ads" }], startsAt: "2026-07-15T12:00:00.000Z", expiresAt: "2026-08-15T12:00:00.000Z", idempotencyKey: "pulse-write-01" } }) as MutationResult;
    expect(profile.result.id).toMatch(/^profile_/);
    expect(pulse.result.id).toMatch(/^networking_pulse_/);
    await expect(DB.prepare("SELECT acceptance_mode AS mode,published_at AS publishedAt FROM profiles WHERE user_id='user_alice'").first()).resolves.toMatchObject({ mode: "manual", publishedAt: null });
    await expect(DB.prepare("SELECT maximum_per_week AS maximum FROM introduction_budgets WHERE user_id='user_alice'").first()).resolves.toEqual({ maximum: 4 });
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM quiet_hours WHERE user_id='user_alice'").first()).resolves.toEqual({ count: 1 });
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM matching_exclusions WHERE user_id='user_alice'").first()).resolves.toEqual({ count: 1 });
    await expect(call(ALICE_SUB, "get_profile_model", {})).resolves.toMatchObject({ profiles: [{ projectOrInterest: "Voice-first builder matching", portfolioLinks: ["https://example.com/alice", "https://github.com/example/alice"], fields: expect.arrayContaining([expect.objectContaining({ key: "ambitions", value: "Build lasting tools for builders" }), expect.objectContaining({ key: "style_preferences", value: "Editorial, compact, and warm", audience: "private" })]), statistics: [{ key: "active_users", label: "Daily active users", value: "1,200" }], publishedAt: null }] });
    await expect(call(ALICE_SUB, "get_networking_pulse", {})).resolves.toMatchObject({ pulses: [{ maximumIntroductionsPerWeek: 4, timezone: "America/Vancouver", quietHours: [{ weekday: 1, startMinute: 0, endMinute: 480 }], snoozedUntil: null, exclusions: [{ kind: "industry", value: "Ads" }] }] });
    const activeFollow = await call(ALICE_SUB, "set_follow_or_watch", { relationId: "follow-topic", relation: "follow", targetKind: "topic", targetId: "topic-matching", enabled: true, idempotencyKey: "follow-enable-01" }) as MutationResult;
    expect(activeFollow.result.id).toBe("follow:topic:topic-matching");
    await expect(services.repository.readForMember("follow_watch", activeFollow.result.id, "user_alice")).resolves.toMatchObject({ value: { relation: "follow", targetKind: "topic", targetId: "topic-matching", enabled: true } });
    await expect(services.repository.readForMember("follow_watch", activeFollow.result.id, "user_bob")).resolves.toBeNull();
    await expect(services.repository.listForMember("follow_watch", "user_alice")).resolves.toEqual([expect.objectContaining({ id: activeFollow.result.id })]);
    await call(ALICE_SUB, "set_follow_or_watch", { relationId: "follow-topic", relation: "follow", targetKind: "topic", targetId: "topic-matching", enabled: false, idempotencyKey: "follow-disable-01" });
    await expect(DB.prepare("SELECT revoked_at AS revokedAt FROM follows WHERE follower_user_id='user_alice' AND target_kind='topic' AND target_id='topic-matching'").first()).resolves.toMatchObject({ revokedAt: toolNow });
    await expect(services.repository.readForMember("follow_watch", activeFollow.result.id, "user_alice")).resolves.toBeNull();
    await expect(services.repository.listForMember("follow_watch", "user_alice")).resolves.toEqual([]);
    const activeWatch = await call(ALICE_SUB, "set_follow_or_watch", { relationId: "watch-builder", relation: "watch", targetKind: "relevant_builder", targetId: "network", enabled: true, idempotencyKey: "watch-enable-01" }) as MutationResult;
    expect(activeWatch.result.id).toBe("watch:relevant_builder:network");
    await expect(services.repository.readForMember("follow_watch", activeWatch.result.id, "user_alice")).resolves.toMatchObject({ value: { relation: "watch", targetKind: "relevant_builder", targetId: "network", enabled: true } });
    await call(ALICE_SUB, "set_follow_or_watch", { relationId: "watch-builder", relation: "watch", targetKind: "relevant_builder", targetId: "network", enabled: false, idempotencyKey: "watch-disable-01" });
    await expect(DB.prepare("SELECT revoked_at AS revokedAt FROM watches WHERE user_id='user_alice' AND kind='relevant_builder' AND target_id='network'").first()).resolves.toMatchObject({ revokedAt: toolNow });
    await expect(services.repository.readForMember("follow_watch", activeWatch.result.id, "user_alice")).resolves.toBeNull();
    await expect(call(ALICE_SUB, "set_follow_or_watch", { relationId: "watch-person", relation: "watch", targetKind: "relevant_builder", targetId: "user_bob", enabled: true, idempotencyKey: "watch-person-invalid-01" })).rejects.toThrow();

    await DB.prepare("INSERT INTO profiles(id,user_id,display_name,summary,audience,allow_matching,published_at,created_at,updated_at) VALUES ('profile-bob','user_bob','Bob','Visible builder','public',1,?,?,?),('profile-carol','user_carol','Carol','Private builder','private',1,?,?,?)").bind(at,at,at,at,at,at).run();
    await expect(call(ALICE_SUB, "set_follow_or_watch", { relationId: "follow-private", relation: "follow", targetKind: "profile", targetId: "user_carol", enabled: true, idempotencyKey: "follow-private-01" })).rejects.toThrow("object_not_found_or_not_authorized");
    await DB.prepare("INSERT INTO blocks(blocker_user_id,blocked_user_id,created_at) VALUES ('user_alice','user_bob',?)").bind(at).run();
    await expect(call(ALICE_SUB, "set_follow_or_watch", { relationId: "follow-blocked", relation: "follow", targetKind: "profile", targetId: "user_bob", enabled: true, idempotencyKey: "follow-blocked-01" })).rejects.toThrow("object_not_found_or_not_authorized");
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM follows WHERE follower_user_id='user_alice' AND target_id IN ('user_bob','user_carol')").first()).resolves.toEqual({ count: 0 });

    await call(ALICE_SUB, "complete_setup_step", { payload: { step: "storage_explanation", acknowledged: true }, idempotencyKey: "setup-storage-01" });
    await call(ALICE_SUB, "complete_setup_step", { payload: { step: "source_selection", sourceIds: ["github"] }, idempotencyKey: "setup-source-01" });
    await call(ALICE_SUB, "complete_setup_step", { payload: { step: "context_collection", method: "manual_profile", summary: "Builds canonical collaboration tools", links: [] }, idempotencyKey: "setup-context-01" });
    await call(ALICE_SUB, "complete_setup_step", { payload: { step: "signal_privacy_review", reviewedSignalIds: [alice.result.id], acknowledged: true }, idempotencyKey: "setup-signal-01" });
    await call(ALICE_SUB, "complete_setup_step", { payload: { step: "basic_profile", profileId: profile.result.id, handle: "canonical_alice", approved: true }, idempotencyKey: "setup-profile-01" });
    await expect(DB.prepare("SELECT completed_steps_json AS steps FROM setup_states WHERE user_id='user_alice'").first<{ steps: string }>()).resolves.toSatisfy((row) => JSON.parse(row!.steps).includes("basic_profile"));

    await call(ALICE_SUB, "update_automation_checkpoint", { checkpointId: "caller-checkpoint", cursor: null, state: "configured", lastOutcome: "Configured", nextRunAt: "2026-07-16T12:00:00.000Z", idempotencyKey: "automation-write-01" });
    await expect(DB.prepare("SELECT state_json AS state FROM automation_checkpoints WHERE user_id='user_alice' AND kind='buildmates'").first<{ state: string }>()).resolves.toSatisfy((row) => JSON.parse(row!.state).configured === true);
  }, 60_000);

  it("round-trips one canonical automation checkpoint without erasing capability proof", async () => {
    await DB.prepare("INSERT INTO automation_checkpoints (id,user_id,kind,state_json,updated_at) VALUES ('existing-automation','user_alice','buildmates',?,?)")
      .bind(JSON.stringify({ capability: "available", checkedAt: "2026-07-15T12:00:00.000Z", proofSource: "mcp_delegated_probe" }), at)
      .run();
    await call(ALICE_SUB, "update_automation_checkpoint", { checkpointId: "canonical-automation", cursor: "cursor-1", state: "succeeded", lastOutcome: "No relevant changes", enabled: true, cadence: "automatic", sourceLivenessReviewed: true, nextRunAt: "2026-07-16T12:00:00.000Z", idempotencyKey: "canonical-automation-01" });
    await expect(call(ALICE_SUB, "get_automation_checkpoint", {})).resolves.toMatchObject({ checkpoint: { kind: "buildmates", cursor: "cursor-1", state: "succeeded", cadence: "automatic", sourceLivenessReviewed: true, capability: "available", proofSource: "mcp_delegated_probe" } });
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM automation_checkpoints WHERE user_id='user_alice'").first()).resolves.toEqual({ count: 1 });
  }, 60_000);

  it("persists every supported Connection update field and never reactivates an ended Connection", async () => {
    await DB.batch([
      DB.prepare("INSERT INTO match_pairs (id,user_a_id,user_b_id,created_at) VALUES ('connection-pair','user_alice','user_bob',?)").bind(at),
      DB.prepare("INSERT INTO match_proposals (id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES ('connection-proposal','connection-pair',1,1,1,'manual','manual','{}','{}','matched',?,?)").bind(at + 60_000, at),
      DB.prepare("INSERT INTO matches (id,match_pair_id,proposal_id,matched_at) VALUES ('connection-match','connection-pair','connection-proposal',?)").bind(at),
      DB.prepare("INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) VALUES ('connection-1','connection-pair','connection-match','active',?,?)").bind(at, at),
      DB.prepare("INSERT INTO connection_sides (connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at) VALUES ('connection-1','user_alice',0,1,?,?),('connection-1','user_bob',0,1,?,?)").bind(at, at, at, at),
      DB.prepare("INSERT INTO rooms (id,match_pair_id,connection_id,status,created_at,updated_at) VALUES ('connection-room','connection-pair','connection-1','active',?,?)").bind(at, at),
      DB.prepare("INSERT INTO match_pairs (id,user_a_id,user_b_id,created_at) VALUES ('other-pair','user_alice','user_carol',?)").bind(at),
      DB.prepare("INSERT INTO match_proposals (id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES ('other-proposal','other-pair',1,1,1,'manual','manual','{}','{}','matched',?,?)").bind(at + 60_000, at),
      DB.prepare("INSERT INTO matches (id,match_pair_id,proposal_id,matched_at) VALUES ('other-match','other-pair','other-proposal',?)").bind(at),
      DB.prepare("INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) VALUES ('connection-other','other-pair','other-match','active',?,?)").bind(at, at),
      DB.prepare("INSERT INTO connection_sides (connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at) VALUES ('connection-other','user_alice',0,1,?,?),('connection-other','user_carol',0,1,?,?)").bind(at, at, at, at),
    ]);
    for (let index = 0; index < 3; index += 1) {
      await call(ALICE_SUB, "save_connection_private_note", { noteId: `aaa-other-${index}`, connectionId: "connection-other", body: `Other ${index}`, idempotencyKey: `other-note-${index}-key` });
      await call(ALICE_SUB, "schedule_connection_reminder", { reminderId: `aaa-reminder-${index}`, connectionId: "connection-other", remindAt: `2026-07-${20 + index}T12:00:00.000Z`, idempotencyKey: `other-reminder-${index}-key` });
    }
    await call(ALICE_SUB, "save_connection_private_note", { noteId: "zzz-target-note", connectionId: "connection-1", body: "Target note", idempotencyKey: "target-note-key" });
    await call(ALICE_SUB, "schedule_connection_reminder", { reminderId: "zzz-target-reminder", connectionId: "connection-1", remindAt: "2026-07-25T12:00:00.000Z", idempotencyKey: "target-reminder-key" });
    await expect(call(ALICE_SUB, "get_connection_private_notes", { connectionId: "connection-1", limit: 1 })).resolves.toMatchObject({ notes: [{ body: "Target note" }], nextCursor: null });
    await expect(call(ALICE_SUB, "get_connection_reminders", { connectionId: "connection-1", limit: 1 })).resolves.toMatchObject({ reminders: [{ connectionId: "connection-1" }], nextCursor: null });
    const acknowledgedAt = "2026-07-15T13:00:00.000Z";
    await call(ALICE_SUB, "update_connection", { connectionId: "connection-1", muted: true, renewedRelevanceEnabled: false, renewedRelevanceAcknowledgedAt: acknowledgedAt, state: "ended", idempotencyKey: "connection-update-all-01" });
    await expect(call(ALICE_SUB, "get_connections", { connectionId: "connection-1" })).resolves.toMatchObject({ connections: [{ state: "ended", sides: { user_alice: { muted: true, renewedRelevanceEnabled: false, renewedRelevanceAcknowledgedAt: acknowledgedAt } } }] });
    await expect(DB.prepare("SELECT muted,renewed_relevance_enabled AS enabled,renewed_relevance_acknowledged_at AS acknowledgedAt FROM connection_sides WHERE connection_id='connection-1' AND user_id='user_alice'").first()).resolves.toEqual({ muted: 1, enabled: 0, acknowledgedAt: Date.parse(acknowledgedAt) });
    await expect(DB.prepare("SELECT state,ended_by_user_id AS endedBy FROM connections WHERE id='connection-1'").first()).resolves.toEqual({ state: "ended", endedBy: "user_alice" });
    await expect(DB.prepare("SELECT status FROM rooms WHERE id='connection-room'").first()).resolves.toEqual({ status: "ended" });
    await expect(call(ALICE_SUB, "update_connection", { connectionId: "connection-1", state: "active", idempotencyKey: "connection-reactivate-01" })).rejects.toMatchObject({ issues: [expect.objectContaining({ code: "invalid_value", path: ["state"] })] });
  }, 60_000);

  it("exposes only privacy-safe room activity and the viewer's own feedback state", async () => {
    await DB.batch([
      DB.prepare("INSERT INTO match_pairs (id,user_a_id,user_b_id,created_at) VALUES ('feedback-pair','user_alice','user_bob',?)").bind(at),
      DB.prepare("INSERT INTO match_proposals (id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES ('feedback-match-proposal','feedback-pair',1,1,1,'manual','manual','{}','{}','matched',?,?)").bind(at + 60_000, at),
      DB.prepare("INSERT INTO matches (id,match_pair_id,proposal_id,matched_at) VALUES ('feedback-match','feedback-pair','feedback-match-proposal',?)").bind(at),
      DB.prepare("INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) VALUES ('feedback-connection','feedback-pair','feedback-match','active',?,?)").bind(at, at),
      DB.prepare("INSERT INTO rooms (id,match_pair_id,connection_id,status,created_at,updated_at) VALUES ('feedback-room','feedback-pair','feedback-connection','active',?,?)").bind(at, at),
      DB.prepare("INSERT INTO room_memberships (room_id,user_id,joined_at) VALUES ('feedback-room','user_alice',?),('feedback-room','user_bob',?)").bind(at, at),
      DB.prepare("INSERT INTO messages (id,room_id,sender_user_id,client_message_id,body,created_at) VALUES ('feedback-message-1','feedback-room','user_alice','client-1','Private message one',?),('feedback-message-2','feedback-room','user_bob','client-2','Private message two',?),('feedback-message-3','feedback-room','user_alice','client-3','Private message three',?),('feedback-message-4','feedback-room','user_bob','client-4','Private message four',?)").bind(at + 1_000, at + 2_000, at + 3_000, at + 4_000),
      DB.prepare("INSERT INTO introduction_feedback (id,connection_id,user_id,useful,reasons_json,created_at) VALUES ('bob-private-feedback','feedback-connection','user_bob',1,'[\"good_conversation\"]',?)").bind(at + 5_000),
    ]);

    const before = await call(ALICE_SUB, "get_room_summaries", { roomId: "feedback-room" });
    expect(before).toMatchObject({ rooms: [{
      roomId: "feedback-room",
      connectionId: "feedback-connection",
      conversation: { messageCount: 4, meaningful: true, lastActivityAt: new Date(at + 4_000).toISOString() },
      feedback: { submittedByViewer: false, positiveFromViewer: false },
      upgradeState: "none",
    }] });
    expect(JSON.stringify(before)).not.toContain("Private message");
    expect(JSON.stringify(before)).not.toContain("good_conversation");
    await expect(call(CAROL_SUB, "get_room_summaries", { roomId: "feedback-room" })).rejects.toThrow("object_not_found_or_not_authorized");

    await call(ALICE_SUB, "submit_intro_feedback", { feedbackId: "alice-feedback-response", connectionId: "feedback-connection", useful: true, reasons: ["relevant_work", "good_conversation"], preferenceSummary: "More builders working on evaluation", idempotencyKey: "alice-feedback-response-01" });
    await DB.prepare("INSERT INTO room_upgrade_proposals (id,room_id,proposer_user_id,modules_json,explanation,status,created_at) VALUES ('feedback-upgrade','feedback-room','user_alice','[\"experiment_tracker\"]','Track retrieval experiments together','proposed',?)").bind(at + 6_000).run();
    await expect(call(ALICE_SUB, "get_room_summaries", { limit: 10 })).resolves.toMatchObject({ rooms: [expect.objectContaining({
      roomId: "feedback-room",
      feedback: { submittedByViewer: true, positiveFromViewer: true },
      upgradeState: "pending",
    })] });
    await expect(call(BOB_SUB, "get_room_summaries", { roomId: "feedback-room" })).resolves.toMatchObject({ rooms: [{
      feedback: { submittedByViewer: true, positiveFromViewer: true },
      upgradeState: "pending",
    }] });
  }, 60_000);

  it("returns authorized room availability in Calendar handoffs and rejects ended rooms", async () => {
    const startsAt = at + 3_600_000;
    const endsAt = at + 7_200_000;
    await DB.batch([
      DB.prepare("INSERT INTO profiles (id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,timezone,published_at,created_at,updated_at) VALUES ('calendar-profile-a','user_alice','Alice','Summary','Project','[]','public',1,'manual',1,'America/Vancouver',?,?,?),('calendar-profile-b','user_bob','Bob','Summary','Project','[]','public',1,'manual',1,'Europe/London',?,?,?)").bind(at, at, at, at, at, at),
      DB.prepare("INSERT INTO match_pairs (id,user_a_id,user_b_id,created_at) VALUES ('calendar-pair','user_alice','user_bob',?)").bind(at),
      DB.prepare("INSERT INTO match_proposals (id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES ('calendar-proposal','calendar-pair',1,1,1,'manual','manual','{}','{}','matched',?,?)").bind(at + 60_000, at),
      DB.prepare("INSERT INTO matches (id,match_pair_id,proposal_id,matched_at) VALUES ('calendar-match','calendar-pair','calendar-proposal',?)").bind(at),
      DB.prepare("INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) VALUES ('calendar-connection','calendar-pair','calendar-match','active',?,?)").bind(at, at),
      DB.prepare("INSERT INTO connection_sides (connection_id,user_id,created_at,updated_at) VALUES ('calendar-connection','user_alice',?,?),('calendar-connection','user_bob',?,?)").bind(at, at, at, at),
      DB.prepare("INSERT INTO rooms (id,match_pair_id,connection_id,status,theme_topic_id,created_at,updated_at) VALUES ('calendar-room','calendar-pair','calendar-connection','active','topic-matching',?,?)").bind(at, at),
      DB.prepare("INSERT INTO room_memberships (room_id,user_id,joined_at) VALUES ('calendar-room','user_alice',?),('calendar-room','user_bob',?)").bind(at, at),
      DB.prepare("INSERT INTO availability_windows (id,room_id,user_id,starts_at,ends_at,timezone,status,created_at,updated_at) VALUES ('calendar-window-a','calendar-room','user_alice',?,?,'America/Vancouver','approved',?,?),('calendar-window-b','calendar-room','user_bob',?,?,'Europe/London','approved',?,?)").bind(startsAt, endsAt, at, at, startsAt + 1_800_000, endsAt + 1_800_000, at, at),
    ]);
    await expect(call(ALICE_SUB, "prepare_calendar_handoff", { roomId: "calendar-room" })).resolves.toMatchObject({
      participants: [{ userId: "user_alice", label: "Alice" }, { userId: "user_bob", label: "Bob" }],
      timezones: [{ userId: "user_alice", timezone: "America/Vancouver" }, { userId: "user_bob", timezone: "Europe/London" }],
      candidateWindows: [{ startsAt: new Date(startsAt + 1_800_000).toISOString(), endsAt: new Date(endsAt).toISOString() }],
      agenda: "Continue the Buildmates introduction around Matching",
      options: ["codex_deep_link", "copy_prompt", "manual_times", "ics"],
    });
    await call(ALICE_SUB, "update_connection", { connectionId: "calendar-connection", state: "ended", idempotencyKey: "end-calendar-connection-01" });
    await expect(call(ALICE_SUB, "prepare_calendar_handoff", { roomId: "calendar-room" })).rejects.toThrow("room_not_available");
  }, 60_000);

  it("enforces Never, Actions only, and single-use Ask each time approval in canonical rows", async () => {
    await saveSource(ALICE_SUB, "never", "never-source");
    await expect(call(ALICE_SUB, "submit_work_signal", { signal: signal("never-signal", "never-write") })).rejects.toThrow("source_policy_denied");
    await saveSource(ALICE_SUB, "actions_only", "actions-source", true);
    await expect(call(ALICE_SUB, "submit_work_signal", { signal: signal("actions-signal", "actions-write") })).rejects.toThrow("source_policy_denied");
    const preference = await saveSource(ALICE_SUB, "ask_each_time", "ask-source", true, true) as MutationResult;
    const approvalId = String((preference.result.details as Record<string, unknown>).approvalId);
    await call(ALICE_SUB, "submit_work_signal", { signal: { ...signal("ask-signal", "ask-write"), sourceApprovalId: approvalId } });
    await expect(call(ALICE_SUB, "submit_work_signal", { signal: { ...signal("ask-signal-two", "ask-write-two"), sourceApprovalId: approvalId } })).rejects.toThrow("source_approval_required");
    await expect(DB.prepare("SELECT consumed_at AS consumedAt FROM source_use_approvals WHERE id=?").bind(approvalId).first()).resolves.toMatchObject({ consumedAt: toolNow });
  }, 60_000);

  it("conditionally recovers an exact crashed idempotency row and audits the operator disposition", async () => {
    const requestHash = "a".repeat(64);
    await DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('user_admin','active','admin',?,?)").bind(at, at).run();
    await DB.prepare("INSERT INTO idempotency_keys (id,actor_user_id,operation,key_hash,request_hash,status,expires_at,created_at,updated_at) VALUES ('idempotency_00000000-0000-4000-8000-000000000001','user_alice','update_profile','key-hash',?,'processing',?,?,?)").bind(requestHash, at - 1, at - 60_000, at - 60_000).run();
    await expect(inspectIdempotencyRecovery(DB, "idempotency_00000000-0000-4000-8000-000000000001", at)).resolves.toMatchObject({ operation: "update_profile", requestHash, status: "processing", ageMs: 60_000, hasResponse: false });
    const input = { id: "idempotency_00000000-0000-4000-8000-000000000001", requestHash, operatorUserId: "user_admin", reason: "Runner terminated before its canonical write", disposition: "no_effect" as const, at: new Date(at), auditId: "audit-recovery-one" };
    await expect(recoverIdempotencyOperation(DB, input)).resolves.toBe(true);
    await expect(DB.prepare("SELECT status,response_json AS response FROM idempotency_keys WHERE id=?").bind(input.id).first()).resolves.toEqual({ status: "failed", response: null });
    await expect(DB.prepare("SELECT action,object_id AS objectId,metadata_json AS metadata FROM audit_events WHERE id='audit-recovery-one'").first<{ action: string; objectId: string; metadata: string }>()).resolves.toSatisfy((row) => row?.action === "idempotency.operator_recovery" && row.objectId === input.id && JSON.parse(row.metadata).disposition === "no_effect");
    await expect(recoverIdempotencyOperation(DB, { ...input, auditId: "audit-recovery-two" })).resolves.toBe(false);
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE object_id=?").bind(input.id).first()).resolves.toEqual({ count: 1 });
    await expect(recoverIdempotencyOperation(DB, { ...input, id: "missing", requestHash: "b".repeat(64), disposition: "completed_effect", effectLocator: { kind: "profile", id: "profile-1" }, auditId: "audit-recovery-missing" })).resolves.toBe(false);

    await DB.prepare("INSERT INTO profiles (id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,created_at,updated_at) VALUES ('owned-profile','user_alice','Alice','Summary','Project','[]','private',0,'manual',0,?,?),('other-profile','user_bob','Bob','Summary','Project','[]','private',0,'manual',0,?,?)").bind(at, at, at, at).run();
    await DB.prepare("INSERT INTO idempotency_keys (id,actor_user_id,operation,key_hash,request_hash,status,expires_at,created_at,updated_at) VALUES ('idempotency_00000000-0000-4000-8000-000000000002','user_alice','update_profile_model','key-two',?,'processing',?,?,?)").bind(requestHash, at + 1, at - 60_000, at - 60_000).run();
    const completed = { id: "idempotency_00000000-0000-4000-8000-000000000002", requestHash, operatorUserId: "user_admin", reason: "Canonical profile write was verified complete", disposition: "completed_effect" as const, effectLocator: { kind: "profile", id: "owned-profile" }, at: new Date(at), auditId: "audit-recovery-completed" };
    await expect(recoverIdempotencyOperation(DB, { ...completed, effectLocator: { kind: "profile", id: "other-profile" }, auditId: "audit-wrong-owner" })).resolves.toBe(false);
    await expect(recoverIdempotencyOperation(DB, { ...completed, operatorUserId: "user_bob", auditId: "audit-not-admin" })).resolves.toBe(false);
    await expect(recoverIdempotencyOperation(DB, completed)).resolves.toBe(true);
    await expect(DB.prepare("SELECT status,response_json AS response FROM idempotency_keys WHERE id=?").bind(completed.id).first<{ status: string; response: string }>()).resolves.toSatisfy((row) => row?.status === "complete" && JSON.parse(row.response).effectLocator.id === "owned-profile");
  }, 60_000);

  it("prunes expired replay and rate-limit rows in bounded indexed batches", async () => {
    for (let index = 0; index < 5; index += 1) {
      await DB.prepare("INSERT INTO assertion_replays (jti,issuer,subject,action,expires_at,created_at) VALUES (?,?,?,?,?,?)").bind(`expired-${index}`, "issuer", "subject", "action", at - 1, at - 100).run();
      await DB.prepare("INSERT INTO mcp_rate_limits (key,attempt_count,window_expires_at) VALUES (?,1,?)").bind(`expired-${index}`, at - 1).run();
    }
    await DB.prepare("INSERT INTO assertion_replays (jti,issuer,subject,action,expires_at,created_at) VALUES ('live','issuer','subject','action',?,?)").bind(at + 10_000, at).run();
    await DB.prepare("INSERT INTO mcp_rate_limits (key,attempt_count,window_expires_at) VALUES ('live',1,?)").bind(at + 10_000).run();
    await pruneExpiredAssertionReplays(DB, at, 3);
    await pruneExpiredMcpRateLimits(DB, at, 3);
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM assertion_replays").first()).resolves.toEqual({ count: 3 });
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM mcp_rate_limits").first()).resolves.toEqual({ count: 3 });
    await pruneExpiredAssertionReplays(DB, at, 1000);
    await pruneExpiredMcpRateLimits(DB, at, 1000);
    await expect(DB.prepare("SELECT jti FROM assertion_replays").all()).resolves.toMatchObject({ results: [{ jti: "live" }] });
    await expect(DB.prepare("SELECT key FROM mcp_rate_limits").all()).resolves.toMatchObject({ results: [{ key: "live" }] });
  }, 60_000);

  it("routes profile revisions, personal views, approval publication, and rollback through Task 4 governance", async () => {
    await saveSource(ALICE_SUB, "allow_approved_work_signals", "surface-source");
    const profile = await call(ALICE_SUB, "update_profile_model", { profile: { profileId: "profile-surface", handle: "surface_alice", displayName: "Alice", builderSummary: "Builds governed surfaces", projectOrInterest: "Surface safety", portfolioLinks: [], audience: "public", allowMatching: true, acceptanceMode: "manual", fields: [
      { key: "ambitions", value: "Make generative interfaces feel authored", audience: "public", allowMatching: true, provenance: "codex_summary", sourceStatus: "confirmed" },
      { key: "projects", value: [{ id: "project-surface-studio", title: "Surface Studio", summary: "A governed system for expressive, privacy-safe profile pages.", tags: ["Generative UI", "Privacy"], metrics: [{ label: "Stage", value: "Private beta" }] }], audience: "suggested_connections", allowMatching: true, provenance: "codex_summary", sourceStatus: "confirmed" },
      { key: "style_preferences", value: "Editorial and private", audience: "private", allowMatching: false, provenance: "self_reported", sourceStatus: "confirmed" },
    ], idempotencyKey: "surface-profile-01" } }) as MutationResult;
    const repositories = createD1Repositories(DB as never);
    await seedDesignPolicy(repositories);
    const surfaceId = String((profile.result as Record<string, unknown>).surfaceId);
    expect(surfaceId).toBe(`surface_profile_${profile.result.id}`);
    const brief = await call(ALICE_SUB, "get_surface_generation_brief", { surfaceId }) as { starterSpec: Record<string, unknown>; customizedExample: Record<string, unknown>; componentReference: { components: Record<string, unknown> } };
    expect(brief).toMatchObject({ kind: "profile", allowedModules: ["profile.identity", "profile.current_work", "profile.projects"], authorizedBindings: ["profile.displayName", "profile.summary", "profile.facts", "profile.projects"], authorizedContent: { "profile.displayName": "Alice", "profile.summary": "Builds governed surfaces", "profile.facts": [{ label: "Ambitions", value: "Make generative interfaces feel authored" }], "profile.projects": [{ id: "project-surface-studio", title: "Surface Studio" }] }, requiredBindings: ["profile.displayName", "profile.summary", "profile.facts", "profile.projects"], governance: { mode: "owner", requiredApproverIds: ["user_alice"] }, designPolicy: { trustedComponents: expect.arrayContaining(["section", "decorative-region"]) }, starterSpec: { kind: "profile" }, customizedExample: { kind: "profile", title: "Customized builder profile" }, componentReference: { components: { split: expect.any(Object), frame: expect.any(Object), "decorative-mark": expect.any(Object) } }, referenceResearch: { source: "https://recent.design/websites", privateMethod: expect.stringContaining("four to eight materially different"), selectionRule: expect.stringContaining("person-specific and auditable") }, mediaWorkflow: { approvedMediaAvailable: false, attachAt: "https://buildmates.example/profile/design", whenMissing: expect.stringContaining("ImageGen") }, visualQa: { requiredBeforeReady: true, viewports: [{ name: "desktop", width: 1440, height: 1000 }, { name: "phone", width: 390, height: 844 }], inspect: expect.arrayContaining(["distinctive full-page composition", "coherent visual world", "reference-quality hierarchy and pacing"]) } });
    expect(brief.authorizedContent).not.toEqual(expect.objectContaining({ "profile.facts": expect.arrayContaining([expect.objectContaining({ value: "Editorial and private" })]) }));
    const mediaHash = "a".repeat(64);
    await DB.prepare("INSERT INTO surface_assets(id,owner_user_id,object_key,content_type,byte_size,sha256,created_at) VALUES (?,?,?,?,?,?,?)").bind("asset_surface_studio", "user_alice", `surface-assets/user_alice/${mediaHash}.jpg`, "image/jpeg", 128, mediaHash, at).run();
    await DB.prepare("INSERT INTO profile_project_media(profile_id,project_key,asset_id,alt_text,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(profile.result.id, "project-surface-studio", "asset_surface_studio", "A warm studio workspace", at, at).run();
    const mediaBrief = await call(ALICE_SUB, "get_surface_generation_brief", { surfaceId }) as { authorizedMedia: Array<{ approvedAssetIds: string[] }>; approvedAssets: Array<{ id: string; src: string }>; mediaWorkflow: { approvedMediaAvailable: boolean }; customizedExample: { bindingManifest: { media: Array<{ approvedAssetIds: string[]; authorization: string }> }; approvedAssets: Array<{ id: string }> } };
    expect(mediaBrief).toMatchObject({ authorizedMedia: [{ approvedAssetIds: ["asset_surface_studio"] }], approvedAssets: [{ id: "asset_surface_studio", src: `/api/surface-assets/user_alice/${mediaHash}.jpg` }], mediaWorkflow: { approvedMediaAvailable: true } });
    expect(mediaBrief.customizedExample).toMatchObject({ bindingManifest: { media: [{ approvedAssetIds: ["asset_surface_studio"], authorization: "surface-approved" }] }, approvedAssets: [{ id: "asset_surface_studio" }] });
    await expect(call(ALICE_SUB, "validate_surface_spec", { surfaceId, spec: mediaBrief.customizedExample })).resolves.toEqual({ valid: true, issues: [] });
    await expect(call(ALICE_SUB, "validate_surface_spec", { surfaceId, spec: brief.starterSpec })).resolves.toMatchObject({ valid: false, issues: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("approved profile content binding") })]) });
    await expect(call(ALICE_SUB, "validate_surface_spec", { surfaceId, spec: brief.customizedExample })).resolves.toEqual({ valid: true, issues: [] });
    const artifactProfile = structuredClone(brief.customizedExample) as Record<string, unknown>;
    const rewrite = (node: Record<string, unknown>): Record<string, unknown> => {
      if (node.type === "project-list" || node.type === "featured-project") return { id: node.id, type: "project-artifact", binding: "profile.projects", index: 0, variant: "orbit-map", tone: "secondary", scale: "hero" };
      return { ...node, ...(Array.isArray(node.children) ? { children: node.children.filter((child) => (child as Record<string, unknown>).type !== "decorative-mark").map((child) => rewrite(child as Record<string, unknown>)) } : {}) };
    };
    artifactProfile.root = rewrite(artifactProfile.root as Record<string, unknown>);
    await expect(call(ALICE_SUB, "validate_surface_spec", { surfaceId, spec: artifactProfile })).resolves.toEqual({ valid: true, issues: [] });
    await expect(call(ALICE_SUB, "validate_surface_spec", { surfaceId, spec: { kind: "profile" } })).resolves.toMatchObject({ valid: false, issues: expect.arrayContaining([expect.objectContaining({ path: expect.any(String), message: expect.any(String) })]) });

    const designBrief = {
      direction: "A warm editorial workshop page with clear project depth",
      sections: ["Introduction", "Current work", "Projects"],
      signatureElement: "A workshop ledger running through the page",
      selectionBasis: "The selected editorial reference fits the approved writing-led profile and does not depend on unavailable media.",
      candidates: [
        { url: "https://recent.design/i/9b18jw0-harry-atkins", title: "Harry Atkins", style: ["editorial", "typographic"], fit: "Strong fit for a writing-led profile with restrained project indexing.", selected: true },
        { url: "https://recent.design/i/reference-two", title: "Reference Two", style: ["cinematic"], fit: "Too dependent on photographic media that this profile has not approved.", selected: false },
        { url: "https://recent.design/i/reference-three", title: "Reference Three", style: ["technical"], fit: "Useful information density, but too product-documentation led for this person.", selected: false },
        { url: "https://recent.design/i/reference-four", title: "Reference Four", style: ["playful"], fit: "Expressive interaction language, but weaker fit for the approved restrained tone.", selected: false },
      ],
      references: [{ url: "https://recent.design/i/9b18jw0-harry-atkins", title: "Harry Atkins", principles: ["Use a restrained project index", "Let typography create hierarchy"] }],
    };
    await expect(call(ALICE_SUB, "submit_surface_revision", { revisionId: "starter-revision", surfaceId, baseRevisionId: null, spec: brief.starterSpec, visibility: "private_preview", designBrief, designBriefApproved: true, idempotencyKey: "starter-revision-01" })).rejects.toThrow("starter_spec_not_publishable");
    const revision = await call(ALICE_SUB, "submit_surface_revision", { revisionId: "caller-revision", surfaceId, baseRevisionId: null, spec: brief.customizedExample, visibility: "private_preview", designBrief, designBriefApproved: true, idempotencyKey: "surface-revision-01" }) as MutationResult;
    expect((revision.result as Record<string, unknown>).previewUrl).toBe("https://buildmates.example/profile/design");
    await expect(DB.prepare("SELECT status FROM surface_revisions WHERE id=?").bind(revision.result.id).first()).resolves.toEqual({ status: "draft" });
    const publication = await call(ALICE_SUB, "decide_surface_revision", { revisionId: revision.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "surface-approval-01" }) as MutationResult;
    expect(publication.result).toMatchObject({ publicUrl: "https://buildmates.example/builders/surface_alice" });
    await expect(DB.prepare("SELECT published_revision_id AS published FROM surfaces WHERE id=?").bind(surfaceId).first()).resolves.toEqual({ published: revision.result.id });

    const setupSignal = await call(ALICE_SUB, "submit_work_signal", { signal: signal("surface-setup-signal", "surface-signal-01") }) as MutationResult;
    const setupPulse = await call(ALICE_SUB, "update_networking_pulse", { pulse: { pulseId: "surface-setup-pulse", intentSummary: "Meet builders working on governed UI", builderSimilarity: "balanced", geography: "global", maximumIntroductionsPerWeek: 3, serendipity: 30, timezone: "America/Vancouver", quietHours: [], snoozedUntil: null, exclusions: [], startsAt: "2026-07-15T12:00:00.000Z", expiresAt: "2026-08-15T12:00:00.000Z", idempotencyKey: "surface-pulse-01" } }) as MutationResult;
    await call(ALICE_SUB, "create_invite_link", { inviteId: "surface-invite", kind: "personal", headline: "Meet builders working on safe generative UI", maximumUses: 5, expiresAt: "2026-08-15T12:00:00.000Z", idempotencyKey: "surface-invite-01" });
    const builderInvite = await call(ALICE_SUB, "create_invite_link", { inviteId: "surface-builder-invite", kind: "builder", targetId: profile.result.id, headline: "Meet Alice, who builds governed surfaces", maximumUses: 5, expiresAt: "2026-08-15T12:00:00.000Z", idempotencyKey: "surface-builder-invite-01" }) as MutationResult;
    await DB.prepare("INSERT INTO projects(id,owner_user_id,slug,title,summary,status,created_at,updated_at) VALUES ('surface-project','user_alice','surface-project','Surface Project','Governed generative surfaces','active',?,?)").bind(at,at).run();
    const cardInvite = await call(ALICE_SUB, "create_invite_link", { inviteId: "surface-card-invite", kind: "connection_card", targetId: "surface-project", headline: "Connect around governed generative surfaces", maximumUses: 5, expiresAt: "2026-08-15T12:00:00.000Z", idempotencyKey: "surface-card-invite-01" }) as MutationResult;
    await expect(DB.prepare("SELECT kind,target_id AS targetId,headline FROM invite_links WHERE id IN (?,?) ORDER BY kind").bind(builderInvite.result.id,cardInvite.result.id).all()).resolves.toMatchObject({results:[{kind:"builder",targetId:profile.result.id,headline:"Meet Alice, who builds governed surfaces"},{kind:"connection_card",targetId:"surface-project",headline:"Connect around governed generative surfaces"}]});
    await expect(call(ALICE_SUB, "create_invite_link", { inviteId: "foreign-builder-invite", kind: "builder", targetId: "profile-carol-missing", headline: "Unauthorized builder", maximumUses: 5, expiresAt: "2026-08-15T12:00:00.000Z", idempotencyKey: "foreign-builder-invite-01" })).rejects.toThrow("object_not_found_or_not_authorized");
    await expect(call(ALICE_SUB, "create_invite_link", { inviteId: "missing-card-target", kind: "connection_card", headline: "Missing project", maximumUses: 5, expiresAt: "2026-08-15T12:00:00.000Z", idempotencyKey: "missing-card-target-01" })).rejects.toThrow("invalid_invite_target");
    const setup = (payload: Record<string, unknown>, idempotencyKey: string) => call(ALICE_SUB, "complete_setup_step", { payload, idempotencyKey });
    await setup({ step: "storage_explanation", acknowledged: true }, "surface-setup-01");
    await setup({ step: "source_selection", sourceIds: ["github"] }, "surface-setup-02");
    await setup({ step: "context_collection", method: "manual_profile", summary: "Builds governed surfaces", links: [] }, "surface-setup-03");
    await setup({ step: "signal_privacy_review", reviewedSignalIds: [setupSignal.result.id], acknowledged: true }, "surface-setup-04");
    await setup({ step: "basic_profile", profileId: profile.result.id, handle: "surface_alice", approved: true }, "surface-setup-05");
    await setup({ step: "page_preview", surfaceRevisionId: revision.result.id, approved: true }, "surface-setup-06");
    await setup({ step: "networking_pulse", pulseId: setupPulse.result.id }, "surface-setup-07");
    await setup({ step: "acceptance_mode", mode: "manual" }, "surface-setup-08");
    await expect(call(ALICE_SUB, "update_automation_checkpoint", { checkpointId: "surface-automation", cursor: null, state: "configured", lastOutcome: "Configured", enabled: true, cadence: "twice_weekly", sourceLivenessReviewed: true, nextRunAt: "2026-07-17T12:00:00.000Z", idempotencyKey: "surface-automation-01" })).resolves.toMatchObject({ result: { setup: { complete: true, completedCount: 10 } } });
    await expect(call(ALICE_SUB, "get_automation_checkpoint", {})).resolves.toMatchObject({ checkpoint: { enabled: true, cadence: "twice_weekly", kind: "buildmates" } });
    await expect(call(ALICE_SUB, "get_setup_state", {})).resolves.toMatchObject({ complete: true, completedCount: 10, totalSteps: 10 });

    const personal = await call(ALICE_SUB, "submit_surface_revision", { revisionId: "caller-personal", surfaceId, baseRevisionId: revision.result.id, spec: { ...brief.customizedExample, title: "Private personal view" }, visibility: "personal_view", designBrief, designBriefApproved: true, idempotencyKey: "surface-personal-01" }) as MutationResult;
    await expect(DB.prepare("SELECT revision_id AS revision FROM personal_surface_views WHERE surface_id=? AND user_id='user_alice'").bind(surfaceId).first()).resolves.toEqual({ revision: personal.result.id });
    await expect(call(ALICE_SUB, "decide_surface_revision", { revisionId: personal.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "personal-publish-denied-01" })).rejects.toThrow("personal_view_not_publishable");
    await expect(call(ALICE_SUB, "rollback_surface", { surfaceId, revisionId: personal.result.id, expectedSurfaceVersion: 1, confirmation: "confirmed", idempotencyKey: "personal-rollback-denied-01" })).rejects.toThrow("personal_view_not_rollback_target");

    const rollback = await call(ALICE_SUB, "rollback_surface", { surfaceId, revisionId: revision.result.id, expectedSurfaceVersion: 1, confirmation: "confirmed", idempotencyKey: "surface-rollback-01" }) as { result: { revisionId: string; publicationStatus: string } };
    expect(rollback.result).toMatchObject({ revisionId: expect.stringMatching(/^surface_revision_/), publicationStatus: "published" });
    const count = await DB.prepare("SELECT COUNT(*) AS count FROM surface_revisions WHERE surface_id=?").bind(surfaceId).first<{ count: number }>();
    expect(count?.count).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it("requires every active room member to approve a shared revision and rejects outsiders", async () => {
    await DB.batch([
      DB.prepare("INSERT INTO match_pairs (id,user_a_id,user_b_id,created_at) VALUES ('room-pair','user_alice','user_bob',?)").bind(at),
      DB.prepare("INSERT INTO match_proposals (id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES ('room-proposal','room-pair',1,1,1,'manual','manual','{}','{}','matched',?,?)").bind(at + 60_000, at),
      DB.prepare("INSERT INTO matches (id,match_pair_id,proposal_id,matched_at) VALUES ('room-match','room-pair','room-proposal',?)").bind(at),
      DB.prepare("INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) VALUES ('room-connection','room-pair','room-match','active',?,?)").bind(at, at),
      DB.prepare("INSERT INTO rooms (id,match_pair_id,connection_id,status,created_at,updated_at) VALUES ('governed-room','room-pair','room-connection','active',?,?)").bind(at, at),
      DB.prepare("INSERT INTO room_memberships (room_id,user_id,joined_at) VALUES ('governed-room','user_alice',?),('governed-room','user_bob',?)").bind(at, at),
    ]);
    const repositories = createD1Repositories(DB as never);
    await seedDesignPolicy(repositories);
    await repositories.surfaces.createSurface({ actorId: "user_alice" as never, id: "room-surface", ownerUserId: "user_alice" as never, kind: "room", subjectId: "governed-room", at: new Date(at) });
    await expect(call(BOB_SUB, "get_surface_generation_brief", { surfaceId: "room-surface" })).resolves.toMatchObject({ kind: "room", allowedModules: ["room.introduction", "room.chat"], authorizedBindings: expect.arrayContaining(["room.connectionContext"]), governance: { mode: "unanimous_members", memberUserIds: ["user_alice", "user_bob"], requiredApprovals: 2 } });

    await expect(call(ALICE_SUB, "submit_surface_revision", { revisionId: "bad-base-revision", surfaceId: "room-surface", baseRevisionId: "missing-revision", spec: fieldNotesRoomSpec, visibility: "private_preview", idempotencyKey: "bad-base-revision-01" })).rejects.toThrow("surface_base_not_found");
    const revision = await call(ALICE_SUB, "submit_surface_revision", { revisionId: "room-revision", surfaceId: "room-surface", baseRevisionId: null, spec: fieldNotesRoomSpec, visibility: "private_preview", idempotencyKey: "room-revision-01" }) as MutationResult;
    await expect(call(CAROL_SUB, "decide_surface_revision", { revisionId: revision.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "room-carol-01" })).rejects.toThrow("object_not_authorized");
    await call(ALICE_SUB, "decide_surface_revision", { revisionId: revision.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "room-alice-01" });
    await expect(DB.prepare("SELECT published_revision_id AS published FROM surfaces WHERE id='room-surface'").first()).resolves.toEqual({ published: null });
    await call(BOB_SUB, "decide_surface_revision", { revisionId: revision.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "room-bob-01" });
    await expect(DB.prepare("SELECT published_revision_id AS published FROM surfaces WHERE id='room-surface'").first()).resolves.toEqual({ published: revision.result.id });
    const pendingRollback = await call(ALICE_SUB, "rollback_surface", { surfaceId: "room-surface", revisionId: revision.result.id, expectedSurfaceVersion: 1, confirmation: "confirmed", idempotencyKey: "room-rollback-pending-01" }) as { result: { revisionId: string; publicationStatus: string } };
    expect(pendingRollback.result).toMatchObject({ revisionId: expect.stringMatching(/^surface_revision_/), publicationStatus: "pending_member_approvals" });
    const bobPersonal = await call(BOB_SUB, "submit_surface_revision", { revisionId: "bob-personal-room", surfaceId: "room-surface", baseRevisionId: revision.result.id, spec: { ...fieldNotesRoomSpec, title: "Bob's private room view" }, visibility: "personal_view", idempotencyKey: "bob-personal-room-01" }) as MutationResult;
    await expect(repositories.surfaces.findRevisionForViewer(bobPersonal.result.id, "user_alice" as never)).resolves.toBeNull();
    await expect(repositories.surfaces.findRevisionForViewer(bobPersonal.result.id, "user_bob" as never)).resolves.toMatchObject({ visibility: "personal_view", authorUserId: "user_bob" });
  }, 60_000);

  it("fails Surface briefs closed for missing, inactive, unknown, empty, and departed subjects", async () => {
    const unavailable = (subject: string, surfaceId: string) => expect(call(subject, "get_surface_generation_brief", { surfaceId })).rejects.toThrow("surface_brief_unavailable");
    await DB.batch([
      DB.prepare("INSERT INTO surfaces (id,owner_user_id,kind,subject_id,governance_version,created_at,updated_at) VALUES ('missing-profile-surface','user_alice','profile','missing-profile',1,?,?)").bind(at, at),
      DB.prepare("INSERT INTO profiles (id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,created_at,updated_at) VALUES ('inactive-profile','user_alice','Alice','Summary','Project','[]','private',0,'manual',0,?,?)").bind(at, at),
      DB.prepare("INSERT INTO surfaces (id,owner_user_id,kind,subject_id,governance_version,created_at,updated_at) VALUES ('inactive-profile-surface','user_alice','profile','inactive-profile',1,?,?)").bind(at, at),
      DB.prepare("INSERT INTO surfaces (id,owner_user_id,kind,subject_id,governance_version,created_at,updated_at) VALUES ('unknown-kind-surface','user_alice','unknown','missing',1,?,?)").bind(at, at),
      DB.prepare("INSERT INTO match_pairs (id,user_a_id,user_b_id,created_at) VALUES ('closed-pair','user_alice','user_bob',?)").bind(at),
      DB.prepare("INSERT INTO match_proposals (id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES ('closed-proposal','closed-pair',1,1,1,'manual','manual','{}','{}','matched',?,?)").bind(at + 60_000, at),
      DB.prepare("INSERT INTO matches (id,match_pair_id,proposal_id,matched_at) VALUES ('closed-match','closed-pair','closed-proposal',?)").bind(at),
      DB.prepare("INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) VALUES ('closed-connection','closed-pair','closed-match','active',?,?)").bind(at, at),
      DB.prepare("INSERT INTO rooms (id,match_pair_id,connection_id,status,created_at,updated_at) VALUES ('closed-room','closed-pair','closed-connection','ended',?,?)").bind(at, at),
      DB.prepare("INSERT INTO room_memberships (room_id,user_id,joined_at,left_at) VALUES ('closed-room','user_alice',?,NULL)").bind(at),
      DB.prepare("INSERT INTO surfaces (id,owner_user_id,kind,subject_id,governance_version,created_at,updated_at) VALUES ('closed-room-surface','user_alice','room','closed-room',1,?,?)").bind(at, at),
    ]);
    await unavailable(ALICE_SUB, "missing-profile-surface");
    await unavailable(ALICE_SUB, "unknown-kind-surface");
    await DB.prepare("UPDATE users SET status='suspended' WHERE id='user_alice'").run();
    await unavailable(ALICE_SUB, "inactive-profile-surface");
    await DB.prepare("UPDATE users SET status='active' WHERE id='user_alice'").run();
    await unavailable(ALICE_SUB, "closed-room-surface");
    await DB.prepare("UPDATE rooms SET status='active' WHERE id='closed-room'").run();
    await DB.prepare("UPDATE room_memberships SET left_at=? WHERE room_id='closed-room' AND user_id='user_alice'").bind(at).run();
    await unavailable(ALICE_SUB, "closed-room-surface");

    const repositories = createD1Repositories(DB as never);
    await repositories.circles.create({ actorId: "user_alice" as never, id: "empty-admin-circle" as never, name: "Empty admin", purpose: "Fail closed", governanceMode: "admin", at: new Date(at) });
    await repositories.surfaces.createSurface({ actorId: "user_alice" as never, id: "empty-admin-surface", ownerUserId: "user_alice" as never, kind: "circle", subjectId: "empty-admin-circle", at: new Date(at) });
    await DB.prepare("UPDATE circle_memberships SET role='member' WHERE circle_id='empty-admin-circle'").run();
    await unavailable(ALICE_SUB, "empty-admin-surface");
    await DB.prepare("UPDATE circle_memberships SET status='removed' WHERE circle_id='empty-admin-circle' AND user_id='user_alice'").run();
    await unavailable(ALICE_SUB, "empty-admin-surface");
    await DB.prepare("UPDATE circles SET status='archived' WHERE id='empty-admin-circle'").run();
    await unavailable(ALICE_SUB, "empty-admin-surface");
  }, 60_000);

  it("creates a valid vote-governed Circle rollback proposal and reports pending then published", async () => {
    const repositories = createD1Repositories(DB as never);
    await seedDesignPolicy(repositories);
    await repositories.circles.create({ actorId: "user_alice" as never, id: "vote-circle" as never, name: "Retrieval builders", purpose: "Compare retrieval systems", governanceMode: "vote", at: new Date(at) });
    await repositories.circles.setMembership({ actorId: "user_alice" as never, circleId: "vote-circle" as never, userId: "user_bob" as never, role: "member", status: "active" });
    await repositories.surfaces.createSurface({ actorId: "user_alice" as never, id: "circle-surface", ownerUserId: "user_alice" as never, kind: "circle", subjectId: "vote-circle", at: new Date(at) });
    await expect(call(BOB_SUB, "get_surface_generation_brief", { surfaceId: "circle-surface" })).resolves.toMatchObject({ kind: "circle", governance: { mode: "circle_vote", eligibleVoterIds: ["user_alice", "user_bob"], approvalRule: "strict_majority" }, authorizedBindings: expect.arrayContaining(["circle.members", "circle.metrics"]) });
    const original = await call(ALICE_SUB, "submit_surface_revision", { revisionId: "circle-original", surfaceId: "circle-surface", baseRevisionId: null, spec: circleSpec(), visibility: "private_preview", idempotencyKey: "circle-original-01" }) as MutationResult;
    await call(ALICE_SUB, "decide_surface_revision", { revisionId: original.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "circle-original-alice-01" });
    await call(BOB_SUB, "decide_surface_revision", { revisionId: original.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "circle-original-bob-01" });
    await expect(DB.prepare("SELECT published_revision_id AS revision FROM surfaces WHERE id='circle-surface'").first()).resolves.toEqual({ revision: original.result.id });

    const rollback = await call(ALICE_SUB, "rollback_surface", { surfaceId: "circle-surface", revisionId: original.result.id, expectedSurfaceVersion: 1, confirmation: "confirmed", idempotencyKey: "circle-rollback-01" }) as { result: { revisionId: string; publicationStatus: string; proposalId: string } };
    expect(rollback.result).toMatchObject({ revisionId: expect.stringMatching(/^surface_revision_/), publicationStatus: "pending_circle_vote", proposalId: expect.stringMatching(/^circle_design_proposal_/) });
    await expect(DB.prepare("SELECT status,json_extract(payload_json,'$.revisionId') AS revisionId FROM circle_proposals WHERE id=?").bind(rollback.result.proposalId).first()).resolves.toEqual({ status: "voting", revisionId: rollback.result.revisionId });
    await call(BOB_SUB, "decide_surface_revision", { revisionId: rollback.result.revisionId, decision: "approved", confirmation: "confirmed", idempotencyKey: "circle-rollback-bob-01" });
    await expect(DB.prepare("SELECT published_revision_id AS revision FROM surfaces WHERE id='circle-surface'").first()).resolves.toEqual({ revision: rollback.result.revisionId });

    await repositories.circles.create({ actorId: "user_alice" as never, id: "admin-circle" as never, name: "Admin Circle", purpose: "Test admin publication", governanceMode: "admin", at: new Date(at) });
    await repositories.circles.setMembership({ actorId: "user_alice" as never, circleId: "admin-circle" as never, userId: "user_bob" as never, role: "member", status: "active" });
    await repositories.surfaces.createSurface({ actorId: "user_alice" as never, id: "admin-circle-surface", ownerUserId: "user_alice" as never, kind: "circle", subjectId: "admin-circle", at: new Date(at) });
    await expect(call(BOB_SUB, "get_surface_generation_brief", { surfaceId: "admin-circle-surface" })).resolves.toMatchObject({ kind: "circle", governance: { mode: "circle_admin", publisherUserIds: ["user_alice"], memberUserIds: ["user_alice", "user_bob"] } });
    const adminOriginal = await call(ALICE_SUB, "submit_surface_revision", { revisionId: "admin-circle-original", surfaceId: "admin-circle-surface", baseRevisionId: null, spec: circleSpec(), visibility: "private_preview", idempotencyKey: "admin-circle-original-01" }) as MutationResult;
    await call(ALICE_SUB, "decide_surface_revision", { revisionId: adminOriginal.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "admin-circle-publish-01" });
    const pendingAdmin = await call(BOB_SUB, "rollback_surface", { surfaceId: "admin-circle-surface", revisionId: adminOriginal.result.id, expectedSurfaceVersion: 1, confirmation: "confirmed", idempotencyKey: "admin-circle-rollback-01" }) as { result: { revisionId: string; publicationStatus: string } };
    expect(pendingAdmin.result).toMatchObject({ revisionId: expect.stringMatching(/^surface_revision_/), publicationStatus: "pending_admin" });
  }, 60_000);

  it("executes concurrent identical D1 idempotent operations once", async () => {
    let executions = 0;
    const repository = services.repository;
    const mutation = { actorUserId: "user_alice", operation: "concurrent", key: "same", requestHash: "hash", now: new Date(at).toISOString(), execute: async () => { executions += 1; await Promise.resolve(); return { ok: true }; } };
    const outcomes = await Promise.allSettled([repository.runIdempotent(mutation), repository.runIdempotent(mutation)]);
    expect(executions).toBe(1);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    let recoveryAttempts = 0;
    const failed = { actorUserId: "user_alice", operation: "recoverable", key: "lease", requestHash: "same", now: new Date(at).toISOString(), execute: async () => { recoveryAttempts += 1; throw new Error("transient"); } };
    await expect(repository.runIdempotent(failed)).rejects.toThrow("transient");
    await expect(repository.runIdempotent({ ...failed, execute: async () => { recoveryAttempts += 1; return "recovered"; } })).resolves.toMatchObject({ replayed: false, value: "recovered" });
    expect(recoveryAttempts).toBe(2);

    let releaseSlow!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const hold = new Promise<void>((resolve) => { releaseSlow = resolve; });
    let replacementExecutions = 0;
    const slow = repository.runIdempotent({ actorUserId: "user_alice", operation: "fenced", key: "lease", requestHash: "same", now: new Date(at).toISOString(), execute: async () => { markStarted(); await hold; await repository.write({ kind: "setup", id: "user_alice", ownerUserId: "user_alice", value: { completedSteps: ["identity_link", "storage_explanation"] }, now: new Date(at).toISOString() }); return "original"; } });
    await started;
    await expect(repository.runIdempotent({ actorUserId: "user_alice", operation: "fenced", key: "lease", requestHash: "same", now: new Date(at + 3 * 60_000).toISOString(), execute: async () => { replacementExecutions += 1; await repository.write({ kind: "setup", id: "user_alice", ownerUserId: "user_alice", value: { completedSteps: ["replacement"] }, now: new Date(at + 3 * 60_000).toISOString() }); return "replacement"; } })).rejects.toThrow("idempotency_in_progress");
    releaseSlow();
    await expect(slow).resolves.toMatchObject({ replayed: false, value: "original" });
    expect(replacementExecutions).toBe(0);
    await expect(repository.runIdempotent({ actorUserId: "user_alice", operation: "fenced", key: "lease", requestHash: "same", now: new Date(at + 3 * 60_000 + 1).toISOString(), execute: async () => "should-not-run" })).resolves.toMatchObject({ replayed: true, value: "original" });
    await expect(DB.prepare("SELECT completed_steps_json AS steps FROM setup_states WHERE user_id='user_alice'").first()).resolves.toEqual({ steps: '["identity_link","storage_explanation"]' });
  });

  async function call(subject: string, name: string, input: Record<string, unknown>) {
    return executeBuildmatesTool(name, input, subject, services);
  }

  function signal(signalId: string, idempotencyKey: string) {
    return { signalId, sourceId: "github", taxonomyVersion: "1", summary: `Canonical work ${signalId}`, canonicalTopicIds: ["topic-matching"], canonicalToolIds: [], canonicalDomainIds: [], canonicalStageIds: [], canonicalCollaborationIntentIds: [], audience: "private", allowMatching: true, expiresAt: "2026-08-01T00:00:00.000Z", approved: true, idempotencyKey };
  }

  function saveSource(subject: string, policy: string, idempotencyKey: string, supportsActions = true, approveNextWorkSignal = false) {
    return call(subject, "save_source_preference", { sourceId: "github", displayName: "GitHub", category: "projects_code", policy, supportsActions, approveNextWorkSignal, sourceOrigin: "current_conversation", idempotencyKey });
  }

  function circleSpec() {
    return {
      ...workshopProfileSpec,
      kind: "circle",
      title: "Retrieval builders Circle",
      root: { id: "circle-root", type: "section", tone: "canvas", layout: "cover", padding: "xl", bleed: true, minHeight: "viewport", background: "paper-rule", backgroundMediaBinding: null, backgroundMediaOpacity: "subtle", backgroundMediaFocalPoint: "center", children: [{ id: "circle-title", type: "heading", level: 1, binding: "surface.title", fallback: "Circle", size: "hero", align: "start", width: "balanced", weight: "black", lineHeight: "tight", tracking: "tight" }] },
      bindingManifest: { content: [{ key: "surface.title", type: "text" }], media: [] },
      decorativeRegions: [],
      accessibility: { label: "Retrieval builders Circle", primaryHeadingNodeId: "circle-title", reducedMotion: "required" },
    };
  }
});

describe("memory MCP isolation and idempotency", () => {
  it("isolates caller-selected IDs by owner, coalesces concurrent work, and retries failures", async () => {
    const repository = createMemoryMcpProductRepository();
    const now = new Date(at).toISOString();
    await repository.write({ kind: "profile_model", id: "same-client-id", ownerUserId: "user_alice", value: { name: "Alice" }, now });
    await repository.write({ kind: "profile_model", id: "same-client-id", ownerUserId: "user_bob", value: { name: "Bob" }, now });
    await expect(repository.readForMember<{ name: string }>("profile_model", "same-client-id", "user_alice")).resolves.toMatchObject({ value: { name: "Alice" } });
    await expect(repository.readForMember<{ name: string }>("profile_model", "same-client-id", "user_bob")).resolves.toMatchObject({ value: { name: "Bob" } });

    let concurrentExecutions = 0;
    const operation = { actorUserId: "user_alice", operation: "coalesce", key: "same", requestHash: "hash", now, execute: async () => { concurrentExecutions += 1; await Promise.resolve(); return { ok: true }; } };
    const [first, replay] = await Promise.all([repository.runIdempotent(operation), repository.runIdempotent(operation)]);
    expect(concurrentExecutions).toBe(1);
    expect([first.replayed, replay.replayed].sort()).toEqual([false, true]);

    let attempts = 0;
    const retryable = { actorUserId: "user_alice", operation: "retry", key: "failed", requestHash: "same-hash", now, execute: async () => { attempts += 1; if (attempts === 1) throw new Error("transient"); return "recovered"; } };
    await expect(repository.runIdempotent(retryable)).rejects.toThrow("transient");
    await expect(repository.runIdempotent(retryable)).resolves.toMatchObject({ replayed: false, value: "recovered" });
    expect(attempts).toBe(2);

    const source = await repository.write<Record<string, unknown>>({ kind: "source_policy", id: "github", ownerUserId: "user_alice", value: { policy: "ask_each_time", approveNextWorkSignal: true }, now });
    const approvalId = String(source.value.approvalId);
    await expect(repository.write({ kind: "work_signal", id: "approved-once", ownerUserId: "user_alice", value: { sourceId: "github", sourceApprovalId: approvalId, summary: "Approved once", audience: "suggested_connections" }, now })).resolves.toMatchObject({ id: "approved-once" });
    await expect(repository.write({ kind: "work_signal", id: "approval-reuse", ownerUserId: "user_alice", value: { sourceId: "github", sourceApprovalId: approvalId, summary: "Reuse", audience: "suggested_connections" }, now })).rejects.toThrow("source_approval_required");
    await repository.write({ kind: "source_policy", id: "mail", ownerUserId: "user_alice", value: { policy: "never" }, now });
    await expect(repository.write({ kind: "work_signal", id: "denied", ownerUserId: "user_alice", value: { sourceId: "mail", summary: "Denied", audience: "private" }, now })).rejects.toThrow("source_policy_denied");
  });
});

describe("MCP compatibility migration", () => {
  it("maps legacy approved_summaries rows and removes the legacy active value", async () => {
    const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    try {
      const DB = await mf.getD1Database("DB") as D1Database;
      const files = (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort();
      for (const file of files.filter((name) => name < "0010_")) {
        const sql = await readFile(`apps/web/drizzle/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await DB.prepare(statement).run();
      }
      await DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('legacy-user','active','none',?,?)").bind(at, at).run();
      await DB.prepare("INSERT INTO connected_app_preferences (id,user_id,app_id,display_name,category,access_mode,last_reviewed_at) VALUES ('legacy-pref','legacy-user','github','GitHub','projects_code','approved_summaries',?)").bind(at).run();
      const sql = await readFile("apps/web/drizzle/0010_purple_boomer.sql", "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await DB.prepare(statement).run();
      await expect(DB.prepare("SELECT access_mode AS mode FROM connected_app_preferences WHERE id='legacy-pref'").first()).resolves.toEqual({ mode: "allow_approved_work_signals" });
      await expect(DB.prepare("UPDATE connected_app_preferences SET access_mode='approved_summaries' WHERE id='legacy-pref'").run()).rejects.toThrow();
    } finally { await mf.dispose(); }
  }, 60_000);
});

type MutationResult = { replayed: boolean; result: { id: string; details: unknown } };
