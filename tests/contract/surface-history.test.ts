import { describe, expect, it } from "vitest";
import { createMemoryMcpProductRepository, executeBuildmatesTool, type BuildmatesToolServices } from "@buildmates/mcp-core";

function servicesFor(repository: ReturnType<typeof createMemoryMcpProductRepository>, links: Map<string, string>): BuildmatesToolServices {
  return {
    linkBaseUrl: "https://buildmates.example",
    repository,
    now: () => new Date("2026-10-02T12:00:00.000Z"),
    allowAttempt: async () => true,
    resolveLinkedUser: async ({ mcpSubject }) => {
      const userId = links.get(mcpSubject);
      return userId ? { userId } : null;
    },
    completeIdentityLink: async () => ({ linked: false, reason: "unsupported" }),
  };
}

describe("surface history pagination", () => {
  it("filters by surface, pages authorized revisions, and returns metadata without source", async () => {
    const repository = createMemoryMcpProductRepository();
    const links = new Map([["subject-alice-000001", "user_alice"]]);
    const services = servicesFor(repository, links);
    await repository.write({ kind: "surface", id: "surface-profile", ownerUserId: "user_alice", value: { kind: "profile" }, now: "2026-10-02T12:00:00.000Z" });
    await repository.write({ kind: "surface", id: "surface-other", ownerUserId: "user_alice", value: { kind: "profile" }, now: "2026-10-02T12:00:00.000Z" });
    for (const [id, surfaceId, baseRevisionId] of [
      ["revision-1", "surface-profile", null],
      ["revision-2", "surface-profile", "revision-1"],
      ["revision-3", "surface-profile", "revision-2"],
      ["revision-other", "surface-other", null],
    ] as const) {
      await repository.write({
        kind: "surface_revision",
        id,
        ownerUserId: "user_alice",
        memberUserIds: ["user_alice"],
        value: { surfaceId, visibility: "private_preview", status: "draft", baseRevisionId, spec: { source: id } },
        now: "2026-10-02T12:00:00.000Z",
      });
    }

    const first = await executeBuildmatesTool("get_surface_history", { surfaceId: "surface-profile", limit: 2 }, "subject-alice-000001", services) as { surfaceId: string; revisions: Array<Record<string, unknown>>; nextCursor: string | null };
    expect(first.surfaceId).toBe("surface-profile");
    expect(first.revisions.map((revision) => revision.id)).toEqual(["revision-1", "revision-2"]);
    expect(first.revisions[1]).toMatchObject({ status: "draft", visibility: "private_preview", baseRevisionId: "revision-1" });
    expect(first.revisions[0]).not.toHaveProperty("spec");
    expect(first.nextCursor).toBe("revision-2");

    const second = await executeBuildmatesTool("get_surface_history", { surfaceId: "surface-profile", limit: 2, cursor: first.nextCursor }, "subject-alice-000001", services) as { revisions: Array<Record<string, unknown>>; nextCursor: string | null };
    expect(second.revisions.map((revision) => revision.id)).toEqual(["revision-3"]);
    expect(second.nextCursor).toBeNull();
  });
});
