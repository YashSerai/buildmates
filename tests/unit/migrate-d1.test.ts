import { describe, expect, it, vi } from "vitest";
import { applyD1Statements, D1_MIGRATION_BATCH_SIZE, splitD1MigrationSql } from "../helpers/migrate-d1";

describe("D1 migration helper", () => {
  it("preserves delimiter-separated statement order and removes empty chunks", () => {
    expect(splitD1MigrationSql("  CREATE TABLE one (id TEXT);\n--> statement-breakpoint\n\n--> statement-breakpoint\n CREATE TABLE two (id TEXT); ")).toEqual([
      "CREATE TABLE one (id TEXT);",
      "CREATE TABLE two (id TEXT);",
    ]);
  });

  it("uses bounded batches while preserving prepare and execution order", async () => {
    const statements = Array.from({ length: D1_MIGRATION_BATCH_SIZE * 2 + 5 }, (_, index) => `statement-${index}`);
    const prepared: string[] = [];
    const batchSizes: number[] = [];
    const DB = {
      prepare: vi.fn((statement: string) => {
        prepared.push(statement);
        return { statement } as unknown as D1PreparedStatement;
      }),
      batch: vi.fn(async (batch: D1PreparedStatement[]) => {
        batchSizes.push(batch.length);
        return [];
      }),
    } as unknown as D1Database;

    await expect(applyD1Statements(DB, statements)).resolves.toBe(statements.length);
    expect(batchSizes).toEqual([D1_MIGRATION_BATCH_SIZE, D1_MIGRATION_BATCH_SIZE, 5]);
    expect(prepared).toEqual(statements);
  });

  it("propagates a failed D1 batch", async () => {
    const error = new Error("migration failed");
    const DB = {
      prepare: vi.fn((statement: string) => ({ statement }) as unknown as D1PreparedStatement),
      batch: vi.fn(async () => { throw error; }),
    } as unknown as D1Database;

    await expect(applyD1Statements(DB, ["CREATE TABLE broken (id TEXT)"])).rejects.toBe(error);
  });
});
