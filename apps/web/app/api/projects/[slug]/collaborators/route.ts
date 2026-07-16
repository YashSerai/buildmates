import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { normalizeSlug } from "@/src/profile-projects/service";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const project = await DB.prepare("SELECT id,owner_user_id AS ownerId FROM projects WHERE slug=? AND status<>'deleted'").bind(normalizeSlug(slug)).first<{ id: string; ownerId: string }>();
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });
  const member = project.ownerId === user.id || await DB.prepare("SELECT 1 AS ok FROM project_collaborators WHERE project_id=? AND user_id=?").bind(project.id, user.id).first();
  if (!member) return Response.json({ error: "not_found" }, { status: 404 });
  const rows = (await DB.prepare(`SELECT collaborator.user_id AS userId,profile.display_name AS displayName,handle.handle,collaborator.role,collaborator.approved_at AS approvedAt
    FROM project_collaborators collaborator JOIN profiles profile ON profile.user_id=collaborator.user_id JOIN handles handle ON handle.user_id=collaborator.user_id
    WHERE collaborator.project_id=? ORDER BY collaborator.approved_at IS NULL,profile.display_name LIMIT 100`).bind(project.id).all()).results;
  return Response.json({ ownerId: project.ownerId, collaborators: rows }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const body = await request.json() as { handle: string; role: "viewer" | "editor" };
  if (!body.handle || !["viewer", "editor"].includes(body.role)) return Response.json({ error: "invalid_collaborator" }, { status: 400 });
  const project = await DB.prepare("SELECT id FROM projects WHERE slug=? AND owner_user_id=? AND status<>'deleted'").bind(normalizeSlug(slug), user.id).first<{ id: string }>();
  const target = await DB.prepare("SELECT user_id AS userId FROM handles WHERE normalized_handle=?").bind(body.handle.trim().toLowerCase().replace(/^@/, "")).first<{ userId: string }>();
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });
  if (!target || target.userId === user.id) return Response.json({ error: "collaborator_not_found" }, { status: 404 });
  await DB.prepare("INSERT INTO project_collaborators (project_id,user_id,role,approved_at) VALUES (?,?,?,NULL) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,approved_at=NULL").bind(project.id, target.userId, body.role).run();
  await DB.prepare("INSERT OR IGNORE INTO notifications (id,user_id,kind,delivery,payload_json,created_at) VALUES (?,?,'project_collaboration_invite','immediate',?,?)").bind(`project-invite:${project.id}:${target.userId}`, target.userId, JSON.stringify({ projectId: project.id, slug: normalizeSlug(slug) }), Date.now()).run();
  return Response.json({ status: "invited" }, { status: 201 });
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const body = await request.json().catch(() => ({ accept: true })) as { accept?: boolean };
  const result = body.accept === false
    ? await DB.prepare("DELETE FROM project_collaborators WHERE project_id=(SELECT id FROM projects WHERE slug=? AND status<>'deleted') AND user_id=? AND approved_at IS NULL").bind(normalizeSlug(slug), user.id).run()
    : await DB.prepare("UPDATE project_collaborators SET approved_at=? WHERE project_id=(SELECT id FROM projects WHERE slug=? AND status<>'deleted') AND user_id=? AND approved_at IS NULL").bind(Date.now(), normalizeSlug(slug), user.id).run();
  return result.meta?.changes ? Response.json({ status: body.accept === false ? "declined" : "accepted" }) : Response.json({ error: "invitation_not_found" }, { status: 404 });
}

export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const { newOwnerUserId } = await request.json() as { newOwnerUserId: string };
  const project = await DB.prepare("SELECT id FROM projects WHERE slug=? AND owner_user_id=? AND status<>'deleted'").bind(normalizeSlug(slug), user.id).first<{ id: string }>();
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });
  const accepted = await DB.prepare("SELECT 1 AS ok FROM project_collaborators WHERE project_id=? AND user_id=? AND approved_at IS NOT NULL").bind(project.id, newOwnerUserId).first();
  if (!accepted) return Response.json({ error: "accepted_collaborator_required" }, { status: 409 });
  const now = Date.now();
  const results = await DB.batch([DB.prepare("UPDATE projects SET owner_user_id=?,updated_at=? WHERE id=? AND owner_user_id=?").bind(newOwnerUserId, now, project.id, user.id), DB.prepare("INSERT INTO project_collaborators(project_id,user_id,role,approved_at) VALUES (?,?,'editor',?) ON CONFLICT(project_id,user_id) DO UPDATE SET role='editor',approved_at=excluded.approved_at").bind(project.id, user.id, now), DB.prepare("DELETE FROM project_collaborators WHERE project_id=? AND user_id=?").bind(project.id, newOwnerUserId)]);
  if (results.some((result) => !result.success) || Number(results[0]?.meta.changes) !== 1) return Response.json({ error: "transfer_failed" }, { status: 409 });
  return Response.json({ status: "transferred" });
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const target = new URL(request.url).searchParams.get("userId");
  if (!target) return Response.json({ error: "user_required" }, { status: 400 });
  const result = await DB.prepare("DELETE FROM project_collaborators WHERE project_id=(SELECT id FROM projects WHERE slug=? AND owner_user_id=? AND status<>'deleted') AND user_id=?").bind(normalizeSlug(slug), user.id, target).run();
  return result.meta?.changes ? Response.json({ removed: true }) : Response.json({ error: "not_found" }, { status: 404 });
}
