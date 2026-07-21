import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createD1Repositories } from "@buildmates/database";
import { createD1McpProductRepository, executeBuildmatesTool, type BuildmatesToolServices } from "@buildmates/mcp-core";
import { seedDesignPolicy } from "@buildmates/surfaces";

const ALICE_SUB = "mcp_subject_alice_shared_v3";
const BOB_SUB = "mcp_subject_bob_shared_v3__";
const at = Date.parse("2026-07-21T12:00:00.000Z");

describe("canonical shared GeneratedSiteBundle v3 surfaces", () => {
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
    await DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('user_alice','active','none',?,?),('user_bob','active','none',?,?)").bind(at, at, at, at).run();
    await DB.prepare("INSERT INTO taxonomy_versions (id,version,status,created_at,activated_at) VALUES ('taxonomy-v1',1,'active',?,?)").bind(at, at).run();
    await DB.prepare("INSERT INTO topics (id,taxonomy_version_id,slug,label) VALUES ('topic-rag','taxonomy-v1','rag','RAG')").run();
    await seedDesignPolicy(createD1Repositories(DB as never));
    const links = new Map([[ALICE_SUB, "user_alice"], [BOB_SUB, "user_bob"]]);
    services = {
      linkBaseUrl: "https://buildmates.example",
      repository: createD1McpProductRepository(DB),
      now: () => new Date(at),
      completeIdentityLink: async () => ({ linked: false, reason: "invalid_or_expired" }),
      allowAttempt: async () => true,
      resolveLinkedUser: async ({ mcpSubject }) => links.has(mcpSubject) ? { userId: links.get(mcpSubject)! } : null,
      validateTaxonomy: async () => true,
    };
  });

  afterEach(async () => mf.dispose());

  it("briefs, validates, previews, and unanimously publishes a room v3 page without exposing raw messages", async () => {
    await seedRoom("governed-room", "room-surface");
    await DB.prepare("INSERT INTO messages (id,room_id,sender_user_id,client_message_id,body,created_at) VALUES ('secret-message','governed-room','user_alice','secret-client','RAW MESSAGE MUST STAY OUT',?)").bind(at).run();

    const brief = await call(BOB_SUB, "get_surface_generation_brief", { surfaceId: "room-surface" }) as SharedBrief;
    expect(brief).toMatchObject({
      kind: "room",
      generatedSiteReference: { format: "GeneratedSiteBundle v3" },
      customizedExample: { schemaVersion: "3", kind: "room" },
      governance: { mode: "unanimous_members", memberUserIds: ["user_alice", "user_bob"], requiredApprovals: 2 },
      authorizedBindings: ["room.title", "room.whyTitle", "room.whyBody", "room.sharedFacts", "room.privacyNote"],
    });
    expect(JSON.stringify(brief)).not.toContain("RAW MESSAGE MUST STAY OUT");
    expect(brief.authorizedContent).not.toHaveProperty("room.messages");
    expect(brief.authorizedContent).not.toHaveProperty("room.messageSummaries");
    await expect(call(ALICE_SUB, "validate_surface_spec", { surfaceId: "room-surface", spec: brief.customizedExample })).resolves.toEqual({ valid: true, issues: [] });
    const rawMessageAttempt = structuredClone(brief.customizedExample);
    rawMessageAttempt.document.html = rawMessageAttempt.document.html.replace("</main>", "<p>{{room.messages}}</p></main>");
    rawMessageAttempt.bindingManifest.content.push({ key: "room.messages", type: "strings" });
    await expect(call(ALICE_SUB, "validate_surface_spec", { surfaceId: "room-surface", spec: rawMessageAttempt })).resolves.toMatchObject({ valid: false, issues: [expect.objectContaining({ path: "bindingManifest" })] });

    const revision = await call(ALICE_SUB, "submit_surface_revision", { revisionId: "room-v3-revision", surfaceId: "room-surface", baseRevisionId: null, spec: brief.customizedExample, visibility: "private_preview", idempotencyKey: "room-v3-revision-01" }) as MutationResult;
    expect(revision.result).toMatchObject({ previewUrl: "https://buildmates.example/rooms/governed-room" });
    await expect(DB.prepare("SELECT visibility,status FROM surface_revisions WHERE id=?").bind(revision.result.id).first()).resolves.toMatchObject({ visibility: "private_preview", status: "draft" });
    await expect(DB.prepare("SELECT published_revision_id AS published FROM surfaces WHERE id='room-surface'").first()).resolves.toEqual({ published: null });

    await call(ALICE_SUB, "decide_surface_revision", { revisionId: revision.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "room-v3-alice-approval" });
    await expect(DB.prepare("SELECT published_revision_id AS published FROM surfaces WHERE id='room-surface'").first()).resolves.toEqual({ published: null });
    await call(BOB_SUB, "decide_surface_revision", { revisionId: revision.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: "room-v3-bob-approval" });
    await expect(DB.prepare("SELECT published_revision_id AS published FROM surfaces WHERE id='room-surface'").first()).resolves.toEqual({ published: revision.result.id });
  }, 60_000);

  it("keeps Circle v3 previews private and enforces admin and strict-majority vote publication", async () => {
    const repositories = createD1Repositories(DB as never);
    for (const [circleId, surfaceId, governanceMode] of [["admin-circle", "admin-circle-surface", "admin"], ["vote-circle", "vote-circle-surface", "vote"]] as const) {
      await repositories.circles.create({ actorId: "user_alice" as never, id: circleId as never, name: `${governanceMode} builders`, purpose: "Govern a generated shared page", governanceMode, at: new Date(at) });
      await repositories.circles.setMembership({ actorId: "user_alice" as never, circleId: circleId as never, userId: "user_bob" as never, role: "member", status: "active" });
      await repositories.surfaces.createSurface({ actorId: "user_alice" as never, id: surfaceId, ownerUserId: "user_alice" as never, kind: "circle", subjectId: circleId, at: new Date(at) });

      const brief = await call(BOB_SUB, "get_surface_generation_brief", { surfaceId }) as SharedBrief;
      expect(brief).toMatchObject({ kind: "circle", customizedExample: { schemaVersion: "3", kind: "circle" } });
      expect(brief.governance.mode).toBe(governanceMode === "admin" ? "circle_admin" : "circle_vote");
      await expect(call(BOB_SUB, "validate_surface_spec", { surfaceId, spec: brief.customizedExample })).resolves.toEqual({ valid: true, issues: [] });
      const revision = await call(BOB_SUB, "submit_surface_revision", { revisionId: `${governanceMode}-circle-v3`, surfaceId, baseRevisionId: null, spec: brief.customizedExample, visibility: "private_preview", idempotencyKey: `${governanceMode}-circle-v3-01` }) as MutationResult;
      expect(revision.result.previewUrl).toBe(`https://buildmates.example/circles/${circleId}?design=preview`);
      await expect(DB.prepare("SELECT published_revision_id AS published FROM surfaces WHERE id=?").bind(surfaceId).first()).resolves.toEqual({ published: null });

      await call(BOB_SUB, "decide_surface_revision", { revisionId: revision.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: `${governanceMode}-circle-bob-approval` });
      await expect(DB.prepare("SELECT published_revision_id AS published FROM surfaces WHERE id=?").bind(surfaceId).first()).resolves.toEqual({ published: null });
      await call(ALICE_SUB, "decide_surface_revision", { revisionId: revision.result.id, decision: "approved", confirmation: "confirmed", idempotencyKey: `${governanceMode}-circle-alice-approval` });
      await expect(DB.prepare("SELECT published_revision_id AS published FROM surfaces WHERE id=?").bind(surfaceId).first()).resolves.toEqual({ published: revision.result.id });
    }
  }, 60_000);

  it("exposes an R2 image to a shared brief only after an active member explicitly attaches it", async () => {
    await seedRoom("asset-room", "asset-room-surface");
    const digest = "a".repeat(64);
    const assetId = "asset_sharedroom123";
    const src = `/api/surface-assets/user_alice/${digest}.png`;
    await DB.prepare("INSERT INTO surface_assets (id,owner_user_id,object_key,content_type,byte_size,sha256,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(assetId, "user_alice", `surface-assets/user_alice/${digest}.png`, "image/png", 512, digest, at).run();

    const before = await call(ALICE_SUB, "get_surface_generation_brief", { surfaceId: "asset-room-surface" }) as SharedBrief;
    expect(before.authorizedMedia).toEqual([]);
    expect(before.approvedAssets).toEqual([]);
    await call(ALICE_SUB, "attach_surface_media", { attachmentId: "attachment-room-image", surfaceId: "asset-room-surface", assetId, altText: "A shared retrieval architecture sketch", idempotencyKey: "attach-room-image-01" });

    const brief = await call(BOB_SUB, "get_surface_generation_brief", { surfaceId: "asset-room-surface" }) as SharedBrief;
    const media = brief.authorizedMedia[0];
    expect(media).toMatchObject({ key: `surface.media.${assetId}`, altKey: `surface.media.${assetId}.alt`, approvedAssetIds: [assetId] });
    expect(brief.approvedAssets).toEqual([{ id: assetId, src }]);
    expect(brief.authorizedContent[media.altKey]).toBe("A shared retrieval architecture sketch");
    expect(brief.customizedExample.document.html).toContain(`<img src="${src}" alt="{{${media.altKey}}}"`);
    expect(brief.customizedExample.bindingManifest.media).toEqual([{ key: media.key, altKey: media.altKey, approvedAssetIds: [assetId], authorization: "surface-approved" }]);
    await expect(call(BOB_SUB, "validate_surface_spec", { surfaceId: "asset-room-surface", spec: brief.customizedExample })).resolves.toEqual({ valid: true, issues: [] });
    const revision = await call(BOB_SUB, "submit_surface_revision", { revisionId: "asset-room-v3", surfaceId: "asset-room-surface", baseRevisionId: null, spec: brief.customizedExample, visibility: "private_preview", idempotencyKey: "asset-room-v3-01" }) as MutationResult;
    expect(revision.result.previewUrl).toBe("https://buildmates.example/rooms/asset-room");
  }, 60_000);

  async function seedRoom(roomId: string, surfaceId: string) {
    const pairId = `${roomId}-pair`;
    const proposalId = `${roomId}-proposal`;
    const matchId = `${roomId}-match`;
    const connectionId = `${roomId}-connection`;
    await DB.batch([
      DB.prepare("INSERT INTO match_pairs (id,user_a_id,user_b_id,created_at) VALUES (?,?,?,?)").bind(pairId, "user_alice", "user_bob", at),
      DB.prepare("INSERT INTO match_proposals (id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES (?,?,1,1,1,'manual','manual','{}','{}','matched',?,?)").bind(proposalId, pairId, at + 60_000, at),
      DB.prepare("INSERT INTO matches (id,match_pair_id,proposal_id,matched_at) VALUES (?,?,?,?)").bind(matchId, pairId, proposalId, at),
      DB.prepare("INSERT INTO connections (id,match_pair_id,match_id,state,created_at,updated_at) VALUES (?,?,?,'active',?,?)").bind(connectionId, pairId, matchId, at, at),
      DB.prepare("INSERT INTO connection_context_snapshots (connection_id,reason,shared_context_json,theme_topic_id,captured_at) VALUES (?,?,?,?,?)").bind(connectionId, "Both builders are testing retrieval systems", JSON.stringify(["RAG evaluation", "Agent reliability"]), "topic-rag", at),
      DB.prepare("INSERT INTO connection_snapshots (connection_id,subject_user_id,display_name,summary,captured_at) VALUES (?,?,?,?,?),(?,?,?,?,?)").bind(connectionId, "user_alice", "Alice", "Builds RAG evaluation systems", at, connectionId, "user_bob", "Bob", "Builds reliable agents", at),
      DB.prepare("INSERT INTO rooms (id,match_pair_id,connection_id,status,theme_topic_id,created_at,updated_at) VALUES (?,?,?,'active','topic-rag',?,?)").bind(roomId, pairId, connectionId, at, at),
      DB.prepare("INSERT INTO room_memberships (room_id,user_id,joined_at,left_at) VALUES (?, 'user_alice', ?, NULL),(?, 'user_bob', ?, NULL)").bind(roomId, at, roomId, at),
    ]);
    await createD1Repositories(DB as never).surfaces.createSurface({ actorId: "user_alice" as never, id: surfaceId, ownerUserId: "user_alice" as never, kind: "room", subjectId: roomId, at: new Date(at) });
  }

  async function call(subject: string, name: string, input: Record<string, unknown>) {
    return executeBuildmatesTool(name, input, subject, services);
  }
});

type SharedBrief = {
  kind: "room" | "circle";
  authorizedBindings: string[];
  authorizedContent: Record<string, unknown>;
  authorizedMedia: Array<{ key: string; altKey: string; approvedAssetIds: string[] }>;
  approvedAssets: Array<{ id: string; src: string }>;
  governance: Record<string, unknown>;
  generatedSiteReference: { format: string };
  customizedExample: {
    schemaVersion: "3";
    kind: "room" | "circle";
    document: { html: string; css: string };
    bindingManifest: { content: Array<{ key: string; type: string }>; media: Array<{ key: string; altKey: string; approvedAssetIds: string[]; authorization: "surface-approved" }> };
    approvedAssets: Array<{ id: string; src: string }>;
  };
};

type MutationResult = { replayed: boolean; result: { id: string; previewUrl: string } };
