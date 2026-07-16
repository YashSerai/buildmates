import { establishGithubSession, sessionCookie } from "@/src/auth/github-oauth";
import { getPlatformBindings } from "@/src/platform/bindings";
import { requireSameOriginMutation } from "@/src/platform/same-origin";

export async function POST(request: Request) {
  const { DB, BUILDMATES_E2E } = await getPlatformBindings();
  if (BUILDMATES_E2E !== "1" || request.headers.get("x-buildmates-e2e") !== "1") return Response.json({ error: "not_found" }, { status: 404 });
  const originFailure = requireSameOriginMutation(request);
  if (originFailure) return originFailure;
  const body = await request.json().catch(() => ({})) as { subject?: unknown };
  const subject = typeof body.subject === "number" && Number.isSafeInteger(body.subject) && body.subject > 0 ? body.subject : 900719925;
  const session = await establishGithubSession(DB, { id: subject, login: `e2e-${subject}`, name: "Buildmates Tester" }, Date.now());
  return Response.json({ userId: session.userId }, { status: 201, headers: { "set-cookie": sessionCookie(session.cookieValue), "cache-control": "no-store" } });
}
