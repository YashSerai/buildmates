import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { establishGithubSession } from "../../apps/web/src/auth/github-oauth";
import { applyD1Migrations } from "../helpers/migrate-d1";

describe("suspended appeal authentication boundary", () => {
  let mf: Miniflare;
  let DB: D1Database;
  const now = Date.parse("2026-07-16T12:00:00Z");
  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('ok')}}", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    await applyD1Migrations(DB);
  }, 30_000);
  afterEach(async () => mf.dispose());

  it("creates a limited web session for an existing suspended identity without reactivating the account", async () => {
    await DB.batch([
      DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES ('suspended-user','suspended','none',?,?)").bind(now, now),
      DB.prepare("INSERT INTO identity_principals(id,channel,issuer,subject,workspace_scope,created_at,revoked_at) VALUES ('principal','web','github.com','12345','global',?,NULL)").bind(now),
      DB.prepare("INSERT INTO identity_links(id,user_id,principal_id,provider_channel,provider_issuer,provider_subject,workspace_scope,linked_at,revoked_at) VALUES ('link','suspended-user','principal','web','github.com','12345','global',?,NULL)").bind(now),
    ]);
    const session = await establishGithubSession(DB, { id: 12345, login: "suspended", name: null }, now + 1);
    expect(session).toMatchObject({ userId: "suspended-user", accountStatus: "suspended" });
    expect((await DB.prepare("SELECT status FROM users WHERE id='suspended-user'").first<{status:string}>())?.status).toBe("suspended");
    expect((await DB.prepare("SELECT COUNT(*) AS count FROM web_sessions WHERE user_id='suspended-user' AND revoked_at IS NULL").first<{count:number}>())?.count).toBe(1);
  });
});
