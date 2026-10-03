import { describe, expect, it } from "vitest";
import { createExternalMcpFetchHandler } from "../../apps/mcp/src/server";
import type { DurableOAuthStore, OAuth21Config } from "../../apps/mcp/src/oauth";
import type { BuildmatesToolServices } from "../../packages/mcp-core/src/server";

const oauth: OAuth21Config = {
  issuer: "https://mcp.example",
  resource: "https://mcp.example/mcp",
  registeredRedirectUris: new Map([["client", ["https://client.example/callback"]]]),
  allowedScopes: new Set(["mcp:tools"]),
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 86_400,
};

describe("OAuth authorization response binding", () => {
  it("returns iss on a successful authorization redirect", async () => {
    const handler = createExternalMcpFetchHandler({
      oauth,
      store: storeWith({ issueAuthorizationCode: async () => "authorization-code" }),
      identityTools: {} as BuildmatesToolServices,
      async resolveAuthorizationIdentity() { return { issuer: "buildmates-web", subject: "user-1" }; },
    });
    const response = await handler(new Request(authorizationUrl()));
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://client.example");
    expect(location.searchParams.get("code")).toBe("authorization-code");
    expect(location.searchParams.get("state")).toBe("state-123");
    expect(location.searchParams.get("iss")).toBe(oauth.issuer);
  });

  it("returns login_required and iss after a validated request without redirecting malformed requests", async () => {
    const handler = createExternalMcpFetchHandler({
      oauth,
      store: storeWith(),
      identityTools: {} as BuildmatesToolServices,
      async resolveAuthorizationIdentity() { return null; },
    });
    const response = await handler(new Request(authorizationUrl()));
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("error")).toBe("login_required");
    expect(location.searchParams.get("state")).toBe("state-123");
    expect(location.searchParams.get("iss")).toBe(oauth.issuer);

    const malformed = new URL(authorizationUrl());
    malformed.searchParams.set("client_id", "unregistered-client");
    const rejected = await handler(new Request(malformed));
    expect(rejected.status).toBe(400);
    expect(rejected.headers.get("location")).toBeNull();
    await expect(rejected.json()).resolves.toEqual({ error: "invalid_request" });
  });

  it("returns server_error through the validated callback when code issuance fails", async () => {
    const handler = createExternalMcpFetchHandler({
      oauth,
      store: storeWith({ issueAuthorizationCode: async () => { throw new Error("storage_down"); } }),
      identityTools: {} as BuildmatesToolServices,
      async resolveAuthorizationIdentity() { return { issuer: "buildmates-web", subject: "user-1" }; },
    });
    const response = await handler(new Request(authorizationUrl()));
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("error")).toBe("server_error");
    expect(location.searchParams.get("iss")).toBe(oauth.issuer);
  });
});

function authorizationUrl(): string {
  const url = new URL("https://mcp.example/oauth/authorize");
  for (const [key, value] of Object.entries({
    response_type: "code",
    client_id: "client",
    redirect_uri: "https://client.example/callback",
    code_challenge: "y".repeat(43),
    code_challenge_method: "S256",
    scope: "mcp:tools",
    state: "state-123",
    resource: "https://mcp.example/mcp",
  })) url.searchParams.set(key, value);
  return url.toString();
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
