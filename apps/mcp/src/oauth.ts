import { createHash } from "node:crypto";
import { z } from "zod";

export const authorizationRequestSchema = z.object({
  response_type: z.literal("code"), client_id: z.string().min(1), redirect_uri: z.string().url(),
  code_challenge: z.string().min(43).max(128), code_challenge_method: z.literal("S256"),
  scope: z.string().min(1), state: z.string().min(8), resource: z.string().url(),
});

export type OAuth21Config = {
  issuer: string;
  resource: string;
  registeredRedirectUris: ReadonlyMap<string, readonly string[]>;
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
    scopes_supported: [...config.allowedScopes], token_endpoint_auth_methods_supported: ["none"],
  } as const;
}

export function protectedResourceMetadata(config: OAuth21Config) {
  return { resource: config.resource, authorization_servers: [config.issuer], scopes_supported: [...config.allowedScopes] };
}

export function validateAuthorizationRequest(input: unknown, config: OAuth21Config) {
  const request = authorizationRequestSchema.parse(input);
  if (!(config.registeredRedirectUris.get(request.client_id) ?? []).includes(request.redirect_uri)) throw new Error("unregistered_redirect_uri");
  if (request.resource !== config.resource) throw new Error("invalid_resource_audience");
  const scopes = normalizeScopes(request.scope, config.allowedScopes);
  return { ...request, scopes };
}

export function normalizeScopes(value: string, allowed: ReadonlySet<string>): string[] {
  const scopes = [...new Set(value.split(/\s+/).filter(Boolean))];
  if (!scopes.length || scopes.some((scope) => !allowed.has(scope))) throw new Error("invalid_scope");
  return scopes;
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  return verifier.length >= 43 && verifier.length <= 128 && createHash("sha256").update(verifier).digest("base64url") === challenge;
}

export function hashOAuthSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export const oauthIssuerCapability = {
  contractImplemented: true,
  endpointsImplemented: true,
  durableStoreImplemented: true,
  streamableHttpImplemented: true,
  productionIssuerLive: false,
  missing: ["production deployment verification", "live identity-provider consent verification", "production key and secret rotation verification"],
} as const;
