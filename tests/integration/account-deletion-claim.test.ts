import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import type { R2Like } from "../../apps/web/src/platform/r2";
import { beginAccountDeletion } from "../../apps/web/src/privacy/account-deletion";
import { applyD1Migrations } from "../helpers/migrate-d1";

describe("account deletion claim", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    await applyD1Migrations(DB);
  });

  afterEach(async () => mf.dispose());

  it("rolls back the entire batch when the active-user claim has already been lost", async () => {
    const now = Date.now();
    const assets: R2Like = { async put() {}, async get() { return null; }, async delete() {} };
    await DB.batch([
      DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES ('claim-lost','deleting','none',?,?)").bind(now, now),
      DB.prepare("INSERT INTO profiles(id,user_id,display_name,summary,audience,allow_matching,created_at,updated_at) VALUES ('claim-profile','claim-lost','Private builder','Private summary','public',1,?,?)").bind(now, now),
    ]);

    await expect(beginAccountDeletion(DB, "claim-lost", assets)).rejects.toThrow("account_deletion_conflict");
    await expect(DB.prepare("SELECT COUNT(*) AS count FROM deletion_jobs WHERE user_id='claim-lost'").first()).resolves.toEqual({ count: 0 });
    await expect(DB.prepare("SELECT status FROM users WHERE id='claim-lost'").first()).resolves.toEqual({ status: "deleting" });
    await expect(DB.prepare("SELECT display_name AS displayName,summary,audience,allow_matching AS allowMatching FROM profiles WHERE id='claim-profile'").first()).resolves.toEqual({ displayName: "Private builder", summary: "Private summary", audience: "public", allowMatching: 1 });
  }, 30_000);
});
