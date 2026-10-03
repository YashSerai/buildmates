import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const authorizationRequestSchema = z.object({
  response_type: z.literal("code"), client_id: z.string().min(1), redirect_uri: z.string().url(),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/), code_challenge_method: z.literal("S256"),
  scope: z.string().min(1), state: z.string().min(8), resource: z.string().url(),
});

const dynamicClientRegistrationSchema = z.object({
  redirect_uris: z.array(z.string().url().max(1024)).min(1).max(4),
  token_endpoint_auth_method: z.literal("none").optional().default("none"),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).min(1).max(2).optional().default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).length(1).optional().default(["code"]),
  client_name: z.string().trim().min(1).max(100).optional(),
}).passthrough();

export type OAuth21Config = {
  issuer: string;
  resource: string;
  registeredRedirectUris: ReadonlyMap<string, readonly string[]>;
  dynamicClientRegistrationSecret?: string;
  allowedScopes: ReadonlySet<string>;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
};

export type AuthorizedWebIdentity = { issuer: string; subject: string };
export type OAuthTokenPair = { accessToken: string; refreshToken: string; expiresIn: number; scope: string };
export type ValidatedAccessToken = { mcpSubject: string; clientId: string; scopes: string[]; audience: string; expiresAt: number };

export interface DurableOAuthStore {
  issueAuthorizationCode(input: {
    webIdentity: AuthorizedWebIdentity; clientId: string; redirectUri: string; codeChallenge: string;
    audience: string; scopes: string[]; expiresAt: number;
  }): Promise<string>;
  exchangeAuthorizationCode(input: {
    code: string; clientId: string; redirectUri: string; codeVerifier: string; audience: string;
    accessTokenTtlSeconds: number; refreshTokenTtlSeconds: number;
  }): Promise<OAuthTokenPair | null>;
  rotateRefreshToken(input: {
    refreshToken: string; clientId: string; audience: string; accessTokenTtlSeconds: number; refreshTokenTtlSeconds: number;
  }): Promise<OAuthTokenPair | null>;
  validateAccessToken(token: string, audience: string): Promise<ValidatedAccessToken | null>;
  revoke(token: string, clientId: string): Promise<void>;
}

