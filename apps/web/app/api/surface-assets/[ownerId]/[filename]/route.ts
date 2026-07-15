import { getPlatformBindings } from "@/src/platform/bindings";
import { getCurrentUser } from "@/src/auth/require-user";
import { readSurfaceAsset } from "@/src/platform/surface-assets";

export async function GET(_request: Request, context: { params: Promise<{ ownerId: string; filename: string }> }) {
  const user = await getCurrentUser();
  const { ownerId, filename } = await context.params;
  const { DB, ASSETS } = await getPlatformBindings();
  return readSurfaceAsset({ DB, bucket: ASSETS, viewerId: user?.id ?? null, ownerId, filename });
}
