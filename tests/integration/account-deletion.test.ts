import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPrivacyCommand } from "../../apps/web/src/platform/onboarding-data";
import type { R2Like } from "../../apps/web/src/platform/r2";
import { resumeAccountDeletion } from "../../apps/web/src/privacy/account-deletion";

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
      DB.prepare("INSERT INTO project_links(id,project_id,label,url,position,created_at) VALUES ('project-link-delete','project-delete','Private demo','https://sentinel.example/private',0,?)").bind(now),
      DB.prepare("INSERT INTO taxonomy_versions(id,version,status,created_at,activated_at) VALUES ('tax-delete',1,'active',?,?)").bind(now,now),
      DB.prepare("INSERT INTO work_signals(id,user_id,taxonomy_version_id,free_text_summary,audience,allow_matching,approved_at,expires_at,created_at,updated_at) VALUES ('signal-delete','delete-me','tax-delete','Sensitive work','public',1,?,?,?,?)").bind(now,now+86_400_000,now,now),
      DB.prepare("INSERT INTO connected_app_preferences(id,user_id,app_id,display_name,category,access_mode,last_reviewed_at) VALUES ('app-delete','delete-me','github','GitHub','Projects and code','allow_approved_work_signals',?)").bind(now),
      DB.prepare("INSERT INTO identity_principals(id,channel,issuer,subject,workspace_scope,created_at) VALUES ('principal-delete','mcp','buildmates_mcp','delete-me','global',?)").bind(now),
      DB.prepare("INSERT INTO identity_links(id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at) VALUES ('link-delete','delete-me','principal-delete','mcp','buildmates_mcp','delete-me','global',?)").bind(now),
      DB.prepare("INSERT INTO surface_assets(id,owner_user_id,object_key,content_type,byte_size,sha256,created_at) VALUES ('asset-delete','delete-me','profiles/delete-me/avatar.png','image/png',8,'sha-delete',?)").bind(now),
      DB.prepare("INSERT INTO design_policies(id,version,source_hash,policy_json,activated_at,created_at) VALUES ('policy-delete','test-delete','hash-delete','{}',?,?)").bind(now,now),
      DB.prepare("INSERT INTO surfaces(id,owner_user_id,kind,subject_id,governance_version,created_at,updated_at) VALUES ('surface-delete','delete-me','profile','profile-delete',1,?,?)").bind(now,now),
      DB.prepare("INSERT INTO surface_revisions(id,surface_id,revision_number,base_revision_number,author_user_id,design_policy_id,design_policy_version,visibility,spec_json,status,created_at) VALUES ('revision-delete','surface-delete',1,NULL,'delete-me','policy-delete','test-delete','private_preview','{\"sentinel\":\"private generated profile\"}','published',?)").bind(now),
      DB.prepare("UPDATE surfaces SET published_revision_id='revision-delete' WHERE id='surface-delete'"),
      DB.prepare("INSERT INTO personal_surface_views(id,surface_id,user_id,revision_id,created_at,updated_at) VALUES ('personal-view-delete','surface-delete','delete-me','revision-delete',?,?)").bind(now,now),
    ]);

    const result = await runPrivacyCommand(DB,"delete-me",{command:"request_deletion",confirmation:"DELETE BUILDMATES"},assets);
    expect(result.jobId).toMatch(/^deletion_/);
    expect(await DB.prepare("SELECT status,deleted_at AS deletedAt FROM users WHERE id='delete-me'").first()).toMatchObject({status:"deleted"});
    expect(await DB.prepare("SELECT display_name AS displayName,audience,allow_matching AS allowMatching,published_at AS publishedAt FROM profiles WHERE user_id='delete-me'").first()).toMatchObject({displayName:"Deleted builder",audience:"private",allowMatching:0,publishedAt:null});
    expect(await DB.prepare("SELECT status,summary,audience FROM projects WHERE id='project-delete'").first()).toMatchObject({status:"deleted",summary:"",audience:"private"});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM project_links WHERE project_id='project-delete'").first()).toMatchObject({count:0});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM surfaces WHERE owner_user_id='delete-me'").first()).toMatchObject({count:0});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM surface_revisions WHERE spec_json LIKE '%private generated profile%'").first()).toMatchObject({count:0});
    expect(await DB.prepare("SELECT free_text_summary AS summary,audience,allow_matching AS allowMatching FROM work_signals WHERE id='signal-delete'").first()).toMatchObject({summary:"",audience:"private",allowMatching:0});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM handles WHERE user_id='delete-me'").first()).toMatchObject({count:0});
    expect(await DB.prepare("SELECT revoked_at AS revokedAt FROM identity_links WHERE id='link-delete'").first<{revokedAt:number|null}>()).toMatchObject({revokedAt:expect.any(Number)});
    expect(await DB.prepare("SELECT deleted_at AS deletedAt FROM surface_assets WHERE id='asset-delete'").first<{deletedAt:number|null}>()).toMatchObject({deletedAt:expect.any(Number)});
    expect(storedObjects.has("profiles/delete-me/avatar.png")).toBe(false);
    expect(await DB.prepare("SELECT status FROM deletion_jobs WHERE id=?").bind(result.jobId).first()).toMatchObject({status:"complete"});
  }, 30_000);

  it("revokes access before R2 cleanup and leaves a recoverable deleting job when object deletion fails", async () => {
    const now=Date.now(),code="F".repeat(32);
    const storedObjects=new Set(["profiles/delete-pending/avatar.png"]);
    await DB.batch([
      DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES ('delete-pending','active','none',?,?)").bind(now,now),
      DB.prepare("INSERT INTO identity_principals(id,channel,issuer,subject,workspace_scope,created_at) VALUES ('pending-principal','mcp','buildmates_mcp','pending-subject','global',?)").bind(now),
      DB.prepare("INSERT INTO identity_links(id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at) VALUES ('pending-link','delete-pending','pending-principal','mcp','buildmates_mcp','pending-subject','global',?)").bind(now),
      DB.prepare("INSERT INTO identity_link_codes(id,user_id,code_hash,workspace_scope,expires_at,attempt_count,max_attempts,created_at) VALUES ('pending-code','delete-pending',?,'global',?,0,5,?)").bind(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code)).then(value=>Array.from(new Uint8Array(value),byte=>byte.toString(16).padStart(2,"0")).join("")),now+60_000,now),
      DB.prepare("INSERT INTO surface_assets(id,owner_user_id,object_key,content_type,byte_size,sha256,created_at) VALUES ('pending-asset','delete-pending','profiles/delete-pending/avatar.png','image/png',8,'sha-pending',?)").bind(now),
    ]);
    const result=await runPrivacyCommand(DB,"delete-pending",{command:"request_deletion",confirmation:"DELETE BUILDMATES"},{async put(){},async get(){return null},async delete(){throw new Error("r2_unavailable")}});
    expect(result).toMatchObject({jobId:expect.stringMatching(/^deletion_/),status:"deleting"});
    expect(await DB.prepare("SELECT status FROM users WHERE id='delete-pending'").first()).toEqual({status:"deleting"});
    expect(await DB.prepare("SELECT status FROM deletion_jobs WHERE id=?").bind(result.jobId).first()).toEqual({status:"deleting"});
    expect(await DB.prepare("SELECT revoked_at AS revokedAt FROM identity_links WHERE id='pending-link'").first<{revokedAt:number|null}>()).toMatchObject({revokedAt:expect.any(Number)});
    expect(await DB.prepare("SELECT expires_at AS expiresAt FROM identity_link_codes WHERE id='pending-code'").first<{expiresAt:number}>()).toEqual({expiresAt:expect.any(Number)});
    expect(await DB.prepare("SELECT deleted_at AS deletedAt FROM surface_assets WHERE id='pending-asset'").first<{deletedAt:number|null}>()).toMatchObject({deletedAt:expect.any(Number)});
    const recoveredAssets:R2Like={async put(key){storedObjects.add(key)},async get(key){return storedObjects.has(key)?{async text(){return "asset"}}:null},async delete(key){storedObjects.delete(key)}};
    const [first,second]=await Promise.all([resumeAccountDeletion(DB,recoveredAssets,result.jobId!),resumeAccountDeletion(DB,recoveredAssets,result.jobId!)]);
    expect([first.status,second.status]).toEqual(["complete","complete"]);
    expect(storedObjects.has("profiles/delete-pending/avatar.png")).toBe(false);
    expect(await resumeAccountDeletion(DB,recoveredAssets,result.jobId!)).toEqual({jobId:result.jobId,status:"complete"});
    expect(await DB.prepare("SELECT status FROM users WHERE id='delete-pending'").first()).toEqual({status:"deleted"});
    expect(await DB.prepare("SELECT status FROM deletion_jobs WHERE id=?").bind(result.jobId).first()).toEqual({status:"complete"});
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action='deletion.completed' AND object_id=?").bind(result.jobId).first()).toEqual({count:1});
  },30_000);
});
