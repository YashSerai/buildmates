import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  BUILD_MATES_MCP_TOOLS,
  buildmatesToolRegistry,
  chatActionSchema,
  chatWorkspaceInputSchema,
  createBuildmatesMcpServer,
  createMemoryMcpProductRepository,
  executeBuildmatesTool,
  setupPayloadSchema,
  type BuildmatesToolServices,
  type ChatAction,
} from "@buildmates/mcp-core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const NOW = "2026-10-02T12:00:00Z";
const CANONICAL_NOW = "2026-10-02T12:00:00.000Z";

function validProfile() {
  return {
    handle: "alice_builder",
    displayName: "Alice Builder",
    summary: "I build practical tools for small software teams.",
    allowMatching: true,
    acceptanceMode: "manual" as const,
    fields: [],
  };
}

function validProject(status: "draft" | "active" | "archived" = "draft") {
  return {
    slug: "retrieval-notes",
    title: "Retrieval notes",
    summary: "A small toolkit for comparing retrieval quality.",
    audience: "private" as const,
    allowMatching: true,
    stage: "exploring",
    status,
  };
}

function parse(action: unknown) {
  return chatActionSchema.safeParse(action);
}

describe("chat-first Buildmates action contract", () => {
  it("accepts the signed-up private journey and its later collaboration surfaces", () => {
    const actions: ChatAction[] = [
      { kind: "save_profile", profile: validProfile() },
      { kind: "save_project", project: validProject("draft") },
      { kind: "pause_matching", until: "2026-11-02T12:00:00Z" },
      { kind: "send_room_message", roomId: "room_alice_bob", clientMessageId: "hello-room-1", body: "Good to meet you.", confirmation: "confirmed" },
      { kind: "create_circle", name: "Retrieval builders", purpose: "Compare evaluation methods.", governanceMode: "vote", inviteeUserIds: ["user_bob"], confirmation: "confirmed" },
      { kind: "send_circle_message", circleId: "circle_retrieval", clientMessageId: "hello-circle-1", body: "Sharing a useful evaluation pattern.", confirmation: "confirmed" },
      { kind: "request_export", confirmation: "confirmed" },
      { kind: "prepare_account_deletion" },
      { kind: "request_deletion", receipt: "deletion_receipt", confirmation: "DELETE BUILDMATES" },
    ];

    for (const action of actions) {
      expect(parse(action), action.kind).toMatchObject({ success: true });
    }
  });

  it("keeps signup resume choices private when page generation and background work are declined", () => {
    expect(parse({ kind: "save_profile", profile: validProfile() }).success).toBe(true);
    expect(setupPayloadSchema.safeParse({ step: "page_preview", choice: "later" }).success).toBe(true);
    expect(setupPayloadSchema.safeParse({ step: "automation", enabled: false, cadence: "manual", sourceLivenessReviewed: true }).success).toBe(true);

    expect(setupPayloadSchema.safeParse({ step: "page_preview", choice: "later", approved: true }).success).toBe(false);
    expect(setupPayloadSchema.safeParse({ step: "automation", enabled: true, cadence: "manual", sourceLivenessReviewed: true }).success).toBe(false);
  });

  it("requires an explicit confirmation token before consequential actions", () => {
    const missingConfirmation: Array<{ kind: string; value: unknown; confirmed: unknown }> = [
      { kind: "publish_profile", value: { kind: "publish_profile" }, confirmed: { kind: "publish_profile", confirmation: "confirmed" } },
      { kind: "hide_profile", value: { kind: "hide_profile" }, confirmed: { kind: "hide_profile", confirmation: "confirmed" } },
      { kind: "save_project", value: { kind: "save_project", project: { ...validProject("active"), audience: "public" } }, confirmed: { kind: "save_project", project: { ...validProject("active"), audience: "public" }, confirmation: "confirmed" } },
      { kind: "delete_project", value: { kind: "delete_project", slug: "retrieval-notes" }, confirmed: { kind: "delete_project", slug: "retrieval-notes", confirmation: "confirmed" } },
      { kind: "delete_room_message", value: { kind: "delete_room_message", roomId: "room_alice_bob", messageId: "message_1" }, confirmed: { kind: "delete_room_message", roomId: "room_alice_bob", messageId: "message_1", confirmation: "confirmed" } },
      { kind: "invite_project_collaborator", value: { kind: "invite_project_collaborator", slug: "retrieval-notes", handle: "@bob_builder", role: "editor" }, confirmed: { kind: "invite_project_collaborator", slug: "retrieval-notes", handle: "@bob_builder", role: "editor", confirmation: "confirmed" } },
      { kind: "respond_project_collaboration", value: { kind: "respond_project_collaboration", slug: "retrieval-notes", accept: true }, confirmed: { kind: "respond_project_collaboration", slug: "retrieval-notes", accept: true, confirmation: "confirmed" } },
      { kind: "accept_invite", value: { kind: "accept_invite", token: "invite-token-123456" }, confirmed: { kind: "accept_invite", token: "invite-token-123456", confirmation: "confirmed" } },
      { kind: "send_room_message", value: { kind: "send_room_message", roomId: "room_alice_bob", clientMessageId: "hello-room-1", body: "Good to meet you." }, confirmed: { kind: "send_room_message", roomId: "room_alice_bob", clientMessageId: "hello-room-1", body: "Good to meet you.", confirmation: "confirmed" } },
      { kind: "edit_room_message", value: { kind: "edit_room_message", roomId: "room_alice_bob", messageId: "message_1", body: "Edited message" }, confirmed: { kind: "edit_room_message", roomId: "room_alice_bob", messageId: "message_1", body: "Edited message", confirmation: "confirmed" } },
      { kind: "create_circle", value: { kind: "create_circle", name: "Retrieval builders", purpose: "Compare evaluation methods.", governanceMode: "vote", inviteeUserIds: [] }, confirmed: { kind: "create_circle", name: "Retrieval builders", purpose: "Compare evaluation methods.", governanceMode: "vote", inviteeUserIds: [], confirmation: "confirmed" } },
      { kind: "invite_circle_member", value: { kind: "invite_circle_member", circleId: "circle_retrieval", targetUserId: "user_bob" }, confirmed: { kind: "invite_circle_member", circleId: "circle_retrieval", targetUserId: "user_bob", confirmation: "confirmed" } },
      { kind: "respond_circle_invite", value: { kind: "respond_circle_invite", circleId: "circle_retrieval", accept: true }, confirmed: { kind: "respond_circle_invite", circleId: "circle_retrieval", accept: true, confirmation: "confirmed" } },
      { kind: "manage_circle_member", value: { kind: "manage_circle_member", circleId: "circle_retrieval", targetUserId: "user_bob", memberAction: "promote" }, confirmed: { kind: "manage_circle_member", circleId: "circle_retrieval", targetUserId: "user_bob", memberAction: "promote", confirmation: "confirmed" } },
      { kind: "create_circle_proposal", value: { kind: "create_circle_proposal", circleId: "circle_retrieval", proposalKind: "request", payload: { change: "Add a decision log", outcome: "Keep work visible" } }, confirmed: { kind: "create_circle_proposal", circleId: "circle_retrieval", proposalKind: "request", payload: { change: "Add a decision log", outcome: "Keep work visible" }, confirmation: "confirmed" } },
      { kind: "send_circle_message", value: { kind: "send_circle_message", circleId: "circle_retrieval", clientMessageId: "hello-circle-1", body: "Sharing a useful evaluation pattern." }, confirmed: { kind: "send_circle_message", circleId: "circle_retrieval", clientMessageId: "hello-circle-1", body: "Sharing a useful evaluation pattern.", confirmation: "confirmed" } },
      { kind: "edit_circle_message", value: { kind: "edit_circle_message", circleId: "circle_retrieval", messageId: "message_1", body: "Edited Circle message" }, confirmed: { kind: "edit_circle_message", circleId: "circle_retrieval", messageId: "message_1", body: "Edited Circle message", confirmation: "confirmed" } },
      { kind: "propose_room_upgrade", value: { kind: "propose_room_upgrade", roomId: "room_alice_bob", modules: ["decision_log"], explanation: "Keep decisions visible" }, confirmed: { kind: "propose_room_upgrade", roomId: "room_alice_bob", modules: ["decision_log"], explanation: "Keep decisions visible", confirmation: "confirmed" } },
      { kind: "end_connection", value: { kind: "end_connection", connectionId: "connection_1" }, confirmed: { kind: "end_connection", connectionId: "connection_1", confirmation: "confirmed" } },
      { kind: "delete_circle_message", value: { kind: "delete_circle_message", circleId: "circle_retrieval", messageId: "message_1" }, confirmed: { kind: "delete_circle_message", circleId: "circle_retrieval", messageId: "message_1", confirmation: "confirmed" } },
      { kind: "vote_circle_proposal", value: { kind: "vote_circle_proposal", circleId: "circle_retrieval", proposalId: "proposal_1", vote: "approve" }, confirmed: { kind: "vote_circle_proposal", circleId: "circle_retrieval", proposalId: "proposal_1", vote: "approve", confirmation: "confirmed" } },
      { kind: "publish_circle_proposal", value: { kind: "publish_circle_proposal", circleId: "circle_retrieval", proposalId: "proposal_1" }, confirmed: { kind: "publish_circle_proposal", circleId: "circle_retrieval", proposalId: "proposal_1", confirmation: "confirmed" } },
      { kind: "leave_circle", value: { kind: "leave_circle", circleId: "circle_retrieval" }, confirmed: { kind: "leave_circle", circleId: "circle_retrieval", confirmation: "confirmed" } },
      { kind: "block_user", value: { kind: "block_user", targetUserId: "user_bob" }, confirmed: { kind: "block_user", targetUserId: "user_bob", confirmation: "confirmed" } },
      { kind: "report_target", value: { kind: "report_target", targetKind: "user", targetId: "user_bob", reasonCode: "privacy" }, confirmed: { kind: "report_target", targetKind: "user", targetId: "user_bob", reasonCode: "privacy", confirmation: "confirmed" } },
      { kind: "delete_work_signal", value: { kind: "delete_work_signal", signalId: "signal_1" }, confirmed: { kind: "delete_work_signal", signalId: "signal_1", confirmation: "confirmed" } },
      { kind: "disable_autopilot", value: { kind: "disable_autopilot" }, confirmed: { kind: "disable_autopilot", confirmation: "confirmed" } },
      { kind: "disconnect_all", value: { kind: "disconnect_all" }, confirmed: { kind: "disconnect_all", confirmation: "confirmed" } },
      { kind: "redact_shared_context", value: { kind: "redact_shared_context" }, confirmed: { kind: "redact_shared_context", confirmation: "confirmed" } },
      { kind: "request_export", value: { kind: "request_export" }, confirmed: { kind: "request_export", confirmation: "confirmed" } },
    ];

    for (const entry of missingConfirmation) {
      expect(parse(entry.value), `${entry.kind} without confirmation`).toMatchObject({ success: false });
      expect(parse(entry.confirmed), `${entry.kind} with confirmation`).toMatchObject({ success: true });
    }

    expect(parse({ kind: "request_deletion", receipt: "deletion_receipt", confirmation: "confirmed" }).success).toBe(false);
    expect(parse({ kind: "request_deletion", receipt: "deletion_receipt", confirmation: "DELETE BUILDMATES" }).success).toBe(true);
  });

  it("keeps actor, host, routing, and arbitrary command fields outside the action envelope", () => {
    expect(parse({ kind: "save_profile", profile: validProfile(), userId: "user_bob" }).success).toBe(false);
    expect(parse({ kind: "save_profile", profile: validProfile(), mcpSubject: "host_subject" }).success).toBe(false);
    expect(parse({ kind: "send_room_message", roomId: "room_alice_bob", clientMessageId: "hello-room-1", body: "hi", route: "/api/admin" }).success).toBe(false);
    expect(parse({ kind: "save_profile", profile: validProfile(), command: "DROP TABLE users" }).success).toBe(false);
  });
});

