import { createD1OAuthStore } from "./d1-oauth-store";
import { createExternalIdentityLinkService } from "./link-identity";
import { createExternalMcpFetchHandler } from "./server";
import type { OAuth21Config } from "./oauth";
import { createAuthorizationHandoff } from "./authorization-handoff";

type Env = {
  DB: D1Database;
  OAUTH_ISSUER: string;
  MCP_RESOURCE: string;
  OAUTH_CLIENTS_JSON: string;
  OAUTH_SUBJECT_SECRET: string;
  WEB_BASE_URL: string;
  WEB_DATA_URL: string;
  WEB_AUTHORIZATION_PUBLIC_KEY_PEM: string;
  WEB_AUTHORIZATION_ISSUER: string;
  WEB_AUTHORIZATION_AUDIENCE: string;
  MCP_DELEGATION_PRIVATE_KEY_PEM: string;
  MCP_DELEGATION_KEY_ID: string;
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const clients = JSON.parse(env.OAUTH_CLIENTS_JSON) as Record<string, string[]>;
    const oauth: OAuth21Config = {
      issuer: env.OAUTH_ISSUER,
      resource: env.MCP_RESOURCE,
      registeredRedirectUris: new Map(Object.entries(clients)),
      allowedScopes: new Set(["mcp:tools"]),
      accessTokenTtlSeconds: 15 * 60,
      refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
    };
    const delegated = createExternalIdentityLinkService({
      webDataUrl: env.WEB_DATA_URL, issuer: "buildmates-mcp", audience: "buildmates-web-data",
      privateKeyPem: env.MCP_DELEGATION_PRIVATE_KEY_PEM, keyId: env.MCP_DELEGATION_KEY_ID,
    });
    const handoff = createAuthorizationHandoff({
      DB: env.DB, webBaseUrl: env.WEB_BASE_URL, mcpBaseUrl: env.OAUTH_ISSUER,
      publicKeyPem: env.WEB_AUTHORIZATION_PUBLIC_KEY_PEM,
      issuer: env.WEB_AUTHORIZATION_ISSUER, audience: env.WEB_AUTHORIZATION_AUDIENCE,
    });
    if (new URL(request.url).pathname === "/oauth/web-callback") return handoff.complete(request);
    const handler = createExternalMcpFetchHandler({
      oauth,
      store: createD1OAuthStore(env.DB, env.OAUTH_SUBJECT_SECRET),
      identityTools: {
        linkBaseUrl: env.WEB_BASE_URL,
        completeIdentityLink: delegated.completeIdentityLink,
        allowAttempt: ({ mcpSubject, operation }) => allowRateLimitedAttempt(env.DB, mcpSubject, operation),
      },
      resolveAuthorizationIdentity: (authorizationRequest) => handoff.identity(authorizationRequest),
      beginAuthorizationHandoff: (authorizationRequest) => handoff.begin(authorizationRequest),
    });
    return handler(request);
  },
};

export default worker;

async function allowRateLimitedAttempt(DB: D1Database, subject: string, operation: string): Promise<boolean> {
  const now = Date.now();
  const window = Math.floor(now / 600_000);
  const key = `${operation}:${subject}:${window}`;
  await DB.prepare("INSERT INTO mcp_rate_limits (key, attempt_count, window_expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempt_count = attempt_count + 1")
    .bind(key, (window + 1) * 600_000).run();
  const row = await DB.prepare("SELECT attempt_count AS attemptCount FROM mcp_rate_limits WHERE key = ?").bind(key).first<{ attemptCount: number }>();
  return (row?.attemptCount ?? 999) <= 5;
}
