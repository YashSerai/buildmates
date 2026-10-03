import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { inviteProjectCollaborator, listProjectCollaborators, removeProjectCollaborator, respondProjectCollaboration, transferProjectOwnership } from "@/src/profile-projects/collaborators";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  try {
    const result = await listProjectCollaborators(DB, user.id, slug);
    return Response.json({ ownerId: result.ownerUserId, collaborators: result.collaborators }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const body = await request.json().catch(() => null) as { handle?: unknown; role?: unknown } | null;
  if (!body || typeof body.handle !== "string" || !["viewer", "editor"].includes(String(body.role))) return Response.json({ error: "invalid_collaborator" }, { status: 400 });
  try {
    await inviteProjectCollaborator(DB, { actorId: user.id, slug, handle: body.handle, role: body.role as "viewer" | "editor", now: Date.now() });
    return Response.json({ status: "invited" }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "collaborator_not_found";
    return Response.json({ error: code }, { status: code === "project_not_found" || code === "collaborator_not_found" ? 404 : 400 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const body = await request.json().catch(() => ({ accept: true })) as { accept?: unknown };
  try {
    const accepted = body.accept !== false;
    await respondProjectCollaboration(DB, { actorId: user.id, slug, accept: accepted, now: Date.now() });
    return Response.json({ status: accepted ? "accepted" : "declined" });
  } catch {
    return Response.json({ error: "invitation_not_found" }, { status: 404 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ slug: string }> }) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const body = await request.json().catch(() => null) as { newOwnerUserId?: unknown } | null;
  if (!body || typeof body.newOwnerUserId !== "string") return Response.json({ error: "user_required" }, { status: 400 });
  try {
    await transferProjectOwnership(DB, { actorId: user.id, slug, targetUserId: body.newOwnerUserId, now: Date.now() });
    return Response.json({ status: "transferred" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ownership_transfer_failed";
    return Response.json({ error: code }, { status: code === "project_not_found" ? 404 : 409 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [{ slug }, user, { DB }] = await Promise.all([context.params, requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const target = new URL(request.url).searchParams.get("userId");
  if (!target) return Response.json({ error: "user_required" }, { status: 400 });
  try {
    await removeProjectCollaborator(DB, { actorId: user.id, slug, targetUserId: target });
    return Response.json({ removed: true });
  } catch {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}