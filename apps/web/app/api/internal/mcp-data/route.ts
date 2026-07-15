import { verifyDelegatedRequest } from "@/src/platform/delegated-request";
import { getPlatformBindings } from "@/src/platform/bindings";
import { completeIdentityLink, createD1IdentityLinkStore } from "@/src/platform/identity-link-store";

const ALLOWED_ACTIONS = {
  "identity.link-status.read": "identity:link-status:read",
  "identity.link.complete": "identity:link:complete",
} as const;

export async function POST(request: Request) {
  if (process.env.MCP_TOPOLOGY !== "external") return Response.json({ error: "not_found" }, { status: 404 });
  const publicKeyPem = process.env.MCP_DELEGATION_PUBLIC_KEY_PEM;
  if (!publicKeyPem) return Response.json({ error: "delegation_not_configured" }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }
  if (containsUserId(body)) return Response.json({ error: "caller_user_id_forbidden" }, { status: 400 });
  const action = readString(body, "action");
  const expectedScope = action && ALLOWED_ACTIONS[action as keyof typeof ALLOWED_ACTIONS];
  if (!action || !expectedScope) return Response.json({ error: "unsupported_action" }, { status: 400 });

  try {
    const { DB } = await getPlatformBindings();
    const claims = await verifyDelegatedRequest({
      authorization: request.headers.get("authorization"),
      publicKeyPem,
      issuer: process.env.MCP_DELEGATION_ISSUER || "buildmates-mcp",
      audience: process.env.MCP_DELEGATION_AUDIENCE || "buildmates-web-data",
      expectedAction: action,
      expectedScope,
      consumeReplay: async ({ jti, iss, sub, action, exp }) => {
        try {
          await DB.prepare(
            "INSERT INTO assertion_replays (jti, issuer, subject, action, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          ).bind(jti, iss, sub, action, exp * 1000, Date.now()).run();
          return true;
        } catch { return false; }
      },
    });
    if (action === "identity.link.complete") {
      return completeIdentityLinkResponse(DB, body, claims.sub);
    }
    const link = await DB.prepare(
      "SELECT id FROM identity_links WHERE provider_channel = 'mcp' AND provider_issuer = 'buildmates_mcp' AND provider_subject = ? AND workspace_scope = 'global' AND revoked_at IS NULL LIMIT 1",
    ).bind(claims.sub).first<{ id: string }>();
    if (!link) return Response.json({ error: "identity_link_required" }, { status: 403 });
    return Response.json({ linked: true, action: claims.action }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "invalid_delegated_request" }, { status: 401 });
  }
}

async function completeIdentityLinkResponse(DB: D1Database, body: unknown, mcpSubject: string): Promise<Response> {
  const code = readString(body, "code")?.trim().toUpperCase();
  const workspaceScope = readString(body, "workspaceScope")?.trim() || "global";
  if (!code) {
    return Response.json({ linked: false, reason: "invalid_or_expired" }, { status: 400 });
  }
  const result = await completeIdentityLink(createD1IdentityLinkStore(DB), { code, workspaceScope, mcpSubject });
  return Response.json(
    result.linked ? { linked: true } : result,
    { status: result.linked ? 200 : result.reason === "conflict" ? 409 : 400, headers: { "cache-control": "no-store" } },
  );
}

function containsUserId(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => key.toLowerCase() === "userid" || containsUserId(child));
}

function readString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}
