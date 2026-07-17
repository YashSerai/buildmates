import { establishGithubSession, sessionCookie } from "@/src/auth/github-oauth";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";
import { allowLocalTestingRoute } from "@/src/security/testing-route";

export async function POST(request: Request) {
  const { DB, BUILDMATES_E2E } = await getPlatformBindings();
  if (!allowLocalTestingRoute(request, BUILDMATES_E2E)) return Response.json({ error: "not_found" }, { status: 404 });
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const body = await request.json().catch(() => ({})) as { subject?: unknown };
  const subject = typeof body.subject === "number" && Number.isSafeInteger(body.subject) && body.subject > 0 ? body.subject : 900719925;
  const session = await establishGithubSession(DB, { id: subject, login: `e2e-${subject}`, name: "Buildmates Tester" }, Date.now());
  return Response.json({ userId: session.userId }, { status: 201, headers: { "set-cookie": sessionCookie(session.cookieValue), "cache-control": "no-store" } });
}
