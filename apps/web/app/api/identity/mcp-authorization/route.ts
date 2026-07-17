import { getCurrentUser } from "@/src/auth/require-user";
import { createMcpAuthorizationAssertion } from "@/src/platform/mcp-authorization";
import { sha256 } from "@/src/auth/github-oauth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    const returnTo = new URL(request.url).pathname + new URL(request.url).search;
    return Response.redirect(new URL(`/api/auth/github/start?return_to=${encodeURIComponent(returnTo)}`, request.url), 302);
  }
  const privateKeyPem = process.env.MCP_WEB_AUTHORIZATION_PRIVATE_KEY_PEM;
  const mcpBaseUrl = process.env.MCP_OAUTH_BASE_URL;
  if (!privateKeyPem || !mcpBaseUrl) return Response.json({ error: "mcp_authorization_handoff_unavailable" }, { status: 503 });
  const returnTo = new URL(request.url).searchParams.get("return_to");
  if (!returnTo || !isAllowedMcpCallback(returnTo, mcpBaseUrl)) return Response.json({ error: "invalid_return_to" }, { status: 400 });

  const callback = new URL(returnTo);
  const handoff = callback.searchParams.get("handoff");
  if (!handoff) return Response.json({ error: "invalid_return_to" }, { status: 400 });
  const assertion = await createMcpAuthorizationAssertion({ channel: "web", subject: user.id, workspaceScope: "global", handoffHash: await sha256(handoff) }, {
    privateKeyPem,
    issuer: process.env.MCP_WEB_AUTHORIZATION_ISSUER || "buildmates-web",
    audience: process.env.MCP_WEB_AUTHORIZATION_AUDIENCE || "buildmates-mcp-authorization",
    keyId: process.env.MCP_WEB_AUTHORIZATION_KEY_ID || "web-current",
  });
  callback.searchParams.set("assertion", assertion);
  return new Response(null, {
    status: 302,
    headers: { location: callback.toString(), "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

function isAllowedMcpCallback(value: string, baseUrl: string): boolean {
  try {
    const target = new URL(value);
    const base = new URL(baseUrl);
    return target.origin === base.origin && target.pathname === "/oauth/web-callback" && Boolean(target.searchParams.get("handoff"));
  } catch { return false; }
}
