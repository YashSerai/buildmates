import { getPlatformBindings } from "@/src/platform/bindings";
import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { readRequestBodyWithLimit, uploadSurfaceAsset } from "@/src/platform/surface-assets";

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  try {
    const { DB, ASSETS } = await getPlatformBindings();
    const asset = await uploadSurfaceAsset({ DB, bucket: ASSETS, actorId: user.id, bytes: await readRequestBodyWithLimit(request), claimedContentType: request.headers.get("content-type") ?? "" });
    return Response.json({ asset }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "surface_asset_upload_failed";
    return Response.json({ error: code }, { status: code.includes("size") ? 413 : code.includes("forbidden") || code.includes("mismatch") ? 415 : 400 });
  }
}
