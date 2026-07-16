import { createD1Repositories } from "@buildmates/database";
import {
  createProfileGenerationBrief,
  DESIGN_POLICY_ID,
  DESIGN_POLICY_VERSION,
  parseSurfaceSpecJson,
} from "@buildmates/surfaces";
import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { consumeWebRateLimit } from "@/src/security/rate-limit";

type ProfileSurface = { id: string; publishedRevisionId: string | null; publishedRevisionNumber: number | null; governanceVersion: number };

async function getProfileSurface(DB: D1Database, userId: string) {
  const profile = await DB.prepare(`SELECT profile.id,handle.handle,profile.display_name AS displayName,profile.summary
    FROM profiles profile JOIN handles handle ON handle.user_id=profile.user_id WHERE profile.user_id=? LIMIT 1`)
    .bind(userId).first<{ id: string; handle: string; displayName: string; summary: string }>();
  if (!profile) throw new Error("profile_required");
  let surface = await DB.prepare(`SELECT surface.id,surface.published_revision_id AS publishedRevisionId,
      revision.revision_number AS publishedRevisionNumber,surface.governance_version AS governanceVersion
    FROM surfaces surface LEFT JOIN surface_revisions revision ON revision.id=surface.published_revision_id
    WHERE surface.kind='profile' AND surface.subject_id=? LIMIT 1`).bind(profile.id).first<ProfileSurface>();
  if (!surface) {
    const id = `surface_profile_${profile.id}`;
    await createD1Repositories(DB).surfaces.createSurface({ actorId: userId as never, id, ownerUserId: userId as never, kind: "profile", subjectId: profile.id, at: new Date() });
    surface = { id, publishedRevisionId: null, publishedRevisionNumber: null, governanceVersion: 1 };
  }
  return { profile, surface };
}

export async function GET() {
  const [user, { DB }] = await Promise.all([requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  try {
    const { profile, surface } = await getProfileSurface(DB, user.id);
    const [fields, projects, history] = await Promise.all([
      DB.prepare("SELECT field_key AS key,value_json AS valueJson FROM profile_fields WHERE profile_id=? ORDER BY field_key").bind(profile.id).all<{ key: string; valueJson: string }>(),
      DB.prepare("SELECT id,title,summary,slug FROM projects WHERE owner_user_id=? AND status='active' ORDER BY updated_at DESC LIMIT 20").bind(user.id).all<{ id: string; title: string; summary: string; slug: string }>(),
      DB.prepare(`SELECT revision.id,revision.revision_number AS revisionNumber,revision.base_revision_number AS baseRevisionNumber,
        revision.status,revision.spec_json AS spec,revision.created_at AS createdAt
        FROM surface_revisions revision WHERE revision.surface_id=? ORDER BY revision.revision_number DESC LIMIT 30`).bind(surface.id).all(),
    ]);
    const facts = fields.results.map((field) => ({ label: field.key.replaceAll("_", " "), value: safeJson(field.valueJson) }));
    const visibleProjects = projects.results.map((project) => ({ id: project.id, title: project.title, summary: project.summary, href: `/projects/${project.slug}` }));
    const brief = createProfileGenerationBrief({
      handle: profile.handle,
      fields: [
        { key: "profile.displayName", label: "Display name", value: profile.displayName, bindingType: "text" },
        { key: "profile.summary", label: "Summary", value: profile.summary, bindingType: "text" },
        { key: "profile.facts", label: "Profile facts", value: facts, bindingType: "facts" },
        { key: "profile.projects", label: "Projects", value: visibleProjects, bindingType: "projects" },
      ],
    });
    return Response.json({
      brief,
      surface,
      history: history.results.map((row) => {
        const value = row as Record<string, unknown>;
        try { return { ...value, spec: JSON.parse(String(value.spec)) }; }
        catch { return { ...value, spec: null }; }
      }),
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "profile_surface_unavailable";
    return Response.json({ error: message }, { status: message === "profile_required" ? 409 : 400 });
  }
}

export async function POST(request: Request) {
  const origin = requireSameOriginMutation(request);
  if (origin) return origin;
  const [user, { DB }] = await Promise.all([requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  try {
    const body = await request.json() as { action: "draft" | "publish" | "restore"; spec?: unknown; revisionId?: string; expectedPublishedRevisionNumber?: number | null };
    const { surface } = await getProfileSurface(DB, user.id);
    const repositories = createD1Repositories(DB);
    if (body.action === "publish") {
      if (!body.revisionId) throw new Error("revision_required");
      await repositories.surfaces.publishRevision({ actorId: user.id, surfaceId: surface.id, revisionId: body.revisionId, expectedPublishedRevisionNumber: body.expectedPublishedRevisionNumber ?? null, governanceVersion: surface.governanceVersion, at: new Date() });
      return Response.json({ published: true });
    }
    await consumeWebRateLimit(DB, "profile_surface", user.id, 20);
    let parsed: ReturnType<typeof parseSurfaceSpecJson>;
    if (body.action === "restore") {
      if (!body.revisionId) throw new Error("revision_required");
      const stored = await DB.prepare("SELECT spec_json AS spec FROM surface_revisions WHERE id=? AND surface_id=?").bind(body.revisionId, surface.id).first<{ spec: string }>();
      if (!stored) throw new Error("revision_required");
      parsed = parseSurfaceSpecJson(stored.spec);
    } else {
      parsed = parseSurfaceSpecJson(JSON.stringify(body.spec));
    }
    if (parsed.kind !== "profile") throw new Error("wrong_surface_kind");
    const maximum = await DB.prepare("SELECT COALESCE(MAX(revision_number),0) AS value FROM surface_revisions WHERE surface_id=?").bind(surface.id).first<{ value: number }>();
    const revisionNumber = Number(maximum?.value ?? 0) + 1;
    const id = `revision_${crypto.randomUUID()}`;
    await repositories.surfaces.createRevision({
      actorId: user.id,
      id,
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
    return Response.json({ id, revisionNumber }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "invalid_surface" }, { status: 409 });
  }
}

function safeJson(value: string): unknown {
  try { return JSON.parse(value); }
  catch { return null; }
}
