import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { DESIGN_POLICY_VERSION } from "@buildmates/surfaces";
import { createBuildmatesMcpServer, createMemoryMcpProductRepository, executeBuildmatesTool, type BuildmatesToolServices } from "@buildmates/mcp-core";

function account() {
  const repository = createMemoryMcpProductRepository();
  const services: BuildmatesToolServices = { repository, linkBaseUrl: "https://buildmates.example", resolveLinkedUser: async () => ({ userId: "alice" }), completeIdentityLink: async () => ({ linked: false, reason: "invalid_or_expired" }), allowAttempt: async () => true, validateTaxonomy: async () => true };
  const spec = { schemaVersion: "3", designPolicyVersion: DESIGN_POLICY_VERSION, kind: "profile", title: "Alice's page", document: { html: '<main><h1>{{profile.displayName}}</h1><p>{{profile.summary}}</p></main>', css: 'main{padding:2rem;color:#111;background:#fff}@media(max-width:600px){main{padding:1rem}}@media(prefers-reduced-motion:reduce){*{animation:none}}' }, bindingManifest: { content: [{ key: "profile.displayName", type: "text" }, { key: "profile.summary", type: "text" }], media: [] }, approvedAssets: [], responsive: { desktopMinHeight: 800, phoneMinHeight: 900 }, accessibility: { label: "Alice's profile", reducedMotion: "required" } };
  const save = async (ownerUserId = "alice", surfaceId = "surface_alice") => {
    await repository.write({ kind: "surface", id: surfaceId, ownerUserId, value: { kind: "profile", authorizedContent: { "profile.displayName": 'Alice <img src="https://evil.example/x">', "profile.summary": "Approved public work" }, authorizedMedia: [], approvedAssets: [] }, now: "2026-10-02T12:00:00Z" });
    await repository.write({ kind: "surface_revision", id: "revision_alice", ownerUserId, value: { surfaceId, spec, status: "preview" }, now: "2026-10-02T12:00:00Z" });
  };
  const call = (input: unknown) => executeBuildmatesTool("get_surface_preview", input, "alice_oauth_principal", services);
  return { repository, services, save, call, spec };
}

describe("private generated designs inside chat", () => {
  it("resumes a saved design in a new conversation without changing its publication state", async () => {
    const { save, services, spec } = account();
    await save();
    await expect(executeBuildmatesTool("get_surface_revision", { surfaceId: "surface_alice", revisionId: "revision_alice" }, "fresh_alice_conversation", services)).resolves.toMatchObject({ surfaceId: "surface_alice", revision: { spec, status: "preview" } });
    const history = await executeBuildmatesTool("get_surface_history", { surfaceId: "surface_alice", limit: 1 }, "fresh_alice_conversation", services);
    expect(history).toMatchObject({ surfaceId: "surface_alice", revisions: [{ id: "revision_alice", status: "preview" }], nextCursor: null });
    expect(JSON.stringify(history)).not.toContain("<main>");
  });
  it("filters design history before pagination and denies another owner's history", async () => {
    const { save, services, repository, spec } = account();
    await save();
    await repository.write({ kind: "surface_revision", id: "aaa_unrelated", ownerUserId: "alice", value: { surfaceId: "unrelated_surface", spec, status: "preview" }, now: "2026-10-02T12:00:00Z" });
    await expect(executeBuildmatesTool("get_surface_history", { surfaceId: "surface_alice", limit: 1 }, "alice_oauth_principal", services)).resolves.toMatchObject({ revisions: [{ id: "revision_alice" }], nextCursor: null });
    const outsider = { ...services, resolveLinkedUser: async () => ({ userId: "bob" }) };
    await expect(executeBuildmatesTool("get_surface_history", { surfaceId: "surface_alice" }, "bob_oauth_principal", outsider)).rejects.toThrow("object_not_found_or_not_authorized");
    await expect(executeBuildmatesTool("get_surface_revision", { surfaceId: "surface_alice", revisionId: "revision_alice" }, "bob_oauth_principal", outsider)).rejects.toThrow("object_not_found_or_not_authorized");
  });
  it("renders reviewed data with escaped markup and a network-free scriptless document without publication", async () => {
    const { save, call, repository } = account();
    await save();
    const response = await call({ surfaceId: "surface_alice", revisionId: "revision_alice" }) as { surfacePreview: { html: string } };
    expect(response.surfacePreview.html).toContain("Alice &lt;img");
    expect(response.surfacePreview.html).toContain("script-src 'none'");
    expect(response.surfacePreview.html).toContain("connect-src 'none'");
    expect(response.surfacePreview.html).not.toMatch(/<script|<img/i);
    expect((await repository.readForMember<{ status: string }>("surface_revision", "revision_alice", "alice"))?.value.status).toBe("preview");
  });
  it("cannot preview somebody else's saved design", async () => {
    const { save, call } = account();
    await save("bob");
    await expect(call({ surfaceId: "surface_alice", revisionId: "revision_alice" })).rejects.toThrow("object_not_found_or_not_authorized");
  });
  it("rejects a revision attached to a different surface", async () => {
    const { save, call, repository } = account();
    await save("alice", "other_surface");
    await repository.write({ kind: "surface", id: "surface_alice", ownerUserId: "alice", value: { kind: "profile" }, now: "2026-10-02T12:00:00Z" });
    await expect(call({ surfaceId: "surface_alice", revisionId: "revision_alice" })).rejects.toThrow("revision_surface_mismatch");
  });
  it("keeps preview bytes out of model text while delivering them to the host application", async () => {
    const { services, save } = account();
    await save();
    const server = createBuildmatesMcpServer(services);
    const client = new Client({ name: "preview-contract", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const send = clientTransport.send.bind(clientTransport);
    clientTransport.send = (message, options) => send(message, { ...options, authInfo: { token: "local-test-token", clientId: "local-client", scopes: ["mcp:tools"], extra: { mcp_sub: "alice_oauth_principal" } } });
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const response = await client.callTool({ name: "get_surface_preview", arguments: { surfaceId: "surface_alice", revisionId: "revision_alice" } });
      expect(response.isError).toBe(false);
      expect(JSON.stringify(response.content)).not.toContain("<!doctype html>");
      expect(JSON.stringify(response.structuredContent)).not.toContain("<!doctype html>");
      expect(response._meta).toMatchObject({ surfacePreview: { surfaceId: "surface_alice", html: expect.stringContaining("<!doctype html>") } });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
