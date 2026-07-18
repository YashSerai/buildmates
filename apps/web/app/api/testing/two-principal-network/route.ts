import { isAuthResponse, requireApiUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { allowLocalTestingRoute } from "@/src/security/testing-route";
import { seedTwoPrincipalNetwork } from "@/src/testing/two-principal-network";

export async function POST(request: Request) {
  const { DB, BUILDMATES_E2E } = await getPlatformBindings();
  if (!allowLocalTestingRoute(request, BUILDMATES_E2E)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  const body = await request.json().catch(() => null) as { peerUserId?: unknown } | null;
  if (typeof body?.peerUserId !== "string" || body.peerUserId.length > 160) {
    return Response.json({ error: "peer_invalid" }, { status: 400 });
  }
  try {
    return Response.json(
      await seedTwoPrincipalNetwork(DB, user.id, body.peerUserId, Date.now()),
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "seed_failed";
    return Response.json({ error: code }, { status: code === "peer_invalid" ? 400 : 409 });
  }
}
