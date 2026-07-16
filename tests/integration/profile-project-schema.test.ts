import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("profile and project product schema", () => {
  let mf: Miniflare;
  let db: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    db = await mf.getD1Database("DB") as D1Database;
    for (const migration of (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
      const sql = await readFile(`apps/web/drizzle/${migration}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await db.prepare(statement).run();
    }
  });
  afterEach(async () => mf.dispose());

  it("stores profile fields with independent audiences and provenance", async () => {
    const columns = (await db.prepare("PRAGMA table_info(profile_fields)").all<{ name: string }>()).results.map((row) => row.name);
    expect(columns).toEqual(expect.arrayContaining(["profile_id", "field_key", "value_json", "audience", "source_status", "provenance"]));
  });

  it("stores complete project presentation and lifecycle records", async () => {
    const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>()).results.map((row) => row.name);
    expect(tables).toEqual(expect.arrayContaining(["project_links", "project_media", "project_updates", "project_taxonomy_items"]));
    const columns = (await db.prepare("PRAGMA table_info(projects)").all<{ name: string }>()).results.map((row) => row.name);
    expect(columns).toEqual(expect.arrayContaining(["stage", "indexable", "published_at", "deleted_at"]));
  });
});
