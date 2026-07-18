import { requireApiUser, isAuthResponse } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { allowLocalTestingRoute } from "@/src/security/testing-route";
import { applyQaScenario, QA_SCENARIOS, resetQaScenarios, type QaScenario } from "@/src/testing/qa-scenarios";

async function authorized(request: Request) {
  const { DB, BUILDMATES_E2E } = await getPlatformBindings();
  if (!allowLocalTestingRoute(request, BUILDMATES_E2E)) return { response: Response.json({ error: "not_found" }, { status: 404 }) };
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return { response: originFailure };
  const user = await requireApiUser();
  if (isAuthResponse(user)) return { response: user };
  return { DB, user };
}

export async function POST(request: Request) {
  const auth = await authorized(request);
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as { scenario?: unknown } | null;
  if (!body || typeof body.scenario !== "string" || !QA_SCENARIOS.includes(body.scenario as QaScenario)) {
    return Response.json({ error: "scenario_invalid", allowed: QA_SCENARIOS }, { status: 400 });
  }
  const result = await applyQaScenario(auth.DB, auth.user.id, body.scenario as QaScenario, Date.now());
  return Response.json(result, { status: 201, headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: Request) {
  const auth = await authorized(request);
  if ("response" in auth) return auth.response;
  await resetQaScenarios(auth.DB, auth.user.id);
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
