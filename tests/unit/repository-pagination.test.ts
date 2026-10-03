import { describe, expect, it } from "vitest";
import { createMemoryMcpProductRepository } from "@buildmates/mcp-core";

describe("memory MCP repository pagination", () => {
  it("clamps invalid limits without widening the actor's visible records or breaking cursors", async () => {
    const repository = createMemoryMcpProductRepository();
    for (let index = 1; index <= 55; index += 1) {
      const id = `alice-${String(index).padStart(3, "0")}`;
      await repository.write({
        kind: "workspace_item",
        id,
        ownerUserId: "alice",
        memberUserIds: ["bob"],
        value: { id },
        now: "2026-10-02T12:00:00.000Z",
      });
    }
    await repository.write({
      kind: "workspace_item",
      id: "alice-private",
      ownerUserId: "alice",
      memberUserIds: [],
      value: { id: "alice-private" },
      now: "2026-10-02T12:00:00.000Z",
    });

    const first = await repository.listPageForMember("workspace_item", "bob", { limit: 0 });
    expect(first.records.map((record) => record.id)).toEqual(["alice-001"]);
    expect(first.nextCursor).toBe("alice-001");

    const second = await repository.listPageForMember("workspace_item", "bob", { limit: -3, cursor: first.nextCursor! });
    expect(second.records.map((record) => record.id)).toEqual(["alice-002"]);
    expect(second.nextCursor).toBe("alice-002");

    const nonFinite = await repository.listPageForMember("workspace_item", "bob", { limit: Number.NaN });
    expect(nonFinite.records).toHaveLength(20);
    expect(nonFinite.nextCursor).toBe("alice-020");

    const infinity = await repository.listPageForMember("workspace_item", "bob", { limit: Number.POSITIVE_INFINITY });
    expect(infinity.records).toHaveLength(20);
    expect(infinity.nextCursor).toBe("alice-020");

    const fractional = await repository.listPageForMember("workspace_item", "bob", { limit: 50.5 });
    expect(fractional.records).toHaveLength(50);
    expect(fractional.nextCursor).toBe("alice-050");
    expect(fractional.records.some((record) => record.id === "alice-private")).toBe(false);

    await expect(repository.listPageForMember("workspace_item", "carol", { limit: 20 })).resolves.toEqual({ records: [], nextCursor: null });
  });
});