export function oauthDiscovery(config: OAuth21Config) {
  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/oauth/authorize`, token_endpoint: `${config.issuer}/oauth/token`,
    revocation_endpoint: `${config.issuer}/oauth/revoke`, response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true,
    scopes_supported: [...config.allowedScopes], token_endpoint_auth_methods_supported: ["none"],
    ...(config.dynamicClientRegistrationSecret ? { registration_endpoint: `${config.issuer}/oauth/register` } : {}),
  } as const;
}

export function protectedResourceMetadata(config: OAuth21Config) {
  return { resource: config.resource, authorization_servers: [config.issuer], scopes_supported: [...config.allowedScopes] };
}

export function validateAuthorizationRequest(input: unknown, config: OAuth21Config) {
  const request = authorizationRequestSchema.parse(input);
  if (!isRegisteredRedirect(config, request.client_id, request.redirect_uri)) throw new Error("unregistered_redirect_uri");
  if (request.resource !== config.resource) throw new Error("invalid_resource_audience");
  const scopes = normalizeScopes(request.scope, config.allowedScopes);
  return { ...request, scopes };
}

export function registerDynamicClient(input: unknown, config: OAuth21Config) {
  if (!config.dynamicClientRegistrationSecret) throw new Error("dynamic_registration_disabled");
  const metadata = dynamicClientRegistrationSchema.parse(input);
  const raw = input as Record<string, unknown>;
  if (["software_statement", "jwks", "jwks_uri", "client_secret", "client_secret_expires_at"].some((key) => key in raw)) throw new Error("invalid_client_metadata");
  const redirectUris = [...new Set(metadata.redirect_uris)];
  if (redirectUris.length !== metadata.redirect_uris.length || redirectUris.some((uri) => !isSafeNativeRedirect(uri))) {
    throw new Error("invalid_client_metadata");
  }
  const grantTypes = [...new Set(metadata.grant_types)];
  if (!grantTypes.includes("authorization_code") || (grantTypes.includes("refresh_token") && grantTypes[0] !== "authorization_code")) throw new Error("invalid_client_metadata");
  const issuedAt = Math.floor(Date.now() / 1000);
  const responseTypes = ["code"] as const;
  const payload = Buffer.from(JSON.stringify({ v: 1, kid: "dcr-v1", redirectUris, authMethod: "none", grantTypes, responseTypes, scope: "mcp:tools", issuedAt })).toString("base64url");
  const signature = signDynamicClient(payload, config.dynamicClientRegistrationSecret);
  return {
    client_id: `bm.${payload}.${signature}`,
    client_id_issued_at: issuedAt,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none",
    grant_types: grantTypes,
    response_types: responseTypes,
    ...(metadata.client_name ? { client_name: metadata.client_name } : {}),
  };
}

export function isRegisteredRedirect(config: OAuth21Config, clientId: string, redirectUri: string): boolean {
  if ((config.registeredRedirectUris.get(clientId) ?? []).includes(redirectUri)) return true;
  if (isRegisteredChatGptRedirect(clientId, redirectUri)) return true;
  const secret = config.dynamicClientRegistrationSecret;
  if (!secret || !clientId.startsWith("bm.")) return false;
  const parts = clientId.split(".");
  if (parts.length !== 3) return false;
  const [, payload, signature] = parts;
  const expected = signDynamicClient(payload, secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return false;
  try {
    const parsed = z.object({
      v: z.literal(1),
      kid: z.literal("dcr-v1"),
      redirectUris: z.array(z.string().url()).min(1).max(4),
      authMethod: z.literal("none"),
      grantTypes: z.array(z.enum(["authorization_code", "refresh_token"])).min(1).max(2),
      responseTypes: z.tuple([z.literal("code")]),
      scope: z.literal("mcp:tools"),
      issuedAt: z.number().int().positive(),
    }).strict().parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    const ageSeconds = Math.floor(Date.now() / 1000) - parsed.issuedAt;
    return ageSeconds >= -300 && ageSeconds <= 90 * 24 * 60 * 60 && parsed.redirectUris.includes(redirectUri) && parsed.redirectUris.every(isSafeNativeRedirect);
  } catch {
    return false;
  }
}

function signDynamicClient(payload: string, secret: string): string {
  return createHmac("sha256", secret).update("buildmates-oauth-client-registration-v1\0").update(payload).digest("base64url");
}

function isSafeNativeRedirect(value: string): boolean {
  const url = new URL(value);
  if (url.username || url.password || url.hash) return false;
  if (url.protocol !== "http:") return false;
  return ["127.0.0.1", "[::1]"].includes(url.hostname);
}

export function normalizeScopes(value: string, allowed: ReadonlySet<string>): string[] {
  const scopes = [...new Set(value.split(/\s+/).filter(Boolean))];
  if (!scopes.length || scopes.some((scope) => !allowed.has(scope))) throw new Error("invalid_scope");
  return scopes;
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) return false;
  const expected = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashOAuthSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export const oauthIssuerCapability = {
  contractImplemented: true,
  endpointsImplemented: true,
  durableStoreImplemented: true,
  streamableHttpImplemented: true,
  issuerIdentificationImplemented: true,
  cimdClientValidationImplemented: true,
  productionIssuerLive: false,
  missing: ["production deployment verification", "live identity-provider consent verification", "production key and secret rotation verification"],
} as const;

/**
 * ChatGPT now prefers a stable client identity supplied as a Client ID
 * Metadata Document (CIMD). Keep the trust boundary narrow: only the exact
 * ChatGPT origin and its documented callback shapes are accepted. This is a
 * pinned first-party client integration, so it does not fetch arbitrary
 * user-supplied metadata URLs. Codex's public client still uses the signed
 * loopback registration path above.
 */
export function isRegisteredChatGptRedirect(clientId: string, redirectUri: string): boolean {
  const client = parseChatGptClientId(clientId);
  if (!client) return false;
  try {
    const redirect = new URL(redirectUri);
    if (redirect.origin !== "https://chatgpt.com" || redirect.username || redirect.password || redirect.hash || redirect.search) return false;
    if (client.kind === "stable") return redirect.href === "https://chatgpt.com/connector_platform_oauth_redirect";
    return redirect.pathname === `/connector/oauth/${client.callbackId}` && redirect.href === `https://chatgpt.com/connector/oauth/${client.callbackId}`;
  } catch {
    return false;
  }
}

function parseChatGptClientId(value: string): { kind: "stable" } | { kind: "callback"; callbackId: string } | null {
  try {
    const client = new URL(value);
    if (client.origin !== "https://chatgpt.com" || client.username || client.password || client.search || client.hash) return null;
    if (client.pathname === "/oauth/client.json") return { kind: "stable" };
    const match = client.pathname.match(/^\/oauth\/([A-Za-z0-9_-]+)\/client\.json$/);
    return match ? { kind: "callback", callbackId: match[1] } : null;
  } catch {
    return null;
  }
}
