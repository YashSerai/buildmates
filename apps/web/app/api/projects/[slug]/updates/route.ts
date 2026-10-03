import { getCurrentUser, isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getProjectBySlug, publishProjectUpdate, type Audience } from "@/src/profile-projects/service";
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
  const body = await request.json().catch(() => null) as { body?: unknown; audience?: unknown } | null;
  if (!body || typeof body.body !== "string" || typeof body.audience !== "string") return Response.json({ error: "invalid_update" }, { status: 400 });
  try {
    return Response.json(await publishProjectUpdate(DB, user.id, slug, { body: body.body, audience: body.audience as Audience, now: Date.now() }), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_update";
    return Response.json({ error: code }, { status: code === "project_not_found" ? 404 : 400 });
  }
}
