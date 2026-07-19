import { getPlatformBindings } from "@/src/platform/bindings";
import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { readRequestBodyWithLimit, uploadSurfaceAsset } from "@/src/platform/surface-assets";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { consumeWebRateLimit, WebRateLimitError } from "@/src/security/rate-limit";

export async function POST(request: Request) {
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  try {
    const { DB, ASSETS } = await getPlatformBindings();
    await consumeWebRateLimit(DB,"surface_asset_upload",user.id,30);
    const asset = await uploadSurfaceAsset({ DB, bucket: ASSETS, actorId: user.id, bytes: await readRequestBodyWithLimit(request), claimedContentType: request.headers.get("content-type") ?? "" });
    return Response.json({ asset }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if(error instanceof WebRateLimitError)return Response.json({error:error.code},{status:429,headers:{"retry-after":String(error.retryAfterSeconds),"cache-control":"no-store"}});
    const code = error instanceof Error ? error.message : "surface_asset_upload_failed";
    console.warn(JSON.stringify({ event: "surface_asset_upload_failed", code }));
    return Response.json({ error: code }, { status: code.includes("size") ? 413 : code.includes("forbidden") || code.includes("mismatch") ? 415 : code.includes("quota")?409:400 });
  }
}
