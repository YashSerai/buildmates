import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createD1McpProductRepository } from "@buildmates/mcp-core";
import { applyD1Migrations } from "../helpers/migrate-d1";

describe("D1 MCP repository pagination", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch(){ return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    await applyD1Migrations(DB);
    const now = Date.parse("2026-10-02T12:00:00.000Z");
    const statements: D1PreparedStatement[] = [
      DB.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('alice','active','none',?,?),('bob','active','none',?,?)").bind(now, now, now, now),
    ];
    for (let index = 1; index <= 55; index += 1) {
      const appId = `alice-${String(index).padStart(3, "0")}`;
      statements.push(DB.prepare("INSERT INTO connected_app_preferences (id,user_id,app_id,display_name,category,access_mode,last_reviewed_at,revoked_at) VALUES (?,?,?,?,?,?,?,NULL)").bind(`pref-${appId}`, "alice", appId, appId, "source", "allow_approved_work_signals", now));
    }
    statements.push(DB.prepare("INSERT INTO connected_app_preferences (id,user_id,app_id,display_name,category,access_mode,last_reviewed_at,revoked_at) VALUES (?,?,?,?,?,?,?,?)").bind("pref-revoked", "alice", "alice-revoked", "Revoked", "source", "never", now, now));
    statements.push(DB.prepare("INSERT INTO connected_app_preferences (id,user_id,app_id,display_name,category,access_mode,last_reviewed_at,revoked_at) VALUES (?,?,?,?,?,?,?,NULL)").bind("pref-bob", "bob", "bob-private", "Bob", "source", "never", now));
    await DB.batch(statements);
  });

  afterEach(async () => mf.dispose());

  it("clamps invalid limits and preserves actor filtering and cursor order", async () => {
    const repository = createD1McpProductRepository(DB);

    const first = await repository.listPageForMember("source_policy", "alice", { limit: 0 });
    expect(first.records.map((record) => record.id)).toEqual(["alice-001"]);
    expect(first.nextCursor).toBe("alice-001");

    const second = await repository.listPageForMember("source_policy", "alice", { limit: -2, cursor: first.nextCursor! });
    expect(second.records.map((record) => record.id)).toEqual(["alice-002"]);
    expect(second.nextCursor).toBe("alice-002");

    const nonFinite = await repository.listPageForMember("source_policy", "alice", { limit: Number.NaN });
    expect(nonFinite.records).toHaveLength(20);
    expect(nonFinite.nextCursor).toBe("alice-020");

    const infinity = await repository.listPageForMember("source_policy", "alice", { limit: Number.POSITIVE_INFINITY });
    expect(infinity.records).toHaveLength(20);
    expect(infinity.nextCursor).toBe("alice-020");

    const fractional = await repository.listPageForMember("source_policy", "alice", { limit: 50.5 });
    expect(fractional.records).toHaveLength(50);
    expect(fractional.nextCursor).toBe("alice-050");
    expect(fractional.records.some((record) => record.id === "alice-revoked" || record.id === "bob-private")).toBe(false);

    await expect(repository.listPageForMember("source_policy", "bob", { limit: 20 })).resolves.toMatchObject({ records: [expect.objectContaining({ id: "bob-private" })], nextCursor: null });
    await expect(repository.listPageForMember("source_policy", "carol", { limit: 20 })).resolves.toEqual({ records: [], nextCursor: null });
  }, 60_000);
});
