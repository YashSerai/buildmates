import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyD1MigrationSql } from "../helpers/migrate-d1";
const HISTORICAL_BACKFILL_VERSION = "2026-07-14.1";

describe("surface revision policy-version migration", () => {
  let mf: Miniflare;
  let db: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    db = await mf.getD1Database("DB") as D1Database;
  });
  afterEach(async () => mf.dispose());

  it("upgrades a populated 0005 database with a canonical backfill and preserved constraints", async () => {
    const migrations = (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort();
    for (const migration of migrations.filter((name) => name < "0006_")) await applySql(await readFile(`apps/web/drizzle/${migration}`, "utf8"));
    const now = Date.now();
    await db.prepare("INSERT INTO users (id,status,operator_role,created_at,updated_at) VALUES ('migration-user','active','none',?,?)").bind(now, now).run();
    await db.prepare("INSERT INTO design_policies (id,version,source_hash,policy_json,activated_at,created_at) VALUES ('migration-policy',?,'migration-hash','{}',?,?)").bind(HISTORICAL_BACKFILL_VERSION, now, now).run();
    await db.prepare("INSERT INTO surfaces (id,owner_user_id,kind,subject_id,published_revision_id,governance_version,created_at,updated_at) VALUES ('migration-surface','migration-user','profile','migration-profile',NULL,1,?,?)").bind(now, now).run();
    await db.prepare("INSERT INTO surface_revisions (id,surface_id,revision_number,base_revision_number,author_user_id,design_policy_id,spec_json,status,created_at) VALUES ('migration-revision','migration-surface',1,NULL,'migration-user','migration-policy','{}','draft',?)").bind(now).run();

    const migration = migrations.find((name) => name.startsWith("0006_"));
    expect(migration).toBe("0006_lazy_rage.sql");
    await applySql(await readFile(`apps/web/drizzle/${migration}`, "utf8"));
    await expect(db.prepare("SELECT design_policy_version AS version FROM surface_revisions WHERE id='migration-revision'").first()).resolves.toEqual({ version: HISTORICAL_BACKFILL_VERSION });

    const columns = (await db.prepare("PRAGMA table_info(surface_revisions)").all<{ name: string; notnull: number; dflt_value: string | null }>()).results;
    expect(columns.find((column) => column.name === "design_policy_version")).toMatchObject({ notnull: 1, dflt_value: `'${HISTORICAL_BACKFILL_VERSION}'` });
    const foreignKeys = (await db.prepare("PRAGMA foreign_key_list(surface_revisions)").all<{ table: string }>()).results.map((row) => row.table);
    expect(foreignKeys).toEqual(expect.arrayContaining(["surfaces", "users", "design_policies"]));
    await expect(db.prepare("INSERT INTO surface_revisions (id,surface_id,revision_number,author_user_id,design_policy_id,design_policy_version,spec_json,status,created_at) VALUES ('null-version','migration-surface',2,'migration-user','migration-policy',NULL,'{}','draft',?)").bind(now).run()).rejects.toThrow(/NOT NULL/);
    await expect(db.prepare("INSERT INTO surface_revisions (id,surface_id,revision_number,author_user_id,design_policy_id,spec_json,status,created_at) VALUES ('bad-policy','migration-surface',2,'migration-user','missing-policy','{}','draft',?)").bind(now).run()).rejects.toThrow(/FOREIGN KEY/);
    await expect(db.prepare("INSERT INTO surface_revisions (id,surface_id,revision_number,author_user_id,design_policy_id,spec_json,status,created_at) VALUES ('duplicate-number','migration-surface',1,'migration-user','migration-policy','{}','draft',?)").bind(now).run()).rejects.toThrow(/UNIQUE/);
  }, 20_000);

  async function applySql(sql: string) {
    await applyD1MigrationSql(db, sql);
  }
});
