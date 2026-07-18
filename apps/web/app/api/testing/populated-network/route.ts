import { requireApiUser, isAuthResponse } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { allowLocalTestingRoute } from "@/src/security/testing-route";
import { seedPopulatedNetwork } from "@/src/testing/seed-populated-network";

export async function POST(request: Request) {
  const { DB, BUILDMATES_E2E } = await getPlatformBindings();
  if (!allowLocalTestingRoute(request, BUILDMATES_E2E)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const user = await requireApiUser();
  if (isAuthResponse(user)) return user;
  const fixture = await seedPopulatedNetwork(DB, user.id, Date.now());
  return Response.json(fixture, {
    status: 201,
    headers: { "cache-control": "no-store" },
  });
}
