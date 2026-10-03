import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/** Cloudflare D1 accepts at most 100 statements in one batch request. */
export const D1_MIGRATION_BATCH_SIZE = 100;

export type D1MigrationFile = {
  name: string;
  statements: string[];
};

type D1MigrationDatabase = Pick<D1Database, "prepare" | "batch">;

/**
 * Split a Drizzle migration at the exact delimiter emitted by the generator.
 * Empty chunks are ignored so comments or a trailing delimiter do not become
 * executable statements.
 */
export function splitD1MigrationSql(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

/** Read migration files in lexical filename order, retaining statement order. */
export async function readD1Migrations(directory = "apps/web/drizzle"): Promise<D1MigrationFile[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const migrations: D1MigrationFile[] = [];
  for (const name of names) {
    migrations.push({ name, statements: splitD1MigrationSql(await readFile(join(directory, name), "utf8")) });
  }
  return migrations;
}

/** Execute statements in order using bounded D1 batches. Errors are propagated. */
export async function applyD1Statements(DB: D1MigrationDatabase, statements: readonly string[]): Promise<number> {
  for (let offset = 0; offset < statements.length; offset += D1_MIGRATION_BATCH_SIZE) {
    const batch = statements.slice(offset, offset + D1_MIGRATION_BATCH_SIZE).map((statement) => DB.prepare(statement));
    await DB.batch(batch);
  }
  return statements.length;
}

/** Apply all repository migrations in lexical file order. */
export async function applyD1Migrations(DB: D1MigrationDatabase, directory = "apps/web/drizzle"): Promise<{ files: number; statements: number }> {
  const migrations = await readD1Migrations(directory);
  const statements = migrations.flatMap((migration) => migration.statements);
  await applyD1Statements(DB, statements);
  return { files: migrations.length, statements: statements.length };
}

/** Apply one migration's delimiter-separated SQL, useful for upgrade tests. */
export async function applyD1MigrationSql(DB: D1MigrationDatabase, sql: string): Promise<number> {
  return applyD1Statements(DB, splitD1MigrationSql(sql));
}
