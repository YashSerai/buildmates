import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createD1McpProductRepository } from "@buildmates/mcp-core";
import { getProfileByHandle, publishProfile, saveProfile, saveProject } from "../../apps/web/src/profile-projects/service";
import { applyD1Migrations } from "../helpers/migrate-d1";

const NOW = Date.parse("2026-10-02T12:00:00.000Z");
const ACTORS = [
  { id: "deleted-user", status: "deleted", oldHandle: "deleted_old", oldProject: "deleted-old" },
  { id: "suspended-user", status: "suspended", oldHandle: "suspended_old", oldProject: "suspended-old" },
] as const;

describe("active actor write boundary", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default { fetch(){ return new Response('ok') } }",
      d1Databases: ["DB"],
      compatibilityDate: "2026-05-22",
    });
    DB = (await mf.getD1Database("DB")) as D1Database;
    await applyD1Migrations(DB);
    await DB.prepare(
      "INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES (?,?,?,?,?), (?,?,?,?,?), (?,?,?,?,?)",
    ).bind(
      ACTORS[0].id, ACTORS[0].status, "none", NOW, NOW,
      ACTORS[1].id, ACTORS[1].status, "none", NOW, NOW,
      "active-user", "active", "none", NOW, NOW,
    ).run();
    for (const actor of ACTORS) {
      await DB.prepare(
        "INSERT INTO handles(user_id,handle,normalized_handle,created_at) VALUES (?,?,?,?)",
      ).bind(actor.id, actor.oldHandle, actor.oldHandle, NOW).run();
      await DB.prepare(
        "INSERT INTO profiles(id,user_id,display_name,summary,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        `profile-${actor.id}`, actor.id, `${actor.id} original`, "Original profile data", "private", 0,
        "manual", 0, null, NOW, NOW,
      ).run();
      await DB.prepare(
        "INSERT INTO profile_fields(profile_id,field_key,value_json,audience,allow_matching,source_status,provenance,updated_at) VALUES (?,?,?,?,?,?,?,?)",
      ).bind(
        `profile-${actor.id}`, "current_work", JSON.stringify("original field"), "private", 0, "confirmed", "self_reported", NOW,
      ).run();
      await DB.prepare(
        "INSERT INTO projects(id,owner_user_id,slug,title,summary,audience,allow_matching,status,stage,indexable,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        `project-${actor.id}`, actor.id, actor.oldProject, "Original project", "Original project data", "private", 0,
        "active", "building", 0, null, NOW, NOW,
      ).run();
      await DB.prepare(
        "INSERT INTO project_links(id,project_id,label,url,position,created_at) VALUES (?,?,?,?,?,?)",
      ).bind(`link-${actor.id}`, `project-${actor.id}`, "Source", "https://example.com/original", 0, NOW).run();
    }
  });

  afterEach(async () => mf.dispose());

  it("rejects deleted and suspended web profile/project writes without partial changes", async () => {
    const before = await snapshot(DB);
    for (const actor of ACTORS) {
      await expect(saveProfile(DB, actor.id, {
        handle: `${actor.id.replace("-user", "")}_new`,
        displayName: "Unauthorized replacement",
        summary: "This must never be persisted",
        allowMatching: true,
        acceptanceMode: "manual",
        fields: [{ key: "current_work", value: "replacement", audience: "public" }],
      })).rejects.toThrow("actor_not_active");
      await expect(publishProfile(DB, actor.id)).rejects.toThrow("actor_not_active");
      await expect(saveProject(DB, actor.id, {
        slug: `${actor.id.replace("-user", "")}-new`,
        title: "Unauthorized replacement",
        summary: "This must never be persisted",
        audience: "public",
        allowMatching: true,
        stage: "building",
        status: "active",
        links: [{ label: "Replacement", url: "https://example.com/replacement" }],
        taxonomy: [],
      }, actor.oldProject)).rejects.toThrow("actor_not_active");
    }

    expect(await snapshot(DB)).toEqual(before);
    expect(await getProfileByHandle(DB, "deleted_new", null)).toBeNull();
    expect(await getProfileByHandle(DB, "suspended_new", null)).toBeNull();
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM projects WHERE slug LIKE '%-new'").first<{ count: number }>())?.count).toBe(0);
  });

  it("allows an active actor to save and publish profile data and a project", async () => {
    await expect(saveProfile(DB, "active-user", {
      handle: "active_builder",
      displayName: "Active Builder",
      summary: "An active account",
      allowMatching: true,
      acceptanceMode: "manual",
      fields: [{ key: "current_work", value: "Shipping a real feature", audience: "public" }],
    })).resolves.toMatchObject({ handle: "active_builder" });
    await expect(publishProfile(DB, "active-user")).resolves.toBeUndefined();
    await expect(saveProject(DB, "active-user", {
      slug: "active-project",
      title: "Active Project",
      summary: "A project owned by an active account",
      audience: "public",
      allowMatching: true,
      stage: "building",
      status: "active",
      links: [],
      taxonomy: [],
    })).resolves.toMatchObject({ slug: "active-project" });

    await expect(getProfileByHandle(DB, "active_builder", null)).resolves.toMatchObject({
      userId: "active-user",
      displayName: "Active Builder",
      projects: [expect.objectContaining({ slug: "active-project" })],
    });
  });

  it("rejects deleted and suspended MCP profile writes at the D1 batch boundary", async () => {
    const repository = createD1McpProductRepository(DB);
    const before = await snapshot(DB);
    for (const actor of ACTORS) {
      await expect(repository.write({
        kind: "profile_model",
        id: `client-${actor.id}`,
        ownerUserId: actor.id,
        actorUserId: actor.id,
        now: new Date(NOW).toISOString(),
        value: {
          profileId: `client-${actor.id}`,
          handle: `${actor.id.replace("-user", "")}_mcp_new`,
          displayName: "Unauthorized MCP replacement",
          builderSummary: "This must never be persisted",
          projectOrInterest: "No",
          portfolioLinks: [],
          allowMatching: true,
          acceptanceMode: "manual",
          fields: [{ key: "current_work", value: "replacement", audience: "public", allowMatching: true, sourceStatus: "confirmed", provenance: "self_reported" }],
          statistics: [],
          canonicalTopicIds: [],
        },
      })).rejects.toThrow("actor_not_active");
    }

    expect(await snapshot(DB)).toEqual(before);
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM handles WHERE normalized_handle LIKE '%_mcp_new'").first<{ count: number }>())?.count).toBe(0);
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM profiles WHERE display_name LIKE 'Unauthorized MCP%'").first<{ count: number }>())?.count).toBe(0);
  });
});

