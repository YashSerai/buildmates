import { createD1Repositories } from "@buildmates/database";
import type { UserId } from "@buildmates/domain";
import {
  DESIGN_POLICY_ACTIVATED_AT,
  DESIGN_POLICY_ID,
  DESIGN_POLICY_SOURCE,
  DESIGN_POLICY_SOURCE_HASH,
  DESIGN_POLICY_VERSION,
  parseSurfaceSpecJson,
} from "@buildmates/surfaces";
import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { consumeWebRateLimit } from "@/src/security/rate-limit";

type RoomSurface = {
  id: string;
  governanceVersion: number;
  publishedRevisionId: string | null;
  publishedRevisionNumber: number | null;
};

async function roomSurface(DB: D1Database, roomId: string, userId: string): Promise<RoomSurface> {
  const membership = await DB.prepare(`SELECT room.status, surface.id, surface.governance_version AS governanceVersion,
      surface.published_revision_id AS publishedRevisionId, published.revision_number AS publishedRevisionNumber
    FROM rooms room
    JOIN room_memberships membership ON membership.room_id=room.id AND membership.user_id=? AND membership.left_at IS NULL
    LEFT JOIN surfaces surface ON surface.kind='room' AND surface.subject_id=room.id
    LEFT JOIN surface_revisions published ON published.id=surface.published_revision_id
    WHERE room.id=? AND NOT EXISTS (
      SELECT 1 FROM room_memberships other
      JOIN blocks block ON block.revoked_at IS NULL AND ((block.blocker_user_id=? AND block.blocked_user_id=other.user_id) OR (block.blocked_user_id=? AND block.blocker_user_id=other.user_id))
      WHERE other.room_id=room.id AND other.left_at IS NULL AND other.user_id<>?
    ) LIMIT 1`).bind(userId, roomId, userId, userId, userId).first<RoomSurface & { status: string }>();
  if (!membership || membership.status !== "active") throw new Error("room_not_found");
  if (membership.id) return membership;

  const repositories = createD1Repositories(DB);
  const id = `surface_room_${roomId}`;
  const actorId = userId as UserId;
  await seedPolicy(DB);
  try {
    await repositories.surfaces.createSurface({
      actorId,
      id,
      ownerUserId: actorId,
      kind: "room",
      subjectId: roomId,
      at: new Date(),
    });
  } catch (error) {
    const existing = await DB.prepare("SELECT id FROM surfaces WHERE kind='room' AND subject_id=?").bind(roomId).first();
    if (!existing) throw error;
  }
  const created = await DB.prepare(`SELECT s.id,s.governance_version AS governanceVersion,s.published_revision_id AS publishedRevisionId,
      r.revision_number AS publishedRevisionNumber
    FROM surfaces s LEFT JOIN surface_revisions r ON r.id=s.published_revision_id
    WHERE s.kind='room' AND s.subject_id=? LIMIT 1`).bind(roomId).first<RoomSurface>();
  if (!created) throw new Error("surface_unavailable");
  return created;
}

