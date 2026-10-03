import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chatActionSchema, type ChatAction } from "@buildmates/mcp-core";
import { performChatAction, readChatWorkspace } from "../../apps/web/src/platform/chat-operations";
import { createInviteLink } from "../../apps/web/src/discovery/service";
import { applyD1Migrations } from "../helpers/migrate-d1";

const NOW = "2026-10-02T12:00:00.000Z";
const AT = Date.parse(NOW);

describe("transport-neutral chat operations", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
      d1Databases: ["DB"],
      compatibilityDate: "2026-05-22",
    });
    DB = await mf.getD1Database("DB") as D1Database;
    await applyD1Migrations(DB);
    await seedNetwork(DB);
  });

  afterEach(async () => mf.dispose());

  it("publishes a strict action contract without actor or arbitrary command fields", () => {
    expect(chatActionSchema.safeParse({
      kind: "send_room_message",
      roomId: "room-1",
      clientMessageId: "client-message-1",
      body: "hello",
      userId: "user_bob",
    }).success).toBe(false);
    expect(chatActionSchema.safeParse({
      kind: "send_room_message",
      roomId: "room-1",
      clientMessageId: "client-message-1",
      body: "hello",
      confirmation: "confirmed",
    }).success).toBe(true);
    expect(chatActionSchema.safeParse({
      kind: "send_room_message",
      roomId: "room-1",
      clientMessageId: "client-message-1",
      body: "hello",
      idempotencyKey: "outside-wrapper-key",
    }).success).toBe(false);
    expect(chatActionSchema.safeParse({ kind: "delete_room_message", roomId: "room-1", messageId: "alice-message", confirmation: "confirmed" }).success).toBe(true);
    expect(chatActionSchema.safeParse({ kind: "delete_room_message", roomId: "room-1", messageId: "alice-message" }).success).toBe(false);
    expect(chatActionSchema.safeParse({ kind: "request_deletion", receipt: "receipt-1", confirmation: "confirmed" }).success).toBe(false);
    expect(chatActionSchema.safeParse({ kind: "propose_meeting", roomId: "room-1", clientRequestId: "meeting-request-1", startsAt: "2026-10-03T12:00:00.000Z", endsAt: "2026-10-03T13:00:00.000Z", timezone: "America/Vancouver", note: null, confirmation: "confirmed" }).success).toBe(true);
    expect(chatActionSchema.safeParse({ kind: "propose_meeting", roomId: "room-1", clientRequestId: "meeting-request-1", startsAt: "2026-10-03T12:00:00.000Z", endsAt: "2026-10-03T13:00:00.000Z", timezone: "America/Vancouver", note: null }).success).toBe(false);
  });

  it("fails closed for a non-member and only permits the message author to edit", async () => {
    await expect(readChatWorkspace(DB, { userId: "user_carol", view: "room", subjectId: "room-1", now: NOW })).rejects.toThrow("room_not_found");
    await expect(performChatAction(DB, {
      userId: "user_bob",
      action: { kind: "edit_room_message", roomId: "room-1", messageId: "alice-message", body: "squatted", confirmation: "confirmed" },
      now: NOW,
    })).rejects.toThrow("message_not_found");
    const row = await DB.prepare("SELECT body,edited_at AS editedAt FROM messages WHERE id='alice-message'").first();
    expect(row).toEqual({ body: "Alice's original message", editedAt: null });
  });

  it("persists room messages and makes the client retry safe through the canonical service", async () => {
    const action: ChatAction = {
      kind: "send_room_message",
      roomId: "room-1",
      clientMessageId: "client-message-retry-1",
      body: "A retry must not duplicate this message.",
      confirmation: "confirmed",
    };
    const first = await performChatAction(DB, { userId: "user_alice", action, now: NOW });
    const second = await performChatAction(DB, { userId: "user_alice", action, now: NOW });
    expect(first.details).toEqual(second.details);
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM messages WHERE room_id='room-1' AND sender_user_id='user_alice' AND client_message_id=?").bind(action.clientMessageId).first()).resolves.toEqual({ count: 1 });

    const workspace = await readChatWorkspace(DB, { userId: "user_alice", view: "room", subjectId: "room-1", now: NOW });
    expect(workspace).toMatchObject({ view: "room", subjectId: "room-1", nextCursor: null });
    expect((workspace.data as { messages: Array<{ body: string }> }).messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ body: "A retry must not duplicate this message." }),
    ]));
  });

  it("supports Circle creation, invitation acceptance, message retry, and message ownership", async () => {
    const created = await performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "create_circle", name: "Reliable Builders", purpose: "Compare useful agent workflows.", governanceMode: "admin", inviteeUserIds: ["user_bob"], confirmation: "confirmed" },
      now: NOW,
    });
    const circleId = (created.details as { id: string }).id;
    expect(circleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await DB.prepare("SELECT status FROM circle_memberships WHERE circle_id=? AND user_id='user_bob'").bind(circleId).first()).toEqual({ status: "invited" });

    await performChatAction(DB, {
      userId: "user_bob",
      action: { kind: "respond_circle_invite", circleId, accept: true, confirmation: "confirmed" },
      now: NOW,
    });
    expect(await DB.prepare("SELECT status FROM circles WHERE id=?").bind(circleId).first()).toEqual({ status: "active" });

    const messageAction: ChatAction = { kind: "send_circle_message", circleId, clientMessageId: "circle-message-retry-1", body: "Circle message", confirmation: "confirmed" };
    const first = await performChatAction(DB, { userId: "user_alice", action: messageAction, now: NOW });
    const second = await performChatAction(DB, { userId: "user_alice", action: messageAction, now: NOW });
    expect(first.details).toEqual(second.details);
    const messageId = (first.details as { id: string }).id;
    await performChatAction(DB, {
      userId: "user_bob",
      action: { kind: "send_circle_message", circleId, clientMessageId: "circle-message-second-1", body: "Second circle message", confirmation: "confirmed" },
      now: NOW,
    });
    await performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "send_circle_message", circleId, clientMessageId: "circle-message-third-1", body: "Third circle message", confirmation: "confirmed" },
      now: NOW,
    });
    const firstPage = await readChatWorkspace(DB, { userId: "user_bob", view: "circle_messages", subjectId: circleId, limit: 2, now: NOW });
    expect(firstPage.nextCursor).toBeTruthy();
    expect((firstPage.data as { messages: Array<{ id: string }> }).messages).toHaveLength(2);
    const secondPage = await readChatWorkspace(DB, { userId: "user_bob", view: "circle_messages", subjectId: circleId, limit: 2, cursor: firstPage.nextCursor!, now: NOW });
    expect(secondPage.nextCursor).toBeNull();
    const firstIds = (firstPage.data as { messages: Array<{ id: string }> }).messages.map((message) => message.id);
    const secondIds = (secondPage.data as { messages: Array<{ id: string }> }).messages.map((message) => message.id);
    expect(secondIds).toHaveLength(1);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(3);
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM circle_messages WHERE circle_id=? AND sender_user_id='user_alice'").bind(circleId).first()).resolves.toEqual({ count: 2 });

    await performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "edit_circle_message", circleId, messageId, body: "Edited circle message", confirmation: "confirmed" },
      now: NOW,
    });
    await expect(performChatAction(DB, {
      userId: "user_bob",
      action: { kind: "edit_circle_message", circleId, messageId, body: "Bob cannot edit Alice's message", confirmation: "confirmed" },
      now: NOW,
    })).rejects.toThrow("message_not_found");
    await expect(readChatWorkspace(DB, { userId: "user_bob", view: "circle_messages", subjectId: circleId, now: NOW })).resolves.toMatchObject({ view: "circle_messages", subjectId: circleId });
    await performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "delete_circle_message", circleId, messageId, confirmation: "confirmed" },
      now: NOW,
    });
    expect(await DB.prepare("SELECT deleted_at IS NOT NULL AS deleted FROM circle_messages WHERE id=?").bind(messageId).first()).toEqual({ deleted: 1 });
  });

  it("runs room scheduling, relationship lifecycle, and project update actions through canonical services", async () => {
    await DB.prepare("INSERT INTO projects (id,owner_user_id,slug,title,summary,audience,allow_matching,status,stage,indexable,published_at,created_at,updated_at) VALUES ('project-update-1','user_alice','agent-updates','Agent Updates','A project with updates.','public',1,'active','building',1,?,?,?)").bind(AT, AT, AT).run();
    const futureStart = "2026-10-03T12:00:00.000Z";
    const futureEnd = "2026-10-03T13:00:00.000Z";
    const availability = await performChatAction(DB, { userId: "user_alice", action: { kind: "save_availability", roomId: "room-1", clientWindowId: "window-1", startsAt: futureStart, endsAt: futureEnd, timezone: "America/Vancouver" }, now: NOW });
    expect((availability.details as { id: string }).id).toContain("availability:user_alice:");
    await expect(readChatWorkspace(DB, { userId: "user_alice", view: "room_enhancements", subjectId: "room-1", now: NOW })).resolves.toMatchObject({ data: { myAvailability: [expect.objectContaining({ status: "approved" })] } });
    const meeting = await performChatAction(DB, { userId: "user_alice", action: { kind: "propose_meeting", roomId: "room-1", clientRequestId: "meeting-request-1", startsAt: futureStart, endsAt: futureEnd, timezone: "America/Vancouver", note: "Talk about the project", confirmation: "confirmed" }, now: NOW });
    const proposalId = (meeting.details as { id: string }).id;
    await performChatAction(DB, { userId: "user_bob", action: { kind: "respond_meeting", roomId: "room-1", proposalId, response: "accepted", confirmation: "confirmed" }, now: NOW });
    await performChatAction(DB, { userId: "user_alice", action: { kind: "withdraw_availability", roomId: "room-1", windowId: (availability.details as { id: string }).id }, now: NOW });
    await performChatAction(DB, { userId: "user_alice", action: { kind: "mark_room_read", roomId: "room-1", messageId: "alice-message" }, now: NOW });
    await performChatAction(DB, { userId: "user_alice", action: { kind: "save_introduction_feedback", connectionId: "connection-1", useful: true, reasons: ["good_conversation"], similarMatchPreference: "same", followUpIntent: "keep_connected", privateNote: "Useful conversation." }, now: NOW });
    const reminder = await performChatAction(DB, { userId: "user_alice", action: { kind: "schedule_connection_reminder", connectionId: "connection-1", remindAt: futureStart }, now: NOW });
    await performChatAction(DB, { userId: "user_alice", action: { kind: "dismiss_connection_reminder", connectionId: "connection-1", reminderId: (reminder.details as { id: string }).id }, now: NOW });
    await performChatAction(DB, { userId: "user_alice", action: { kind: "acknowledge_renewed_relevance", connectionId: "connection-1" }, now: NOW });
    await performChatAction(DB, { userId: "user_alice", action: { kind: "publish_project_update", slug: "agent-updates", body: "A reviewed project update.", audience: "public", confirmation: "confirmed" }, now: NOW });
    await expect(readChatWorkspace(DB, { userId: "user_alice", view: "project_details", subjectId: "agent-updates", now: NOW })).resolves.toMatchObject({ data: { updates: [expect.objectContaining({ body: "A reviewed project update." })] } });
    await performChatAction(DB, { userId: "user_alice", action: { kind: "end_connection", connectionId: "connection-1", confirmation: "confirmed" }, now: NOW });
    const reconnect = await performChatAction(DB, { userId: "user_alice", action: { kind: "request_reconnect", connectionId: "connection-1", confirmation: "confirmed" }, now: NOW });
    const requestId = (reconnect.details as { id: string }).id;
    await performChatAction(DB, { userId: "user_bob", action: { kind: "respond_reconnect", connectionId: "connection-1", requestId, response: "accepted", confirmation: "confirmed" }, now: NOW });
    await expect(DB.prepare("SELECT state FROM connections WHERE id='connection-1'").first()).resolves.toEqual({ state: "active" });
  });

  it("keeps project collaboration reads and writes scoped to the actor", async () => {
    await DB.prepare("INSERT INTO projects (id,owner_user_id,slug,title,summary,audience,allow_matching,status,stage,indexable,published_at,created_at,updated_at) VALUES ('project-1','user_alice','agent-notes','Agent Notes','A shared project.','private',0,'draft','building',0,NULL,?,?)").bind(AT, AT).run();
    await expect(readChatWorkspace(DB, { userId: "user_bob", view: "project_collaborators", subjectId: "agent-notes", now: NOW })).rejects.toThrow("project_not_found");
    await performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "invite_project_collaborator", slug: "agent-notes", handle: "@bob_builder", role: "editor", confirmation: "confirmed" },
      now: NOW,
    });
    await expect(readChatWorkspace(DB, { userId: "user_alice", view: "project_collaborators", subjectId: "agent-notes", now: NOW })).resolves.toMatchObject({ data: { collaborators: [expect.objectContaining({ userId: "user_bob", role: "editor", approvedAt: null })] } });
    await performChatAction(DB, {
      userId: "user_bob",
      action: { kind: "respond_project_collaboration", slug: "agent-notes", accept: true, confirmation: "confirmed" },
      now: NOW,
    });
    expect(await DB.prepare("SELECT approved_at IS NOT NULL AS approved FROM project_collaborators WHERE project_id='project-1' AND user_id='user_bob'").first()).toEqual({ approved: 1 });
  });

  it("paginates bounded chat lists through the workspace adapter", async () => {
    await DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('user_dave','active','none',?,?)").bind(AT, AT).run();
    const circleOne = await performChatAction(DB, { userId: "user_alice", action: { kind: "create_circle", name: "First circle", purpose: "First", governanceMode: "admin", inviteeUserIds: [], confirmation: "confirmed" }, now: NOW });
    const circleTwo = await performChatAction(DB, { userId: "user_alice", action: { kind: "create_circle", name: "Second circle", purpose: "Second", governanceMode: "admin", inviteeUserIds: [], confirmation: "confirmed" }, now: NOW });
    const firstCircles = await readChatWorkspace(DB, { userId: "user_alice", view: "circles", limit: 1, now: NOW });
    const secondCircles = await readChatWorkspace(DB, { userId: "user_alice", view: "circles", limit: 1, cursor: firstCircles.nextCursor!, now: NOW });
    expect(firstCircles.nextCursor).toBeTruthy();
    expect((firstCircles.data as Array<{ id: string }>)[0]?.id).not.toBe((secondCircles.data as Array<{ id: string }>)[0]?.id);
    expect(new Set([circleOne.details as { id: string }, circleTwo.details as { id: string }].map((circle) => circle.id))).toHaveProperty("size", 2);

    await performChatAction(DB, { userId: "user_alice", action: { kind: "block_user", targetUserId: "user_bob", confirmation: "confirmed" }, now: NOW });
    await performChatAction(DB, { userId: "user_alice", action: { kind: "block_user", targetUserId: "user_dave", confirmation: "confirmed" }, now: NOW });
    const firstBlocked = await readChatWorkspace(DB, { userId: "user_alice", view: "blocked", limit: 1, now: NOW });
    const secondBlocked = await readChatWorkspace(DB, { userId: "user_alice", view: "blocked", limit: 1, cursor: firstBlocked.nextCursor!, now: NOW });
    expect(firstBlocked.nextCursor).toBeTruthy();
    expect((firstBlocked.data as Array<{ userId: string }>)[0]?.userId).not.toBe((secondBlocked.data as Array<{ userId: string }>)[0]?.userId);

    await createInviteLink(DB, "user_alice", { kind: "personal" });
    await createInviteLink(DB, "user_alice", { kind: "personal" });
    const firstIntroductions = await readChatWorkspace(DB, { userId: "user_alice", view: "introductions", limit: 1, now: NOW });
    expect(firstIntroductions.nextCursor).toBeTruthy();
    const secondIntroductions = await readChatWorkspace(DB, { userId: "user_alice", view: "introductions", limit: 1, cursor: firstIntroductions.nextCursor!, now: NOW });
    expect((firstIntroductions.data as { invites: Array<{ id: string }> }).invites.map((invite) => invite.id)).not.toEqual((secondIntroductions.data as { invites: Array<{ id: string }> }).invites.map((invite) => invite.id));
  });

  it("does not invite a suspended handle or transfer ownership to one", async () => {
    await DB.prepare("INSERT INTO projects (id,owner_user_id,slug,title,summary,audience,allow_matching,status,stage,indexable,published_at,created_at,updated_at) VALUES ('project-suspended','user_alice','suspended-target','Suspended Target','A shared project.','private',0,'draft','building',0,NULL,?,?)").bind(AT, AT).run();
    await DB.prepare("UPDATE users SET status='suspended' WHERE id='user_bob'").run();
    await expect(performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "invite_project_collaborator", slug: "suspended-target", handle: "@bob_builder", role: "editor", confirmation: "confirmed" },
      now: NOW,
    })).rejects.toThrow("collaborator_not_found");
    await DB.prepare("INSERT INTO project_collaborators (project_id,user_id,role,approved_at) VALUES ('project-suspended','user_bob','editor',?)").bind(AT).run();
    await expect(performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "transfer_project_ownership", slug: "suspended-target", targetUserId: "user_bob", confirmation: "confirmed" },
      now: NOW,
    })).rejects.toThrow("accepted_collaborator_required");
  });

  it("requires an actor-bound, short-lived receipt before account deletion", async () => {
    const prepared = await performChatAction(DB, { userId: "user_alice", action: { kind: "prepare_account_deletion" }, now: NOW });
    const receipt = (prepared.details as { receipt: string }).receipt;
    await expect(performChatAction(DB, {
      userId: "user_bob",
      action: { kind: "request_deletion", receipt, confirmation: "DELETE BUILDMATES" },
      now: NOW,
    })).rejects.toThrow("deletion_confirmation_expired");
    await expect(performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "request_deletion", receipt, confirmation: "DELETE BUILDMATES" },
      now: "2026-10-02T12:11:00.000Z",
    })).rejects.toThrow("deletion_confirmation_expired");
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM deletion_jobs WHERE user_id='user_alice'").first()).resolves.toEqual({ count: 0 });
  });

  it("reads and acknowledges activity through the bounded workspace surface", async () => {
    await DB.batch([
      DB.prepare("INSERT INTO notifications (id,user_id,kind,delivery,payload_json,read_at,created_at) VALUES ('notice-1','user_alice','test_notice','immediate','{}',NULL,?)").bind(AT),
      DB.prepare("INSERT INTO notifications (id,user_id,kind,delivery,payload_json,read_at,created_at) VALUES ('notice-2','user_alice','test_notice','immediate','{}',NULL,?)").bind(AT + 1),
    ]);
    const workspace = await readChatWorkspace(DB, { userId: "user_alice", view: "activity", limit: 2, now: NOW });
    expect(workspace).toMatchObject({ view: "activity" });
    expect(workspace.nextCursor).toBeNull();
    expect((workspace.data as Array<{ id: string }>).map((item) => item.id)).toEqual(["notice-2", "notice-1"]);
    await performChatAction(DB, { userId: "user_alice", action: { kind: "mark_activity_read", notificationId: "notice-1" }, now: NOW });
    await expect(DB.prepare("SELECT read_at IS NOT NULL AS read FROM notifications WHERE id='notice-1'").first()).resolves.toEqual({ read: 1 });
  });

  it("returns an in-band, bounded export page without another member's messages", async () => {
    const result = await performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "request_export", confirmation: "confirmed", section: "authoredRoomMessages", limit: 1 },
      now: NOW,
    });
    const details = result.details as { schema: string; authoredRoomMessages: Array<{ roomId: string; body: string }>; projects: unknown[]; pagination: Record<string, string | null> };
    expect(result.confirmationState).toBe("completed");
    expect(details.schema).toBe("buildmates-account-export/v1");
    expect(details.authoredRoomMessages).toEqual([{ id: "alice-message", roomId: "room-1", body: "Alice's original message", createdAt: AT, editedAt: null, deletedAt: null }]);
    expect(details.projects).toEqual([]);
    expect(details.pagination.authoredRoomMessages).toBeNull();
  });

  it("does not make an audit export page paginate itself", async () => {
    await DB.batch([
      DB.prepare("INSERT INTO audit_events(id,actor_user_id,action,object_kind,object_id,metadata_json,created_at) VALUES ('export-audit-1','user_alice','profile.updated','profile','profile-1','{}',?)").bind(AT),
      DB.prepare("INSERT INTO audit_events(id,actor_user_id,action,object_kind,object_id,metadata_json,created_at) VALUES ('export-audit-2','user_alice','project.updated','project','project-1','{}',?)").bind(AT + 1),
    ]);
    const before = await DB.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE actor_user_id='user_alice'").first<{ count: number }>();
    const first = await performChatAction(DB, { userId: "user_alice", action: { kind: "request_export", confirmation: "confirmed", limit: 1 }, now: NOW });
    const firstDetails = first.details as { pagination: Record<string, string | null> };
    const afterStart = await DB.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE actor_user_id='user_alice'").first<{ count: number }>();
    expect(Number(afterStart?.count)).toBe(Number(before?.count) + 1);
    expect(firstDetails.pagination.audit).toBeTruthy();
    await performChatAction(DB, { userId: "user_alice", action: { kind: "request_export", confirmation: "confirmed", section: "audit", cursor: firstDetails.pagination.audit!, limit: 1 }, now: NOW });
    const afterContinuation = await DB.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE actor_user_id='user_alice'").first<{ count: number }>();
    expect(Number(afterContinuation?.count)).toBe(Number(afterStart?.count));
  });

  it("limits fresh export starts while leaving paged continuation headroom", async () => {
    const start = { userId: "user_alice", action: { kind: "request_export", confirmation: "confirmed" } as const, now: NOW };
    const windowMs = 24 * 60 * 60 * 1000;
    const windowStart = Math.floor(AT / windowMs) * windowMs;
    await DB.prepare("INSERT INTO mcp_rate_limits (key,attempt_count,window_expires_at) VALUES (?,?,?)")
      .bind(`web:account_export:user_alice:${windowStart}`, 3, windowStart + windowMs).run();
    await expect(performChatAction(DB, start)).rejects.toThrow("account_export_rate_limited");

    await expect(performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "request_export", confirmation: "confirmed", section: "authoredRoomMessages", cursor: "offset:0", limit: 1 },
      now: NOW,
    })).resolves.toMatchObject({ action: "request_export", confirmationState: "completed" });
  });

  it("exports only blocks initiated by the account owner", async () => {
    await DB.prepare("INSERT INTO blocks (blocker_user_id,blocked_user_id,created_at) VALUES ('user_bob','user_alice',?)").bind(AT).run();
    const hidden = await performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "request_export", confirmation: "confirmed", section: "blocks" },
      now: NOW,
    });
    expect((hidden.details as { blocks: unknown[] }).blocks).toEqual([]);

    await DB.prepare("INSERT INTO blocks (blocker_user_id,blocked_user_id,created_at) VALUES ('user_alice','user_bob',?)").bind(AT + 1).run();
    const own = await performChatAction(DB, {
      userId: "user_alice",
      action: { kind: "request_export", confirmation: "confirmed", section: "blocks" },
      now: NOW,
    });
    expect((own.details as { blocks: Array<{ blockerUserId: string; blockedUserId: string }> }).blocks).toEqual([{ blockerUserId: "user_alice", blockedUserId: "user_bob", createdAt: AT + 1, revokedAt: null }]);
  });

  it("emits a room cursor only when another page exists", async () => {
    await DB.prepare("INSERT INTO messages (id,room_id,sender_user_id,client_message_id,body,created_at) VALUES ('bob-message','room-1','user_bob','bob-client-message','Bob''s reply',?)").bind(AT + 1).run();
    const first = await readChatWorkspace(DB, { userId: "user_alice", view: "room", subjectId: "room-1", limit: 1, now: NOW });
    expect(first.nextCursor).toBeTruthy();
    const second = await readChatWorkspace(DB, { userId: "user_alice", view: "room", subjectId: "room-1", limit: 1, cursor: first.nextCursor!, now: NOW });
    expect(second.nextCursor).toBeNull();
  });

  it("rejects malformed room cursors instead of treating them as the first page", async () => {
    await expect(readChatWorkspace(DB, { userId: "user_alice", view: "room", subjectId: "room-1", cursor: "message-id-without-timestamp", now: NOW }))
      .rejects.toThrow("invalid_room_message_cursor");
  });

  it("does not project a third party's evaluation into an introduction", async () => {
    await DB.prepare("INSERT INTO codex_evaluations (id,proposal_id,user_id,decision,reason_summary,evidence_ids_json,index_version,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind("rogue-evaluation", "proposal-1", "user_carol", "approve", "Rogue evaluation", "[]", 1, AT).run();
    const workspace = await readChatWorkspace(DB, { userId: "user_alice", view: "introductions", now: NOW });
    const matches = (workspace.data as { matches: Array<{ proposalId: string; theirEvaluation: string | null }> }).matches;
    expect(matches).toEqual([expect.objectContaining({ proposalId: "proposal-1", theirEvaluation: null })]);
  });
});

