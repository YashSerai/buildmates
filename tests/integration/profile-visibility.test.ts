import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProfileByHandle, getProjectBySlug } from "../../apps/web/src/profile-projects/service";

it("exports a server-owned profile projection boundary", async () => {
  const service =
    await import("../../apps/web/src/profile-projects/service").catch(
      () => null,
    );
  expect(service?.getProfileByHandle).toBeTypeOf("function");
  expect(service?.saveProfile).toBeTypeOf("function");
  expect(service?.getProjectBySlug).toBeTypeOf("function");
});

it("rejects unsafe public handles and project slugs before storage", async () => {
  const service = await import("../../apps/web/src/profile-projects/service");
  expect(() => service.normalizeHandle("../../admin")).toThrow(
    "invalid_handle",
  );
  expect(() => service.normalizeSlug("hello world<script>")).toThrow(
    "invalid_slug",
  );
  expect(service.normalizeHandle(" Ada_Lovelace ")).toBe("ada_lovelace");
});

describe("profile field audience projection", () => {
  let mf: Miniflare;
  let db: D1Database;
  beforeEach(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default {fetch(){return new Response('ok')}}",
      d1Databases: ["DB"],
      compatibilityDate: "2026-05-22",
    });
    db = (await mf.getD1Database("DB")) as D1Database;
    for (const name of (await readdir("apps/web/drizzle"))
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(`apps/web/drizzle/${name}`, "utf8");
      for (const statement of sql
        .split("--> statement-breakpoint")
        .map((value) => value.trim())
        .filter(Boolean))
        await db.prepare(statement).run();
    }
    const now = Date.now();
    for (const id of ["owner", "viewer"])
      await db
        .prepare(
          "INSERT INTO users(id,status,operator_role,created_at,updated_at)VALUES(?,'active','none',?,?)",
        )
        .bind(id, now, now)
        .run();
    await db
      .prepare(
        "INSERT INTO handles(user_id,handle,normalized_handle,created_at)VALUES('owner','owner','owner',?)",
      )
      .bind(now)
      .run();
    await db
      .prepare(
        "INSERT INTO profiles(id,user_id,display_name,summary,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at)VALUES('profile-owner','owner','Owner','Public summary','public',1,'manual',1,?,?,?)",
      )
      .bind(now, now, now)
      .run();
    for (const [key, audience] of [
      ["public_fact", "public"],
      ["member_fact", "signed_in"],
      ["secret_fact", "private"],
    ])
      await db
        .prepare(
          "INSERT INTO profile_fields(profile_id,field_key,value_json,audience,allow_matching,source_status,provenance,updated_at)VALUES('profile-owner',?,?,?,0,'confirmed','self_reported',?)",
        )
        .bind(key, JSON.stringify(key), audience, now)
        .run();
  });
  afterEach(async () => mf.dispose());
  it("does not return unauthorized rows to anonymous or signed-in viewers", async () => {
    const anonymous = await getProfileByHandle(db, "owner", null);
    expect(anonymous?.fields.map((field) => field.key)).toEqual([
      "public_fact",
    ]);
    expect(JSON.stringify(anonymous)).not.toContain("secret_fact");
    const signedIn = await getProfileByHandle(db, "owner", "viewer");
    expect(signedIn?.fields.map((field) => field.key)).toEqual([
      "member_fact",
      "public_fact",
    ]);
    const owner = await getProfileByHandle(db, "owner", "owner");
    expect(owner?.fields).toHaveLength(3);
  });
  it("keeps public drafts private until they become active", async () => {
    const now=Date.now();
    await db.prepare("INSERT INTO projects(id,owner_user_id,slug,title,summary,audience,allow_matching,status,stage,indexable,created_at,updated_at) VALUES('draft-project','owner','private-draft','Draft','Not published','public',1,'draft','exploring',1,?,?)").bind(now,now).run();
    expect(await getProjectBySlug(db,"private-draft",null)).toBeNull();
    expect((await getProjectBySlug(db,"private-draft","owner"))?.title).toBe("Draft");
    await db.prepare("UPDATE projects SET status='active' WHERE id='draft-project'").run();
    expect((await getProjectBySlug(db,"private-draft",null))?.title).toBe("Draft");
  });
}, 20_000);
