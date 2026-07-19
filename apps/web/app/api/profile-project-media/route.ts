import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import {
  associateProfileProjectMedia,
  listApprovedProfileMedia,
  listApprovedProfileProjects,
} from "@/src/platform/surface-assets";
import { consumeWebRateLimit, WebRateLimitError } from "@/src/security/rate-limit";

export async function GET() {
  const [user, { DB }] = await Promise.all([requireApiUser(), getPlatformBindings()]);
  if (isAuthResponse(user)) return user;
  const [projects, media] = await Promise.all([
    listApprovedProfileProjects({ DB, actorId: user.id }),
    listApprovedProfileMedia({ DB, actorId: user.id }),
  ]);
  return Response.json({ projects, media }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  try {
    const { DB } = await getPlatformBindings();
    await consumeWebRateLimit(DB, "profile_project_media", user.id, 30);
    const body = await request.json() as Record<string, unknown>;
    const media = await associateProfileProjectMedia({
      DB,
      actorId: user.id,
      assetId: typeof body.assetId === "string" ? body.assetId : "",
      projectKey: typeof body.projectKey === "string" ? body.projectKey : "",
      projectTitle: typeof body.projectTitle === "string" ? body.projectTitle : "",
      altText: typeof body.altText === "string" ? body.altText : "",
    });
    return Response.json({ media }, { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof WebRateLimitError) return Response.json({ error: error.code }, { status: 429, headers: { "retry-after": String(error.retryAfterSeconds), "cache-control": "no-store" } });
    const code = error instanceof Error ? error.message : "profile_project_media_invalid";
    const status = code === "surface_asset_not_owned" || code === "profile_project_not_approved" ? 403 : code === "profile_required" ? 409 : 400;
    return Response.json({ error: code }, { status, headers: { "cache-control": "private, no-store" } });
  }
}
