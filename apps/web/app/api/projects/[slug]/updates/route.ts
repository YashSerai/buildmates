import { getCurrentUser, isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getProjectBySlug, normalizeSlug, AUDIENCES, type Audience } from "@/src/profile-projects/service";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const [{ slug }, viewer, { DB }] = await Promise.all([context.params, getCurrentUser(), getPlatformBindings()]);
  const project = await getProjectBySlug(DB, slug, viewer?.id ?? null);
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ updates: project.updates }, { headers: { "cache-control": "private, no-store" } });
}
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const body = await request.json() as { body: string; audience: Audience };
  if (!AUDIENCES.includes(body.audience) || !body.body?.trim() || body.body.length > 2000) return Response.json({ error: "invalid_update" }, { status: 400 });
  const project = await DB.prepare("SELECT id FROM projects project WHERE slug=? AND status<>'deleted' AND (owner_user_id=? OR EXISTS(SELECT 1 FROM project_collaborators collaborator WHERE collaborator.project_id=project.id AND collaborator.user_id=? AND collaborator.approved_at IS NOT NULL AND collaborator.role IN('editor','owner')))").bind(normalizeSlug(slug), user.id, user.id).first<{ id: string }>();
  if (!project) return Response.json({ error: "not_found" }, { status: 404 });
  const id = `update_${crypto.randomUUID()}`;
  await DB.prepare("INSERT INTO project_updates(id,project_id,author_user_id,body,audience,created_at)VALUES(?,?,?,?,?,?)").bind(id, project.id, user.id, body.body.trim(), body.audience, Date.now()).run();
  return Response.json({ id }, { status: 201 });
}