describe("chat workspace read contract", () => {
  it("accepts only the bounded, authenticated workspace request shape", () => {
    for (const view of [
      "account", "profile", "projects", "connections", "connection", "room", "circles", "circle", "circle_messages",
      "activity", "blocked", "sources", "signals", "moderation", "project_collaborators",
    ] as const) {
      const result = chatWorkspaceInputSchema.safeParse({ view, now: NOW, limit: 50 });
      expect(result, view).toMatchObject({ success: true });
    }

    expect(chatWorkspaceInputSchema.safeParse({ view: "profile", now: NOW, userId: "user_bob" }).success).toBe(false);
    expect(chatWorkspaceInputSchema.safeParse({ view: "profile", now: NOW, route: "/internal/db" }).success).toBe(false);
    expect(chatWorkspaceInputSchema.safeParse({ view: "profile", now: NOW, mcpSubject: "host_subject" }).success).toBe(false);
    expect(chatWorkspaceInputSchema.safeParse({ view: "profile", now: "tomorrow" }).success).toBe(false);
    expect(chatWorkspaceInputSchema.safeParse({ view: "profile", now: NOW, limit: 101 }).success).toBe(false);
  });
});

describe("authenticated ChatGPT/Codex tool boundary", () => {
  it("wires both bounded chat adapters into the external delegated route", async () => {
    const route = await readFile(new URL("../../apps/web/app/api/internal/mcp-data/route.ts", import.meta.url), "utf8");
    expect(route).toMatch(/import\s*\{[^}]*readChatWorkspace[^}]*\}\s*from\s*["']@\/src\/platform\/chat-operations["']/s);
    expect(route).toMatch(/import\s*\{[^}]*performChatAction[^}]*\}\s*from\s*["']@\/src\/platform\/chat-operations["']/s);
    expect(route).toMatch(/readChatWorkspace\s*:\s*\(?\s*input\s*\)?\s*=>\s*readChatWorkspace\(DB,\s*input\)/s);
    expect(route).toMatch(/performChatAction\s*:\s*\(?\s*input\s*\)?\s*=>\s*performChatAction\(DB,\s*input,\s*ASSETS\)/s);
  });

  function fixture() {
    const repository = createMemoryMcpProductRepository();
    const reads: Array<Record<string, unknown>> = [];
    const writes: Array<Record<string, unknown>> = [];
    const services: BuildmatesToolServices = {
      linkBaseUrl: "https://buildmates.example",
      repository,
      now: () => new Date(NOW),
      completeIdentityLink: async () => ({ linked: false, reason: "invalid_or_expired" }),
      allowAttempt: async () => true,
      resolveLinkedUser: async ({ mcpSubject }) => mcpSubject === "chat_subject_alice_1" ? { userId: "user_alice" } : null,
      validateTaxonomy: async () => true,
      readChatWorkspace: async (input) => {
        reads.push(input as unknown as Record<string, unknown>);
        return { view: input.view, subjectId: input.subjectId, data: { ownerUserId: input.userId }, nextCursor: null, generatedAt: input.now };
      },
      performChatAction: async (input) => {
        writes.push(input as unknown as Record<string, unknown>);
        return { action: input.action.kind, confirmationState: "persisted", details: { ownerUserId: input.userId } };
      },
    };
    return { services, reads, writes };
  }

  it("registers one read and one consequential write with the MCP Apps surface", async () => {
    const { services } = fixture();
    expect(BUILD_MATES_MCP_TOOLS.filter((name) => name === "get_buildmates_workspace")).toHaveLength(1);
    expect(BUILD_MATES_MCP_TOOLS.filter((name) => name === "perform_buildmates_action")).toHaveLength(1);
    expect(buildmatesToolRegistry.find((tool) => tool.name === "get_buildmates_workspace")?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(buildmatesToolRegistry.find((tool) => tool.name === "perform_buildmates_action")?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });

    const server = createBuildmatesMcpServer(services);
    const client = new Client({ name: "chat-plugin-contract", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    const readTool = listed.tools.find((tool) => tool.name === "get_buildmates_workspace") as (typeof listed.tools)[number] & { _meta?: Record<string, unknown> };
    const writeTool = listed.tools.find((tool) => tool.name === "perform_buildmates_action") as (typeof listed.tools)[number] & { _meta?: Record<string, unknown> };
    expect(readTool._meta).toMatchObject({ ui: { resourceUri: "ui://buildmates/workspace/v1.html" }, "openai/outputTemplate": "ui://buildmates/workspace/v1.html" });
    expect(writeTool.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(writeTool._meta).toMatchObject({ "buildmates/consequential": true, "buildmates/confirmationRequired": true, ui: { visibility: ["model", "app"] } });
    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toContain("ui://buildmates/workspace/v1.html");
    await client.close();
    await server.close();
  });

  it("injects the linked actor, supplies the server clock, and replays an identical write once", async () => {
    const { services, reads, writes } = fixture();
    const read = await executeBuildmatesTool("get_buildmates_workspace", { view: "profile", limit: 20, workspaceScope: "global" }, "chat_subject_alice_1", services);
    expect(read).toMatchObject({ view: "profile", data: { ownerUserId: "user_alice" }, generatedAt: CANONICAL_NOW });
    expect(reads[0]).toMatchObject({ view: "profile", userId: "user_alice", now: CANONICAL_NOW });
    expect(reads[0]).not.toHaveProperty("mcpSubject");

    const input = {
      action: { kind: "save_profile", profile: validProfile() },
      workspaceScope: "global",
      idempotencyKey: "chat-private-profile-1",
    };
    const first = await executeBuildmatesTool("perform_buildmates_action", input, "chat_subject_alice_1", services);
    const second = await executeBuildmatesTool("perform_buildmates_action", input, "chat_subject_alice_1", services);
    expect(first).toMatchObject({ replayed: false, result: { action: "save_profile", confirmationState: "persisted", details: { ownerUserId: "user_alice" } } });
    expect(second).toMatchObject({ replayed: true, result: { action: "save_profile" } });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ userId: "user_alice", now: CANONICAL_NOW, action: { kind: "save_profile" } });
    expect(writes[0]).not.toHaveProperty("mcpSubject");
  });

  it("fails closed before linking and when a caller attempts to widen scope", async () => {
    const { services } = fixture();
    await expect(executeBuildmatesTool("get_buildmates_workspace", { view: "profile" }, "unlinked_chat_subject", services)).rejects.toThrow("identity_link_required");
    await expect(executeBuildmatesTool("perform_buildmates_action", { action: { kind: "save_profile", profile: validProfile() }, idempotencyKey: "chat-private-profile-2", workspaceScope: "tenant-acme" }, "chat_subject_alice_1", services)).rejects.toThrow("invalid_workspace_scope");
    await expect(executeBuildmatesTool("perform_buildmates_action", { action: { kind: "save_profile", profile: validProfile(), userId: "user_bob" }, idempotencyKey: "chat-private-profile-3" }, "chat_subject_alice_1", services)).rejects.toThrow();
  });
});