async function seedNetwork(DB: D1Database): Promise<void> {
  await DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('user_alice','active','none',?,?),('user_bob','active','none',?,?),('user_carol','active','none',?,?)").bind(AT, AT, AT, AT, AT, AT).run();
  await DB.prepare("INSERT INTO taxonomy_versions (id,version,status,created_at,activated_at) VALUES ('taxonomy-v1',1,'active',?,?)").bind(AT, AT).run();
  await DB.prepare("INSERT INTO topics (id,taxonomy_version_id,slug,label) VALUES ('topic-matching','taxonomy-v1','matching','Matching')").run();
  await DB.prepare("INSERT INTO profiles (id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at) VALUES ('profile-alice','user_alice','Alice','Alice builds useful tools.','Agent tools','[]','public',1,'manual',1,?,?,?),('profile-bob','user_bob','Bob','Bob builds thoughtful tools.','Agent tools','[]','public',1,'manual',1,?,?,?),('profile-carol','user_carol','Carol','Carol builds thoughtful tools.','Agent tools','[]','private',0,'manual',0,NULL,?,?)").bind(AT, AT, AT, AT, AT, AT, AT, AT).run();
  await DB.prepare("INSERT INTO handles (user_id,handle,normalized_handle,created_at) VALUES ('user_alice','alice_builder','alice_builder',?),('user_bob','bob_builder','bob_builder',?),('user_carol','carol_builder','carol_builder',?)").bind(AT, AT, AT).run();
  await DB.prepare("INSERT INTO match_pairs (id,user_a_id,user_b_id,created_at) VALUES ('pair-1','user_alice','user_bob',?)").bind(AT).run();
  await DB.prepare("INSERT INTO match_proposals (id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,taxonomy_version,weight_version,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,shared_explanation_json,state,expires_at,terminal_at,created_at) VALUES ('proposal-1','pair-1',1,1,1,1,1,'manual','manual','{}','{}','{}','matched',?,?,?)").bind(AT + 86_400_000, AT, AT).run();
  await DB.prepare("INSERT INTO matches (id,match_pair_id,proposal_id,matched_at) VALUES ('match-1','pair-1','proposal-1',?)").bind(AT).run();
  await DB.prepare("INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) VALUES ('connection-1','pair-1','match-1','active',?,?)").bind(AT, AT).run();
  await DB.prepare("INSERT INTO connection_sides (connection_id,user_id,muted,renewed_relevance_enabled,created_at,updated_at) VALUES ('connection-1','user_alice',0,1,?,?),('connection-1','user_bob',0,1,?,?)").bind(AT, AT, AT, AT).run();
  await DB.prepare("INSERT INTO connection_snapshots (connection_id,subject_user_id,display_name,summary,captured_at) VALUES ('connection-1','user_bob','Bob','Bob builds thoughtful tools.',?),('connection-1','user_alice','Alice','Alice builds useful tools.',?)").bind(AT, AT).run();
  await DB.prepare("INSERT INTO connection_context_snapshots (connection_id,reason,shared_context_json,theme_topic_id,captured_at) VALUES ('connection-1','Shared agent tooling','[\"agent tooling\"]',NULL,?)").bind(AT).run();
  await DB.prepare("INSERT INTO rooms (id,match_pair_id,connection_id,status,theme_topic_id,created_at,updated_at) VALUES ('room-1','pair-1','connection-1','active',NULL,?,?)").bind(AT, AT).run();
  await DB.prepare("INSERT INTO room_memberships (room_id,user_id,joined_at,left_at,last_read_message_id) VALUES ('room-1','user_alice',?,NULL,NULL),('room-1','user_bob',?,NULL,NULL)").bind(AT, AT).run();
  await DB.prepare("INSERT INTO messages (id,room_id,sender_user_id,client_message_id,body,created_at) VALUES ('alice-message','room-1','user_alice','alice-client-message','Alice''s original message',?)").bind(AT).run();
}
