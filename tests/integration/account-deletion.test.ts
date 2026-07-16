import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPrivacyCommand } from "../../apps/web/src/platform/onboarding-data";
import type { R2Like } from "../../apps/web/src/platform/r2";

describe("account deletion", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    const migrations = (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort();
    for (const migration of migrations) {
      const sql = await readFile(`apps/web/drizzle/${migration}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) await DB.prepare(statement).run();
    }
  });

  afterEach(async () => { await mf.dispose(); });

  it("atomically removes public identity and marks the lifecycle complete", async () => {
    const now = Date.now();
    const storedObjects = new Set(["profiles/delete-me/avatar.png"]);
    const assets: R2Like = {
      async put(key) { storedObjects.add(key); },
      async get(key) { return storedObjects.has(key) ? { async text() { return "asset"; } } : null; },
      async delete(key) { storedObjects.delete(key); },
    };
    await DB.batch([
      DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES ('delete-me','active','none',?,?)").bind(now,now),
      DB.prepare("INSERT INTO profiles(id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,location_map_opt_in,created_at,updated_at,published_at) VALUES ('profile-delete','delete-me','Alex','Private context','A project','[]','public',1,'full_autopilot',1,0,?,?,?)").bind(now,now,now),
      DB.prepare("INSERT INTO handles(user_id,handle,normalized_handle,created_at) VALUES ('delete-me','alex','alex',?)").bind(now),
      DB.prepare("INSERT INTO projects(id,owner_user_id,slug,title,summary,audience,allow_matching,status,stage,indexable,created_at,updated_at,published_at) VALUES ('project-delete','delete-me','alex-project','Alex project','Secret summary','public',1,'active','building',1,?,?,?)").bind(now,now,now),
      DB.prepare("INSERT INTO taxonomy_versions(id,version,status,created_at,activated_at) VALUES ('tax-delete',1,'active',?,?)").bind(now,now),
      DB.prepare("INSERT INTO work_signals(id,user_id,taxonomy_version_id,free_text_summary,audience,allow_matching,approved_at,expires_at,created_at,updated_at) VALUES ('signal-delete','delete-me','tax-delete','Sensitive work','public',1,?,?,?,?)").bind(now,now+86_400_000,now,now),
      DB.prepare("INSERT INTO connected_app_preferences(id,user_id,app_id,display_name,category,access_mode,last_reviewed_at) VALUES ('app-delete','delete-me','github','GitHub','Projects and code','allow_approved_work_signals',?)").bind(now),
      DB.prepare("INSERT INTO identity_principals(id,channel,issuer,subject,workspace_scope,created_at) VALUES ('principal-delete','mcp','buildmates_mcp','delete-me','global',?)").bind(now),
      DB.prepare("INSERT INTO identity_links(id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at) VALUES ('link-delete','delete-me','principal-delete','mcp','buildmates_mcp','delete-me','global',?)").bind(now),
      DB.prepare("INSERT INTO surface_assets(id,owner_user_id,object_key,content_type,byte_size,sha256,created_at) VALUES ('asset-delete','delete-me','profiles/delete-me/avatar.png','image/png',8,'sha-delete',?)").bind(now),
    ]);

    const result = await runPrivacyCommand(DB,"delete-me",{command:"request_deletion",confirmation:"DELETE BUILDMATES"},assets);
    expect(result.jobId).toMatch(/^deletion_/);
    expect(await DB.prepare("SELECT status,deleted_at AS deletedAt FROM users WHERE id='delete-me'").first()).toMatchObject({status:"deleted"});
    expect(await DB.prepare("SELECT display_name AS displayName,audience,allow_matching AS allowMatching,published_at AS publishedAt FROM profiles WHERE user_id='delete-me'").first()).toMatchObject({displayName:"Deleted builder",audience:"private",allowMatching:0,publishedAt:null});
    expect(await DB.prepare("SELECT status,summary,audience FROM projects WHERE id='project-delete'").first()).toMatchObject({status:"deleted",summary:"",audience:"private"});
    expect(await DB.prepare("SELECT free_text_summary AS summary,audience,allow_matching AS allowMatching FROM work_signals WHERE id='signal-delete'").first()).toMatchObject({summary:"",audience:"private",allowMatching:0});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM handles WHERE user_id='delete-me'").first()).toMatchObject({count:0});
    expect(await DB.prepare("SELECT revoked_at AS revokedAt FROM identity_links WHERE id='link-delete'").first<{revokedAt:number|null}>()).toMatchObject({revokedAt:expect.any(Number)});
    expect(await DB.prepare("SELECT deleted_at AS deletedAt FROM surface_assets WHERE id='asset-delete'").first<{deletedAt:number|null}>()).toMatchObject({deletedAt:expect.any(Number)});
    expect(storedObjects.has("profiles/delete-me/avatar.png")).toBe(false);
    expect(await DB.prepare("SELECT status FROM deletion_jobs WHERE id=?").bind(result.jobId).first()).toMatchObject({status:"complete"});
  }, 30_000);
});
