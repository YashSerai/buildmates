import { getCurrentUser, isAuthResponse, requireApiUser } from "../../../../src/auth/require-user";
import { getPlatformBindings } from "../../../../src/platform/bindings";
import { getProfileByHandle, saveProfile, type ProfileInput } from "../../../../src/profile-projects/service";
import { requireSameOriginMutation } from "../../../../src/platform/same-origin";

export async function GET(_: Request, context: { params: Promise<{ handle: string }> }) {
  const [{ handle }, viewer, { DB }] = await Promise.all([context.params, getCurrentUser(), getPlatformBindings()]);
  try { const profile = await getProfileByHandle(DB, handle, viewer?.id ?? null); return profile ? Response.json(profile,{headers:viewerHeaders()}) : Response.json({ error: "not_found" }, { status: 404,headers:viewerHeaders() }); }
  catch { return Response.json({ error: "not_found" }, { status: 404,headers:viewerHeaders() }); }
}

export async function PUT(request: Request) {
  const origin = requireSameOriginMutation(request); if (origin) return origin;
  const [user, { DB }] = await Promise.all([requireApiUser(), getPlatformBindings()]); if (isAuthResponse(user)) return user;
  try { return Response.json(await saveProfile(DB, user.id, await request.json() as ProfileInput), { status: 201 }); }
  catch (error) { const message=error instanceof Error?error.message:"invalid_profile"; return Response.json({ error: message }, { status: message.includes("UNIQUE") ? 409 : 400 }); }
}

function viewerHeaders():HeadersInit{return{"cache-control":"private, no-store",vary:"Cookie"}}
