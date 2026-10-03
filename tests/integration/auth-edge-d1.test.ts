import { createHash } from "node:crypto";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createD1OAuthStore } from "../../apps/mcp/src/d1-oauth-store";
import { hashOAuthSecret } from "../../apps/mcp/src/oauth";
import { completeIdentityLink, createD1IdentityLinkStore, sha256 } from "../../apps/web/src/platform/identity-link-store";
import { applyD1Migrations } from "../helpers/migrate-d1";

const AUDIENCE = "https://mcp.example/mcp";
const VERIFIER = "v".repeat(64);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");

describe("auth edge D1 behavior", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch(){ return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    await applyD1Migrations(DB);
  });

  afterEach(async () => mf.dispose());

  it("rejects expired or mismatched authorization-code exchanges without consuming a valid code", async () => {
    const store = createD1OAuthStore(DB, "auth-edge-subject-secret-at-least-32-bytes");
    const expired = await store.issueAuthorizationCode({
      webIdentity: { issuer: "buildmates-web", subject: "expired-user" }, clientId: "client",
      redirectUri: "https://client.example/callback", codeChallenge: CHALLENGE, audience: AUDIENCE,
      scopes: ["mcp:tools"], expiresAt: Date.now() - 1,
    });
    await expect(store.exchangeAuthorizationCode({ code: expired, clientId: "client", redirectUri: "https://client.example/callback", codeVerifier: VERIFIER, audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();

    const code = await store.issueAuthorizationCode({
      webIdentity: { issuer: "buildmates-web", subject: "valid-user" }, clientId: "client",
      redirectUri: "https://client.example/callback", codeChallenge: CHALLENGE, audience: AUDIENCE,
      scopes: ["mcp:tools"], expiresAt: Date.now() + 60_000,
    });
    await expect(store.exchangeAuthorizationCode({ code, clientId: "other-client", redirectUri: "https://client.example/callback", codeVerifier: VERIFIER, audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();
    await expect(store.exchangeAuthorizationCode({ code, clientId: "client", redirectUri: "https://client.example/other", codeVerifier: VERIFIER, audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();
    await expect(store.exchangeAuthorizationCode({ code, clientId: "client", redirectUri: "https://client.example/callback", codeVerifier: VERIFIER, audience: "https://wrong.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();
    await expect(store.exchangeAuthorizationCode({ code, clientId: "client", redirectUri: "https://client.example/callback", codeVerifier: VERIFIER, audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.not.toBeNull();
  });

  it("fails closed for expired access and refresh tokens, revoked principals, and wrong-client revocation", async () => {
    const store = createD1OAuthStore(DB, "auth-edge-subject-secret-at-least-32-bytes");
    const issue = () => store.issueAuthorizationCode({
      webIdentity: { issuer: "buildmates-web", subject: crypto.randomUUID() }, clientId: "client",
      redirectUri: "https://client.example/callback", codeChallenge: CHALLENGE, audience: AUDIENCE,
      scopes: ["mcp:tools"], expiresAt: Date.now() + 60_000,
    });
    const expiredPair = await store.exchangeAuthorizationCode({ code: await issue(), clientId: "client", redirectUri: "https://client.example/callback", codeVerifier: VERIFIER, audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 });
    await DB.prepare("UPDATE oauth_tokens SET expires_at=? WHERE token_hash=?").bind(Date.now() - 1, hashOAuthSecret(expiredPair!.accessToken)).run();
    await expect(store.validateAccessToken(expiredPair!.accessToken, AUDIENCE)).resolves.toBeNull();
    await DB.prepare("UPDATE oauth_tokens SET expires_at=? WHERE token_hash=?").bind(Date.now() - 1, hashOAuthSecret(expiredPair!.refreshToken)).run();
    await expect(store.rotateRefreshToken({ refreshToken: expiredPair!.refreshToken, clientId: "client", audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();

    const revokedPrincipalPair = await store.exchangeAuthorizationCode({ code: await issue(), clientId: "client", redirectUri: "https://client.example/callback", codeVerifier: VERIFIER, audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 });
    await DB.prepare("UPDATE identity_principals SET revoked_at=? WHERE id=(SELECT principal_id FROM oauth_tokens WHERE token_hash=? LIMIT 1)").bind(Date.now(), hashOAuthSecret(revokedPrincipalPair!.accessToken)).run();
    await expect(store.validateAccessToken(revokedPrincipalPair!.accessToken, AUDIENCE)).resolves.toBeNull();
    await expect(store.rotateRefreshToken({ refreshToken: revokedPrincipalPair!.refreshToken, clientId: "client", audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();

    const revocablePair = await store.exchangeAuthorizationCode({ code: await issue(), clientId: "client", redirectUri: "https://client.example/callback", codeVerifier: VERIFIER, audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 });
    await store.revoke(revocablePair!.accessToken, "wrong-client");
    await expect(store.validateAccessToken(revocablePair!.accessToken, AUDIENCE)).resolves.not.toBeNull();
    await store.revoke(revocablePair!.accessToken, "client");
    await expect(store.validateAccessToken(revocablePair!.accessToken, AUDIENCE)).resolves.toBeNull();
    await expect(store.rotateRefreshToken({ refreshToken: revocablePair!.refreshToken, clientId: "client", audience: AUDIENCE, accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();
  });

  it("does not consume a link code when its MCP subject is already linked to another account", async () => {
    const now = Date.now();
    const code = "A".repeat(32);
    await DB.batch([
      DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES ('owner-a','active','none',?,?),('owner-b','active','none',?,?)").bind(now, now, now, now),
      DB.prepare("INSERT INTO identity_principals(id,channel,issuer,subject,workspace_scope,created_at) VALUES ('principal-a','mcp','buildmates_mcp','shared-mcp-subject','global',?)").bind(now),
      DB.prepare("INSERT INTO identity_links(id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at) VALUES ('link-a','owner-a','principal-a','mcp','buildmates_mcp','shared-mcp-subject','global',?)").bind(now),
      DB.prepare("INSERT INTO identity_link_codes(id,user_id,code_hash,workspace_scope,expires_at,attempt_count,max_attempts,created_at) VALUES ('code-b','owner-b',?,'global',?,0,5,?)").bind(await sha256(code), now + 60_000, now),
    ]);
    const result = await completeIdentityLink(createD1IdentityLinkStore(DB), { code, workspaceScope: "global", mcpSubject: "shared-mcp-subject", now });
    expect(result).toEqual({ linked: false, reason: "conflict" });
    expect(await DB.prepare("SELECT consumed_at AS consumedAt,attempt_count AS attemptCount FROM identity_link_codes WHERE id='code-b'").first()).toEqual({ consumedAt: null, attemptCount: 0 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM identity_links WHERE user_id='owner-b'").first()).toEqual({ count: 0 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM identity_principals WHERE subject='shared-mcp-subject'").first()).toEqual({ count: 1 });
  });
});
