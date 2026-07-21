import { getPlatformBindings } from "@/src/platform/bindings";
import { readRequestBodyWithLimit, uploadSurfaceAsset } from "@/src/platform/surface-assets";
import { consumeSurfaceAssetUploadGrant } from "@/src/platform/surface-upload-grants";

export async function POST(request: Request, context: { params: Promise<{ token: string }> | { token: string } }) {
  const { token } = await context.params;
  try {
    const { DB, ASSETS } = await getPlatformBindings();
    const grant = await consumeSurfaceAssetUploadGrant(DB, token);
    if (!grant) return Response.json({ error: "upload_link_invalid_or_expired" }, { status: 404, headers: { "cache-control": "no-store" } });
    const claimedContentType = request.headers.get("content-type")?.toLowerCase().split(";", 1)[0].trim() ?? "";
    if (claimedContentType !== grant.contentType) return Response.json({ error: "surface_asset_content_type_mismatch" }, { status: 415, headers: { "cache-control": "no-store" } });
    const asset = await uploadSurfaceAsset({ DB, bucket: ASSETS, actorId: grant.userId, bytes: await readRequestBodyWithLimit(request), claimedContentType });
    return Response.json({ asset }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "surface_asset_upload_failed";
    return Response.json({ error: code }, { status: code.includes("size") ? 413 : 400, headers: { "cache-control": "no-store" } });
  }
}