async function snapshot(DB: D1Database) {
  const users = (await DB.prepare("SELECT id,status,updated_at AS updatedAt FROM users WHERE id IN ('deleted-user','suspended-user') ORDER BY id").all()).results;
  const handles = (await DB.prepare("SELECT user_id AS userId,handle,normalized_handle AS normalizedHandle FROM handles WHERE user_id IN ('deleted-user','suspended-user') ORDER BY user_id").all()).results;
  const profiles = (await DB.prepare("SELECT user_id AS userId,display_name AS displayName,summary,audience,allow_matching AS allowMatching,updated_at AS updatedAt FROM profiles WHERE user_id IN ('deleted-user','suspended-user') ORDER BY user_id").all()).results;
  const fields = (await DB.prepare("SELECT profile_id AS profileId,field_key AS fieldKey,value_json AS valueJson FROM profile_fields WHERE profile_id IN ('profile-deleted-user','profile-suspended-user') ORDER BY profile_id,field_key").all()).results;
  const projects = (await DB.prepare("SELECT owner_user_id AS ownerUserId,slug,title,summary,audience,status,stage,updated_at AS updatedAt FROM projects WHERE owner_user_id IN ('deleted-user','suspended-user') ORDER BY owner_user_id").all()).results;
  const links = (await DB.prepare("SELECT project_id AS projectId,label,url,position FROM project_links WHERE project_id IN ('project-deleted-user','project-suspended-user') ORDER BY project_id,position").all()).results;
  return { users, handles, profiles, fields, projects, links };
}
