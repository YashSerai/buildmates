import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuthorizationHandoff } from "../../apps/mcp/src/authorization-handoff";
import { createMcpAuthorizationAssertion } from "../../apps/web/src/platform/mcp-authorization";
import { hashOAuthSecret } from "../../apps/mcp/src/oauth";
import { createExternalMcpFetchHandler } from "../../apps/mcp/src/server";
import type { DurableOAuthStore, OAuth21Config } from "../../apps/mcp/src/oauth";
import type { BuildmatesToolServices } from "../../packages/mcp-core/src/server";

describe("auth edge behavior", () => {
  let privateKeyPem: string;
  let publicKeyPem: string;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    privateKeyPem = await exportPKCS8(privateKey);
    publicKeyPem = await exportSPKI(publicKey);
  });

  it("normalizes malformed, expired, and wrong-issuer handoff assertions to 401", async () => {
    const handoff = createAuthorizationHandoff({
      DB: unusableDb(),
      webBaseUrl: "https://buildmates.example",
      mcpBaseUrl: "https://mcp.example",
      publicKeyPem,
      issuer: "buildmates-web",
      audience: "buildmates-mcp-authorization",
    });
    const callback = (assertion: string) => new Request(`https://mcp.example/oauth/web-callback?handoff=state-123&assertion=${encodeURIComponent(assertion)}`);
    const base = { channel: "web" as const, subject: "web-subject", workspaceScope: "global" as const, handoffHash: hashOAuthSecret("state-123") };
    const expired = await createMcpAuthorizationAssertion(base, { privateKeyPem, issuer: "buildmates-web", audience: "buildmates-mcp-authorization", keyId: "test", now: Math.floor(Date.now() / 1000) - 300 });
    const wrongIssuer = await createMcpAuthorizationAssertion(base, { privateKeyPem, issuer: "attacker-issuer", audience: "buildmates-mcp-authorization", keyId: "test" });

    for (const assertion of ["not-a-jwt", expired, wrongIssuer]) {
      const response = await handoff.complete(callback(assertion));
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "invalid_web_identity_assertion" });
    }
  });

  it("rejects an oversized callback before touching the handoff database", async () => {
    const handoff = createAuthorizationHandoff({
      DB: unusableDb(),
      webBaseUrl: "https://buildmates.example",
      mcpBaseUrl: "https://mcp.example",
      publicKeyPem: "unused",
      issuer: "buildmates-web",
      audience: "buildmates-mcp-authorization",
    });
    const response = await handoff.complete(new Request(`https://mcp.example/oauth/web-callback?handoff=state-123&assertion=${"x".repeat(5000)}`));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "request_uri_too_large" });
  });

  it("maps malformed token and revocation forms to bounded invalid_request responses", async () => {
    const runtime = {
      oauth: oauthConfig(),
      store: storeWith(),
      identityTools: {} as BuildmatesToolServices,
      async resolveAuthorizationIdentity() { return null; },
    };
    const handler = createExternalMcpFetchHandler(runtime);
    for (const path of ["/oauth/token", "/oauth/revoke"]) {
      const response = await handler(new Request(`https://mcp.example${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ malformed",
      }));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "invalid_request" });
    }
  });
});

function oauthConfig(): OAuth21Config {
  return {
    issuer: "https://mcp.example",
    resource: "https://mcp.example/mcp",
    registeredRedirectUris: new Map([["client", ["https://client.example/callback"]]]),
    allowedScopes: new Set(["mcp:tools"]),
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 86_400,
  };
}

function storeWith(overrides: Partial<DurableOAuthStore> = {}): DurableOAuthStore {
  return {
    async issueAuthorizationCode() { return "code"; },
    async exchangeAuthorizationCode() { return null; },
    async rotateRefreshToken() { return null; },
    async validateAccessToken() { return null; },
    async revoke() {},
    ...overrides,
  };
}

function unusableDb(): D1Database {
  return { prepare() { throw new Error("database_should_not_be_called"); } } as unknown as D1Database;
}
