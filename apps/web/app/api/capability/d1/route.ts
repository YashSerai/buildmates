import { internalUserKey, requireApiIdentity } from "@/src/platform/identity";
import { runD1Diagnostic } from "@/src/platform/d1";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function POST(request: Request) {
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const identity = await requireApiIdentity();
  if (identity instanceof Response) return identity;
  try {
    const { DB } = await getPlatformBindings();
    const result = await runD1Diagnostic(DB, internalUserKey(identity));
    return Response.json({ ok: true, result }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "d1_capability_unavailable" }, { status: 503 });
  }
}

export function GET() {
  return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
}
