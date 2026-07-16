import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { completeIdentityLink, createD1IdentityLinkStore, sha256 } from "../../apps/web/src/platform/identity-link-store";
import { createD1OAuthStore } from "../../apps/mcp/src/d1-oauth-store";
import { createAuthorizationHandoff } from "../../apps/mcp/src/authorization-handoff";
import { createExternalMcpFetchHandler } from "../../apps/mcp/src/server";
import { createMcpAuthorizationAssertion } from "../../apps/web/src/platform/mcp-authorization";
import { createPrivateCapabilityRepository } from "../../packages/database/src/private-capability-repository";
import { getIdentityConnectionStatus, revokeIdentityConnections } from "../../apps/web/src/platform/identity-connections";

describe("real local D1 platform boundaries", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    const files = (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort();
    for (const file of files) {
      const sql = await readFile(`apps/web/drizzle/${file}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await DB.prepare(statement).run();
    }
  });

  afterEach(async () => { await mf.dispose(); });

  it("allows exactly one concurrent identity-link consumer and persists convergence", async () => {
    const code = "D".repeat(32);
    await DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES ('web-alice','active','none',?,?)").bind(Date.now(),Date.now()).run();
    await DB.prepare("INSERT INTO identity_link_codes (id, user_id, code_hash, workspace_scope, expires_at, attempt_count, max_attempts, consumed_at, consumed_by_principal_id, created_at) VALUES (?, ?, ?, 'global', ?, 0, 5, NULL, NULL, ?)")
      .bind("code-one", "web-alice", await sha256(code), Date.now() + 60_000, Date.now()).run();
    const store = createD1IdentityLinkStore(DB);
    const results = await Promise.all([
      completeIdentityLink(store, { code, workspaceScope: "global", mcpSubject: "mcp_alice_one_123456" }),
      completeIdentityLink(store, { code, workspaceScope: "global", mcpSubject: "mcp_alice_two_123456" }),
    ]);
    expect(results.filter((result) => result.linked)).toHaveLength(1);
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM identity_links WHERE user_id = 'web-alice'").first<{ count: number }>()).toEqual({ count: 1 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM identity_principals").first<{ count: number }>()).toEqual({ count: 1 });
  });

  it("cannot link a deleted account with an unconsumed code", async () => {
    const now=Date.now(),code="E".repeat(32);
    await DB.batch([
      DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at,deleted_at) VALUES ('deleted-web','deleted','none',?,?,?)").bind(now,now,now),
      DB.prepare("INSERT INTO identity_link_codes(id,user_id,code_hash,workspace_scope,expires_at,attempt_count,max_attempts,created_at) VALUES ('deleted-code','deleted-web',?,'global',?,0,5,?)").bind(await sha256(code),now+60_000,now),
    ]);
    await expect(completeIdentityLink(createD1IdentityLinkStore(DB),{code,workspaceScope:"global",mcpSubject:"mcp_deleted_subject"})).resolves.toEqual({linked:false,reason:"invalid_or_expired"});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM identity_links WHERE user_id='deleted-web'").first()).toEqual({count:0});
    expect(await DB.prepare("SELECT status FROM users WHERE id='deleted-web'").first()).toEqual({status:"deleted"});
  });

  it("reports and revokes only the authenticated user's MCP connection", async () => {
    const now = Date.now();
    await DB.prepare("INSERT INTO identity_principals (id,channel,issuer,subject,workspace_scope,created_at) VALUES ('alice-principal','mcp','buildmates_mcp','mcp-alice','global',?),('bob-principal','mcp','buildmates_mcp','mcp-bob','global',?)")
      .bind(now, now).run();
    await DB.prepare("INSERT INTO identity_links (id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at) VALUES ('alice-link','web-alice','alice-principal','mcp','buildmates_mcp','mcp-alice','global',?),('bob-link','web-bob','bob-principal','mcp','buildmates_mcp','mcp-bob','global',?)")
      .bind(now - 1_000, now).run();
    await DB.prepare("INSERT INTO identity_link_codes (id,user_id,code_hash,workspace_scope,expires_at,attempt_count,max_attempts,created_at) VALUES ('alice-pending','web-alice',?,'global',?,0,5,?)")
      .bind(await sha256("A".repeat(32)), now + 60_000, now).run();

    await expect(getIdentityConnectionStatus(DB, "web-alice", "global")).resolves.toEqual({
      connected: true,
      connectionCount: 1,
      linkedAt: new Date(now - 1_000).toISOString(),
    });
    await expect(revokeIdentityConnections(DB, "web-alice", "global", now + 2_000)).resolves.toBe(true);
    await expect(getIdentityConnectionStatus(DB, "web-alice", "global")).resolves.toEqual({ connected: false, connectionCount: 0, linkedAt: null });
    await expect(getIdentityConnectionStatus(DB, "web-bob", "global")).resolves.toMatchObject({ connected: true, connectionCount: 1 });
    expect(await DB.prepare("SELECT revoked_at AS revokedAt FROM identity_principals WHERE id='alice-principal'").first<{ revokedAt: number | null }>()).toEqual({ revokedAt: now + 2_000 });
    expect(await DB.prepare("SELECT revoked_at AS revokedAt FROM identity_principals WHERE id='bob-principal'").first<{ revokedAt: number | null }>()).toEqual({ revokedAt: null });
    expect(await DB.prepare("SELECT expires_at AS expiresAt FROM identity_link_codes WHERE id='alice-pending'").first<{ expiresAt: number }>()).toEqual({ expiresAt: now + 2_000 });
  });

  it("enforces PKCE, audience, refresh single-use, and family revocation in D1", async () => {
    const store = createD1OAuthStore(DB, "test-subject-secret-at-least-32-bytes");
    const verifier = "v".repeat(64);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const code = await store.issueAuthorizationCode({
      webIdentity: { issuer: "chatgpt_sites", subject: "stable-web-alice" }, clientId: "codex",
      redirectUri: "https://chatgpt.com/callback", codeChallenge: challenge, audience: "https://mcp.example/mcp",
      scopes: ["mcp:tools"], expiresAt: Date.now() + 60_000,
    });
    await expect(store.exchangeAuthorizationCode({ code, clientId: "codex", redirectUri: "https://chatgpt.com/callback", codeVerifier: "x".repeat(64), audience: "https://mcp.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();
    const first = await store.exchangeAuthorizationCode({ code, clientId: "codex", redirectUri: "https://chatgpt.com/callback", codeVerifier: verifier, audience: "https://mcp.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 });
    expect(first).not.toBeNull();
    await expect(store.exchangeAuthorizationCode({ code, clientId: "codex", redirectUri: "https://chatgpt.com/callback", codeVerifier: verifier, audience: "https://mcp.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();
    await expect(store.validateAccessToken(first!.accessToken, "https://wrong.example/mcp")).resolves.toBeNull();
    const second = await store.rotateRefreshToken({ refreshToken: first!.refreshToken, clientId: "codex", audience: "https://mcp.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 });
    expect(second).not.toBeNull();
    await expect(store.rotateRefreshToken({ refreshToken: first!.refreshToken, clientId: "codex", audience: "https://mcp.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();
    await expect(store.validateAccessToken(first!.accessToken, "https://mcp.example/mcp")).resolves.toBeNull();
    await expect(store.validateAccessToken(second!.accessToken, "https://mcp.example/mcp")).resolves.toBeNull();
    await expect(store.rotateRefreshToken({ refreshToken: second!.refreshToken, clientId: "codex", audience: "https://mcp.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 })).resolves.toBeNull();

    const concurrentCode = await store.issueAuthorizationCode({
      webIdentity: { issuer: "chatgpt_sites", subject: "stable-web-bob" }, clientId: "codex",
      redirectUri: "https://chatgpt.com/callback", codeChallenge: challenge, audience: "https://mcp.example/mcp",
      scopes: ["mcp:tools"], expiresAt: Date.now() + 60_000,
    });
    const concurrentBase = await store.exchangeAuthorizationCode({ code: concurrentCode, clientId: "codex", redirectUri: "https://chatgpt.com/callback", codeVerifier: verifier, audience: "https://mcp.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 });
    const concurrent = await Promise.all([
      store.rotateRefreshToken({ refreshToken: concurrentBase!.refreshToken, clientId: "codex", audience: "https://mcp.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 }),
      store.rotateRefreshToken({ refreshToken: concurrentBase!.refreshToken, clientId: "codex", audience: "https://mcp.example/mcp", accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 }),
    ]);
    expect(concurrent.filter(Boolean)).toHaveLength(1);
    await expect(store.validateAccessToken(concurrent.find(Boolean)!.accessToken, "https://mcp.example/mcp")).resolves.toBeNull();
  });

  it("denies Alice access to Bob's private capability record", async () => {
    await DB.prepare("INSERT INTO private_capability_records (id, owner_user_id, value, created_at) VALUES ('alice-record', 'alice', 'alice-private', ?), ('bob-record', 'bob', 'bob-private', ?)")
      .bind(Date.now(), Date.now()).run();
    const repository = createPrivateCapabilityRepository(DB);
    await expect(repository.readForOwner("alice-record", "alice")).resolves.toEqual({ id: "alice-record", value: "alice-private" });
    await expect(repository.readForOwner("bob-record", "alice")).resolves.toBeNull();
  });

  it("completes signed one-time web authentication handoff before OAuth authorization", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    const privateKeyPem = await exportPKCS8(privateKey);
    const publicKeyPem = await exportSPKI(publicKey);
    const handoff = createAuthorizationHandoff({ DB, webBaseUrl: "https://web.example", mcpBaseUrl: "https://mcp.example", publicKeyPem, issuer: "buildmates-web", audience: "buildmates-mcp-authorization" });
    const store = createD1OAuthStore(DB, "test-subject-secret-at-least-32-bytes");
    const handler = createExternalMcpFetchHandler({
      oauth: { issuer: "https://mcp.example", resource: "https://mcp.example/mcp", registeredRedirectUris: new Map([["codex", ["https://chatgpt.com/callback"]]]), allowedScopes: new Set(["mcp:tools"]), accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 3600 },
      store, identityTools: { linkBaseUrl: "https://web.example", async allowAttempt() { return true; }, async completeIdentityLink() { return { linked: true }; } },
      resolveAuthorizationIdentity: (request) => handoff.identity(request), beginAuthorizationHandoff: (request) => handoff.begin(request),
    });
    const authorize = new URL("https://mcp.example/oauth/authorize");
    Object.entries({ response_type: "code", client_id: "codex", redirect_uri: "https://chatgpt.com/callback", code_challenge: "z".repeat(43), code_challenge_method: "S256", scope: "mcp:tools", state: "oauth-state", resource: "https://mcp.example/mcp" }).forEach(([key, value]) => authorize.searchParams.set(key, value));
    const begin = await handler(new Request(authorize));
    expect(begin.status).toBe(302);
    const webUrl = new URL(begin.headers.get("location")!);
    expect(webUrl.origin + webUrl.pathname).toBe("https://web.example/api/identity/mcp-authorization");
    const callback = new URL(webUrl.searchParams.get("return_to")!);
    const assertion = await createMcpAuthorizationAssertion(
      { channel: "web", issuer: "chatgpt_sites", subject: "stable-web-alice", workspaceScope: "global", displayName: null },
      { privateKeyPem, issuer: "buildmates-web", audience: "buildmates-mcp-authorization", keyId: "test" },
    );
    callback.searchParams.set("assertion", assertion);
    const completed = await handoff.complete(new Request(callback));
    expect(completed.status).toBe(302);
    await expect(handoff.complete(new Request(callback)).then((response) => response.status)).resolves.toBe(400);
    const cookie = completed.headers.get("set-cookie")!.split(";")[0];
    const resumed = await handler(new Request(completed.headers.get("location")!, { headers: { cookie } }));
    expect(resumed.status).toBe(302);
    expect(new URL(resumed.headers.get("location")!).searchParams.get("code")).toBeTruthy();
  });
});