async function seedPolicy(DB: D1Database) {
  const activatedAt = new Date(DESIGN_POLICY_ACTIVATED_AT).getTime();
  await DB.prepare("INSERT OR IGNORE INTO design_policies (id,version,source_hash,policy_json,activated_at,created_at) VALUES (?,?,?,?,?,?)")
    .bind(DESIGN_POLICY_ID, DESIGN_POLICY_VERSION, DESIGN_POLICY_SOURCE_HASH, DESIGN_POLICY_SOURCE, activatedAt, activatedAt).run();
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const [user, { DB }] = await Promise.all([requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  try {
    const { id } = await params;
    const surface = await roomSurface(DB, id, user.id);
    const [context, memberCount, history] = await Promise.all([
      DB.prepare(`SELECT p.display_name AS otherName,context.reason,context.shared_context_json AS sharedContextJson
        FROM rooms room
        JOIN room_memberships other_membership ON other_membership.room_id=room.id AND other_membership.user_id<>? AND other_membership.left_at IS NULL
        JOIN profiles p ON p.user_id=other_membership.user_id
        LEFT JOIN connection_context_snapshots context ON context.connection_id=room.connection_id
        WHERE room.id=? LIMIT 1`).bind(user.id, id).first<{ otherName: string; reason: string | null; sharedContextJson: string | null }>(),
      DB.prepare("SELECT count(*) AS count FROM room_memberships WHERE room_id=? AND left_at IS NULL").bind(id).first<{ count: number }>(),
      DB.prepare(`SELECT revision.id,revision.revision_number AS revisionNumber,revision.base_revision_number AS baseRevisionNumber,
          revision.author_user_id AS authorUserId,profile.display_name AS authorName,revision.status,revision.spec_json AS spec,
          revision.created_at AS createdAt,approval.decision AS myDecision,
          (SELECT count(*) FROM surface_approvals accepted WHERE accepted.revision_id=revision.id AND accepted.governance_version=? AND accepted.decision='approved') AS approvalCount
        FROM surface_revisions revision
        JOIN profiles profile ON profile.user_id=revision.author_user_id
        LEFT JOIN surface_approvals approval ON approval.revision_id=revision.id AND approval.user_id=? AND approval.governance_version=?
        WHERE revision.surface_id=? ORDER BY revision.revision_number DESC LIMIT 30`)
        .bind(surface.governanceVersion, user.id, surface.governanceVersion, surface.id).all(),
    ]);
    const sharedContext = safeStringArray(context?.sharedContextJson);
    return Response.json({
      surface: { ...surface, memberCount: Number(memberCount?.count ?? 0) },
      brief: {
        kind: "room",
        designPolicy: { id: DESIGN_POLICY_ID, version: DESIGN_POLICY_VERSION },
        instruction: "Create a complete responsive GeneratedSiteBundle v3 visual world for this introduction room using semantic HTML and CSS. Begin from a member-approved reference; when none exists, use ImageGen to propose one coherent functional room concept for approval, then use Hallmark as the implementation discipline. The concept must cover the room and any enabled shared tools, not merely decoration. Keep chat, permissions, navigation, scheduling, proposal controls, and other product actions in trusted Buildmates UI outside the generated document. Never include messages or private evidence.",
        allowedBindings: [
          { key: "room.title", type: "text" },
          { key: "room.whyTitle", type: "text" },
          { key: "room.whyBody", type: "text" },
          { key: "room.sharedFacts", type: "facts" },
          { key: "room.privacyNote", type: "text" },
        ],
        authorizedContent: {
          "room.title": `${context?.otherName ?? "Buildmate"} & You`,
          "room.whyTitle": "Why Buildmates connected you",
          "room.whyBody": context?.reason ?? "Buildmates found mutual relevance in your current work.",
          "room.sharedFacts": sharedContext.map((value, index) => ({ label: `Shared context ${index + 1}`, value })),
          "room.privacyNote": "Only context authorized for both people appears here. Messages never feed back into matching.",
        },
        forbidden: ["scripts", "forms", "remote URLs", "permission controls", "messages", "private evidence"],
      },
      history: history.results.map((row) => {
        const value = row as Record<string, unknown>;
        try { return { ...value, spec: JSON.parse(String(value.spec)) }; }
        catch { return { ...value, spec: null }; }
      }),
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "surface_unavailable";
    return Response.json({ error: message }, { status: message === "room_not_found" ? 404 : 409 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = requireSameOriginMutation(request);
  if (origin) return origin;
  const [user, { DB }] = await Promise.all([requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  try {
    const { id } = await params;
    const body = await request.json() as {
      action: "draft" | "decide" | "publish" | "restore";
      spec?: unknown;
      revisionId?: string;
      decision?: "approved" | "rejected";
      expectedPublishedRevisionNumber?: number | null;
    };
    const surface = await roomSurface(DB, id, user.id);
    await seedPolicy(DB);
    const repositories = createD1Repositories(DB);

    if (body.action === "draft" || body.action === "restore") {
      await consumeWebRateLimit(DB, "room_surface", user.id, 20);
    }

    if (body.action === "decide") {
      if (!body.revisionId || !body.decision) throw new Error("decision_required");
      await repositories.surfaces.decideRevision({ actorId: user.id, revisionId: body.revisionId, governanceVersion: surface.governanceVersion, decision: body.decision, at: new Date() });
      return Response.json({ decided: true });
    }
    if (body.action === "publish") {
      if (!body.revisionId) throw new Error("revision_required");
      await repositories.surfaces.publishRevision({ actorId: user.id, surfaceId: surface.id, revisionId: body.revisionId, expectedPublishedRevisionNumber: body.expectedPublishedRevisionNumber ?? null, governanceVersion: surface.governanceVersion, at: new Date() });
      return Response.json({ published: true });
    }

    let parsed: ReturnType<typeof parseSurfaceSpecJson>;
    if (body.action === "restore") {
      if (!body.revisionId) throw new Error("revision_required");
      const stored = await DB.prepare("SELECT spec_json AS spec FROM surface_revisions WHERE id=? AND surface_id=?").bind(body.revisionId, surface.id).first<{ spec: string }>();
      if (!stored) throw new Error("revision_required");
      parsed = parseSurfaceSpecJson(stored.spec);
    } else {
      parsed = parseSurfaceSpecJson(JSON.stringify(body.spec));
    }
    if (parsed.kind !== "room") throw new Error("wrong_surface_kind");
    const maximum = await DB.prepare("SELECT COALESCE(MAX(revision_number),0) AS value FROM surface_revisions WHERE surface_id=?").bind(surface.id).first<{ value: number }>();
    const revisionNumber = Number(maximum?.value ?? 0) + 1;
    const revisionId = `revision_${crypto.randomUUID()}`;
    await repositories.surfaces.createRevision({
      actorId: user.id,
      id: revisionId,
      surfaceId: surface.id,
      authorUserId: user.id,
      revisionNumber,
      baseRevisionNumber: surface.publishedRevisionNumber,
      designPolicyId: DESIGN_POLICY_ID,
      designPolicyVersion: DESIGN_POLICY_VERSION,
      visibility: "private_preview",
      specJson: JSON.stringify(parsed),
      createdAt: new Date(),
    });
    return Response.json({ id: revisionId, revisionNumber }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "invalid_surface" }, { status: 409 });
  }
}

function safeStringArray(value: string | null | undefined) {
  try {
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 4) : [];
  } catch {
    return [];
  }
}
