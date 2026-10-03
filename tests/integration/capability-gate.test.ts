import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateKeyPair, exportSPKI, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runD1Diagnostic, type D1Like } from "../../apps/web/src/platform/d1";
import { runR2Diagnostic } from "../../apps/web/src/platform/r2";
import { verifyDelegatedRequest } from "../../apps/web/src/platform/delegated-request";
import { BUILD_MATES_MCP_TOOLS, buildmatesToolRegistry } from "../../packages/mcp-core/src/server";
import { canonicalToolInputHash } from "../../packages/mcp-core/src/tool-hash";
import { completeIdentityLink, sha256, type IdentityLinkStore } from "../../apps/web/src/platform/identity-link-store";
import { createExternalMcpFetchHandler } from "../../apps/mcp/src/server";
import type { DurableOAuthStore, OAuthTokenPair, ValidatedAccessToken } from "../../apps/mcp/src/oauth";

describe("platform capability gate", () => {
  it("keeps logical Sites bindings and one complete shared MCP registry", async () => {
    const manifest = JSON.parse(await readFile(resolve("apps/web/.openai/hosting.json"), "utf8"));
    expect(manifest).toMatchObject({ project_id: expect.stringMatching(/^appgprj_/), d1: "DB", r2: "ASSETS" });
    expect(BUILD_MATES_MCP_TOOLS.slice(0, 2)).toEqual(["get_link_url", "complete_identity_link"]);
    expect(BUILD_MATES_MCP_TOOLS).toHaveLength(54);
    expect(BUILD_MATES_MCP_TOOLS).toContain("create_surface_asset_upload_grant");
    expect(BUILD_MATES_MCP_TOOLS).toContain("attach_profile_project_media");
    expect(BUILD_MATES_MCP_TOOLS).toContain("validate_surface_spec");
    expect(BUILD_MATES_MCP_TOOLS).toContain("submit_surface_revision");
    expect(new Set(BUILD_MATES_MCP_TOOLS).size).toBe(BUILD_MATES_MCP_TOOLS.length);

    const catalogSchemas = buildmatesToolRegistry.map((definition) => ({
      name: definition.name,
      bytes: Buffer.byteLength(JSON.stringify(z.toJSONSchema(definition.input)), "utf8"),
    }));
    expect(catalogSchemas.filter(({ bytes }) => bytes > 16_000)).toEqual([]);
  });

  it("proves actor-scoped D1 insert/read/delete without leaking the actor", async () => {
    const rows = new Map<string, { id: string; actorKey: string }>();
    const db: D1Like = {
      prepare(query) {
        let values: unknown[] = [];
        return { bind(...next) { values = next; return {
          async run() {
            if (query.startsWith("INSERT")) rows.set(String(values[0]), { id: String(values[0]), actorKey: String(values[1]) });
            if (query.startsWith("DELETE")) rows.delete(String(values[0]));
            return { success: true };
          },
          async first<T>() {
            const row = rows.get(String(values[0]));
            return (row?.actorKey === values[1] ? row : null) as T | null;
          },
        }; } };
      },
    };
    await expect(runD1Diagnostic(db, "actor-secret")).resolves.toEqual({ binding: "DB", insert: true, read: true, delete: true });
    expect(rows.size).toBe(0);
  });

  it("proves R2 write/read/delete cleanup", async () => {
    const objects = new Map<string, string>();
    const result = await runR2Diagnostic({
      async put(key, value) { objects.set(key, value); },
      async get(key) { const value = objects.get(key); return value === undefined ? null : { async text() { return value; } }; },
      async delete(key) { objects.delete(key); },
    }, "actor");
    expect(result).toEqual({ binding: "ASSETS", put: true, read: true, delete: true });
    expect(objects.size).toBe(0);
  });

  it("validates delegated claims and rejects replay", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const publicKeyPem = await exportSPKI(publicKey);
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ action: "identity.link-status.read", scope: "identity:link-status:read" })
      .setProtectedHeader({ alg: "RS256" }).setIssuer("buildmates-mcp").setAudience("buildmates-web-data")
      .setSubject("mcp_opaque_subject_123456789").setJti("once").setIssuedAt(now).setExpirationTime(now + 60).sign(privateKey);
    const seen = new Set<string>();
    const verify = () => verifyDelegatedRequest({
      authorization: `Bearer ${token}`, publicKeyPem, issuer: "buildmates-mcp", audience: "buildmates-web-data",
      expectedAction: "identity.link-status.read", expectedScope: "identity:link-status:read",
      consumeReplay: async (claims) => !seen.has(claims.jti) && Boolean(seen.add(claims.jti)),
    });
    await expect(verify()).resolves.toMatchObject({ sub: "mcp_opaque_subject_123456789", jti: "once" });
    await expect(verify()).rejects.toThrow("replayed_assertion");
  });

  it("binds delegated tool assertions to the exact tool and canonical request input", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const publicKeyPem = await exportSPKI(publicKey);
    const now = Math.floor(Date.now() / 1000);
    const input = { workspaceScope: "global", profileId: "profile-1" };
    const inputHash = await canonicalToolInputHash(input);
    const token = await new SignJWT({ action: "tool.execute:get_profile_model", scope: "mcp:tool:get_profile_model", tool: "get_profile_model", input_hash: inputHash })
      .setProtectedHeader({ alg: "RS256" }).setIssuer("buildmates-mcp").setAudience("buildmates-web-data")
      .setSubject("mcp_opaque_subject_123456789").setJti("tool-once").setIssuedAt(now).setExpirationTime(now + 60).sign(privateKey);
    const verify = (expectedTool: string, expectedInputHash: string) => verifyDelegatedRequest({
      authorization: `Bearer ${token}`, publicKeyPem, issuer: "buildmates-mcp", audience: "buildmates-web-data",
      expectedAction: `tool.execute:${expectedTool}`, expectedScope: `mcp:tool:${expectedTool}`, expectedTool, expectedInputHash,
      consumeReplay: async () => true,
    });
    await expect(verify("get_profile_model", inputHash)).resolves.toMatchObject({ tool: "get_profile_model", input_hash: inputHash });
    await expect(verify("get_networking_pulse", inputHash)).rejects.toThrow("invalid_delegated_claims");
    await expect(verify("get_profile_model", await canonicalToolInputHash({ ...input, profileId: "tampered" }))).rejects.toThrow("invalid_delegated_claims");
  });

  it("atomically converges one web user and one MCP subject under concurrent code consumption", async () => {
    const code = "A".repeat(32);
    const codeHash = await sha256(code);
    let consumed = false;
    const links = new Map<string, string>();
    const store: IdentityLinkStore = {
      async consume(input) {
        if (input.codeHash !== codeHash || consumed) return { linked: false, reason: "invalid_or_expired" };
        consumed = true;
        links.set(input.mcpSubject, "web-user-one");
        return { linked: true, userId: "web-user-one" };
      },
    };
    const attempts = await Promise.all([
      completeIdentityLink(store, { code, workspaceScope: "global", mcpSubject: "mcp_subject_one_123456" }),
      completeIdentityLink(store, { code, workspaceScope: "global", mcpSubject: "mcp_subject_two_123456" }),
    ]);
    expect(attempts.filter((result) => result.linked)).toHaveLength(1);
    const winner = attempts.find((result) => result.linked);
    expect(winner).toMatchObject({ linked: true, userId: "web-user-one" });
    expect([...links.values()]).toEqual(["web-user-one"]);
  });

  it("keeps two web identities isolated while converging each explicit MCP link", async () => {
    const codes = new Map([
      [await sha256("B".repeat(32)), { userId: "web-alice", consumed: false }],
      [await sha256("C".repeat(32)), { userId: "web-bob", consumed: false }],
    ]);
    const links = new Map<string, string>();
    const store: IdentityLinkStore = {
      async consume(input) {
        const record = codes.get(input.codeHash);
        if (!record || record.consumed) return { linked: false, reason: "invalid_or_expired" };
        record.consumed = true;
        links.set(input.mcpSubject, record.userId);
        return { linked: true, userId: record.userId };
      },
    };
    await completeIdentityLink(store, { code: "B".repeat(32), workspaceScope: "global", mcpSubject: "mcp_alice_subject_1234" });
    await completeIdentityLink(store, { code: "C".repeat(32), workspaceScope: "global", mcpSubject: "mcp_bob_subject_123456" });
    expect(links.get("mcp_alice_subject_1234")).toBe("web-alice");
    expect(links.get("mcp_bob_subject_123456")).toBe("web-bob");
    expect(new Set(links.values()).size).toBe(2);
  });

  it("serves executable OAuth endpoints and token-authenticated Streamable HTTP", async () => {
    let revoked = false;
    const pair: OAuthTokenPair = { accessToken: "access", refreshToken: "refresh", expiresIn: 900, scope: "mcp:tools" };
    const access: ValidatedAccessToken = { mcpSubject: "mcp_runtime_subject_123456", clientId: "codex", scopes: ["mcp:tools"], audience: "https://mcp.example/mcp", expiresAt: Date.now() + 900_000 };
    const store: DurableOAuthStore = {
      async issueAuthorizationCode() { return "authorization-code"; },
      async exchangeAuthorizationCode(input) { return input.code === "authorization-code" ? pair : null; },
      async rotateRefreshToken(input) { return input.refreshToken === "refresh" ? pair : null; },
      async validateAccessToken(token) { return token === "access" && !revoked ? access : null; },
      async revoke(token) { if (token === "access") revoked = true; },
    };
    const handler = createExternalMcpFetchHandler({
      oauth: {
        issuer: "https://mcp.example", resource: "https://mcp.example/mcp",
        registeredRedirectUris: new Map([["codex", ["https://chatgpt.com/callback"]]]),
        dynamicClientRegistrationSecret: "test-dynamic-client-registration-secret-32-bytes",
        allowedScopes: new Set(["mcp:tools"]), accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 86400,
      },
      store,
      identityTools: { linkBaseUrl: "https://buildmates.example", async completeIdentityLink() { return { linked: true }; }, async allowAttempt() { return true; } },
      async resolveAuthorizationIdentity() { return { issuer: "chatgpt_sites", subject: "web-subject-alice" }; },
    });
    const discovery = await handler(new Request("https://mcp.example/.well-known/oauth-authorization-server"));
    expect(await discovery.json()).toMatchObject({ authorization_endpoint: "https://mcp.example/oauth/authorize", registration_endpoint: "https://mcp.example/oauth/register", code_challenge_methods_supported: ["S256"] });

    const registration = await handler(new Request("https://mcp.example/oauth/register", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["http://127.0.0.1:43119/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], client_name: "Codex", software_version: "0.142.0" }),
    }));
    expect(registration.status).toBe(201);
    const dynamicClient = await registration.json() as { client_id: string };
    expect(dynamicClient.client_id).toMatch(/^bm\./);
    const dynamicAuthUrl = new URL("https://mcp.example/oauth/authorize");
    Object.entries({ response_type: "code", client_id: dynamicClient.client_id, redirect_uri: "http://127.0.0.1:43119/callback", code_challenge: "y".repeat(43), code_challenge_method: "S256", scope: "mcp:tools", state: "state-456", resource: "https://mcp.example/mcp" }).forEach(([key, value]) => dynamicAuthUrl.searchParams.set(key, value));
    expect((await handler(new Request(dynamicAuthUrl, { redirect: "manual" }))).status).toBe(302);

    const unsafeRegistration = await handler(new Request("https://mcp.example/oauth/register", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["https://attacker.example/callback"], token_endpoint_auth_method: "none" }),
    }));
    expect(unsafeRegistration.status).toBe(400);
    expect(await unsafeRegistration.json()).toEqual({ error: "invalid_redirect_uri" });

    const tamperedAuthUrl = new URL(dynamicAuthUrl);
    tamperedAuthUrl.searchParams.set("client_id", `${dynamicClient.client_id}x`);
    expect((await handler(new Request(tamperedAuthUrl, { redirect: "manual" }))).status).toBe(400);

    const dynamicToken = await handler(formRequest("https://mcp.example/oauth/token", { grant_type: "authorization_code", client_id: dynamicClient.client_id, code: "authorization-code", redirect_uri: "http://127.0.0.1:43119/callback", code_verifier: "v".repeat(43), resource: "https://mcp.example/mcp" }));
    expect(await dynamicToken.json()).toMatchObject({ access_token: "access", refresh_token: "refresh" });

    const oversizedRegistration = await handler(new Request("https://mcp.example/oauth/register", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: ["http://127.0.0.1:43119/callback"], client_name: "x".repeat(9000) }),
    }));
    expect(oversizedRegistration.status).toBe(400);

    const confidentialRegistration = await handler(new Request("https://mcp.example/oauth/register", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: ["http://127.0.0.1:43119/callback"], token_endpoint_auth_method: "client_secret_post" }),
    }));
    expect(confidentialRegistration.status).toBe(400);

    const authUrl = new URL("https://mcp.example/oauth/authorize");
    Object.entries({ response_type: "code", client_id: "codex", redirect_uri: "https://chatgpt.com/callback", code_challenge: "x".repeat(43), code_challenge_method: "S256", scope: "mcp:tools", state: "state-123", resource: "https://mcp.example/mcp" }).forEach(([key, value]) => authUrl.searchParams.set(key, value));
    const authorization = await handler(new Request(authUrl, { redirect: "manual" }));
    expect(authorization.status).toBe(302);
    expect(new URL(authorization.headers.get("location")!).searchParams.get("code")).toBe("authorization-code");

    const invalidAuthorization = new URL(authUrl);
    invalidAuthorization.searchParams.set("client_id", "unregistered-client");
    const rejectedAuthorization = await handler(new Request(invalidAuthorization, { redirect: "manual" }));
    expect(rejectedAuthorization.status).toBe(400);
    expect(await rejectedAuthorization.json()).toEqual({ error: "invalid_request" });

    const malformedAuthorization = await handler(new Request("https://mcp.example/oauth/authorize", { redirect: "manual" }));
    expect(malformedAuthorization.status).toBe(400);
    expect(await malformedAuthorization.json()).toEqual({ error: "invalid_request" });

    const token = await handler(formRequest("https://mcp.example/oauth/token", { grant_type: "authorization_code", client_id: "codex", code: "authorization-code", redirect_uri: "https://chatgpt.com/callback", code_verifier: "v".repeat(43), resource: "https://mcp.example/mcp" }));
    expect(await token.json()).toMatchObject({ access_token: "access", refresh_token: "refresh", token_type: "Bearer" });

    const unauthorized = await handler(new Request("https://mcp.example/mcp", { method: "POST" }));
    expect(unauthorized.status).toBe(401);
    const authenticate = unauthorized.headers.get("www-authenticate");
    const metadataUrl = authenticate?.match(/resource_metadata="([^"]+)"/)?.[1];
    expect(metadataUrl).toBe("https://mcp.example/.well-known/oauth-protected-resource");
    const protectedResource = await handler(new Request(metadataUrl!));
    expect(protectedResource.status).toBe(200);
    expect(await protectedResource.json()).toMatchObject({ resource: "https://mcp.example/mcp" });
    const initialized = await handler(new Request("https://mcp.example/mcp", {
      method: "POST",
      headers: { authorization: "Bearer access", accept: "application/json, text/event-stream", "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } } }),
    }));
    expect(initialized.status).toBe(200);
    expect(await initialized.json()).toMatchObject({ result: { serverInfo: { name: "buildmates" } } });

    const revoke = await handler(formRequest("https://mcp.example/oauth/revoke", { token: "access", client_id: "codex" }));
    expect(revoke.status).toBe(200);
    expect((await handler(new Request("https://mcp.example/mcp", { method: "POST", headers: { authorization: "Bearer access" } }))).status).toBe(401);
  });
});

function formRequest(url: string, fields: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
}
