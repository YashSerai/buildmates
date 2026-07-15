import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createBuildmatesMcpServer, type BuildmatesToolServices } from "@buildmates/mcp-core";
import { ZodError } from "zod";
import {
  oauthDiscovery, oauthIssuerCapability, protectedResourceMetadata, validateAuthorizationRequest,
  type AuthorizedWebIdentity, type DurableOAuthStore, type OAuth21Config,
} from "./oauth";

export type ExternalMcpRuntime = {
  oauth: OAuth21Config;
  store: DurableOAuthStore;
  identityTools: BuildmatesToolServices;
  resolveAuthorizationIdentity(request: Request): Promise<AuthorizedWebIdentity | null>;
  beginAuthorizationHandoff?(request: Request): Promise<Response>;
};

export function createExternalMcpFetchHandler(runtime: ExternalMcpRuntime) {
  return async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && (url.pathname === "/.well-known/oauth-authorization-server" || url.pathname === "/.well-known/openid-configuration")) return json(oauthDiscovery(runtime.oauth));
      if (request.method === "GET" && url.pathname === "/.well-known/oauth-protected-resource") return json(protectedResourceMetadata(runtime.oauth));
      if (request.method === "GET" && url.pathname === "/oauth/authorize") return await authorize(request, runtime);
      if (request.method === "POST" && url.pathname === "/oauth/token") return await token(request, runtime);
      if (request.method === "POST" && url.pathname === "/oauth/revoke") return await revoke(request, runtime);
      if (url.pathname === "/mcp" && ["GET", "POST", "DELETE"].includes(request.method)) return await mcp(request, runtime);
      return json({ error: "not_found" }, 404);
    } catch (error) {
      const failure = oauthError(error);
      return json({ error: failure.code }, failure.status);
    }
  };
}

async function authorize(request: Request, runtime: ExternalMcpRuntime): Promise<Response> {
  const url = new URL(request.url);
  const auth = validateAuthorizationRequest(Object.fromEntries(url.searchParams), runtime.oauth);
  const identity = await runtime.resolveAuthorizationIdentity(request);
  if (!identity) return runtime.beginAuthorizationHandoff ? runtime.beginAuthorizationHandoff(request) : json({ error: "login_required" }, 401);
  const code = await runtime.store.issueAuthorizationCode({
    webIdentity: identity, clientId: auth.client_id, redirectUri: auth.redirect_uri, codeChallenge: auth.code_challenge,
    audience: auth.resource, scopes: auth.scopes, expiresAt: Date.now() + 5 * 60 * 1000,
  });
  const redirect = new URL(auth.redirect_uri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", auth.state);
  return Response.redirect(redirect.toString(), 302);
}

async function token(request: Request, runtime: ExternalMcpRuntime): Promise<Response> {
  const form = await request.formData();
  const grantType = field(form, "grant_type");
  const clientId = field(form, "client_id");
  const audience = field(form, "resource");
  if (audience !== runtime.oauth.resource || !runtime.oauth.registeredRedirectUris.has(clientId)) return json({ error: "invalid_grant" }, 400);
  const pair = grantType === "authorization_code"
    ? await runtime.store.exchangeAuthorizationCode({
        code: field(form, "code"), clientId, redirectUri: field(form, "redirect_uri"), codeVerifier: field(form, "code_verifier"), audience,
        accessTokenTtlSeconds: runtime.oauth.accessTokenTtlSeconds, refreshTokenTtlSeconds: runtime.oauth.refreshTokenTtlSeconds,
      })
    : grantType === "refresh_token"
      ? await runtime.store.rotateRefreshToken({
          refreshToken: field(form, "refresh_token"), clientId, audience,
          accessTokenTtlSeconds: runtime.oauth.accessTokenTtlSeconds, refreshTokenTtlSeconds: runtime.oauth.refreshTokenTtlSeconds,
        })
      : null;
  if (!pair) return json({ error: "invalid_grant" }, 400);
  return json({ access_token: pair.accessToken, token_type: "Bearer", expires_in: pair.expiresIn, refresh_token: pair.refreshToken, scope: pair.scope }, 200, { "cache-control": "no-store", pragma: "no-cache" });
}

async function revoke(request: Request, runtime: ExternalMcpRuntime): Promise<Response> {
  const form = await request.formData();
  const clientId = field(form, "client_id");
  if (!runtime.oauth.registeredRedirectUris.has(clientId)) return json({ error: "invalid_client" }, 401);
  await runtime.store.revoke(field(form, "token"), clientId);
  return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
}

async function mcp(request: Request, runtime: ExternalMcpRuntime): Promise<Response> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  const token = bearer && await runtime.store.validateAccessToken(bearer, runtime.oauth.resource);
  if (!token || !token.scopes.includes("mcp:tools")) {
    const metadataUrl = new URL("/.well-known/oauth-protected-resource", runtime.oauth.resource).toString();
    return json({ error: "invalid_token" }, 401, { "www-authenticate": `Bearer resource_metadata="${metadataUrl}"` });
  }
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const server = createBuildmatesMcpServer(runtime.identityTools);
  await server.connect(transport);
  return transport.handleRequest(request, {
    authInfo: { token: bearer, clientId: token.clientId, scopes: token.scopes, expiresAt: Math.floor(token.expiresAt / 1000), resource: new URL(token.audience), extra: { mcp_sub: token.mcpSubject } },
  });
}

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "content-type": "application/json", ...headers } });
}

function oauthError(error: unknown): { code: "invalid_request" | "server_error"; status: 400 | 500 } {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof ZodError || ["unregistered_redirect_uri", "invalid_resource_audience", "invalid_scope"].includes(message)) {
    return { code: "invalid_request", status: 400 };
  }
  return { code: "server_error", status: 500 };
}

export const externalMcpCapability = oauthIssuerCapability;
