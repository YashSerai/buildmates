import { describe, expect, it } from "vitest";
import { createAuthorizationHandoff } from "../../apps/mcp/src/authorization-handoff";

describe("MCP authorization handoff origin binding", () => {
  it("rejects an authorization request received on a non-canonical origin", async () => {
    const handoff = createAuthorizationHandoff({
      DB: unusableDb(),
      webBaseUrl: "https://buildmates.example",
      mcpBaseUrl: "https://mcp.example",
      publicKeyPem: "unused",
      issuer: "buildmates-web",
      audience: "buildmates-mcp-authorization",
    });
    const response = await handoff.begin(new Request("https://attacker.example/oauth/authorize?client_id=client"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_handoff" });
  });

  it("rejects a callback delivered on a non-canonical origin before verifying claims", async () => {
    const handoff = createAuthorizationHandoff({
      DB: unusableDb(),
      webBaseUrl: "https://buildmates.example",
      mcpBaseUrl: "https://mcp.example",
      publicKeyPem: "not-a-key",
      issuer: "buildmates-web",
      audience: "buildmates-mcp-authorization",
    });
    const response = await handoff.complete(new Request("https://attacker.example/oauth/web-callback?handoff=state&assertion=token"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_handoff" });
  });

  it("does not resolve a cookie on a non-canonical MCP origin", async () => {
    const handoff = createAuthorizationHandoff({
      DB: unusableDb(),
      webBaseUrl: "https://buildmates.example",
      mcpBaseUrl: "https://mcp.example",
      publicKeyPem: "not-a-key",
      issuer: "buildmates-web",
      audience: "buildmates-mcp-authorization",
    });
    await expect(handoff.identity(new Request("https://attacker.example/oauth/authorize", { headers: { cookie: "bm_web_authorization=anything" } }))).resolves.toBeNull();
  });
});

function unusableDb(): D1Database {
  return { prepare() { throw new Error("database_should_not_be_called"); } } as unknown as D1Database;
}
