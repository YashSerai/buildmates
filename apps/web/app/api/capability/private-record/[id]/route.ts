import { createPrivateCapabilityRepository } from "@buildmates/database";
import { getPlatformBindings } from "@/src/platform/bindings";
import { internalUserKey, requireApiIdentity } from "@/src/platform/identity";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requireApiIdentity();
  if (identity instanceof Response) return identity;
  const { id } = await context.params;
  const { DB } = await getPlatformBindings();
  const record = await createPrivateCapabilityRepository(DB).readForOwner(id, internalUserKey(identity));
  if (!record) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(record, { headers: { "cache-control": "no-store" } });
}
