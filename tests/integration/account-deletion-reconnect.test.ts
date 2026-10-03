import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { respondReconnect } from "../../apps/web/src/rooms/lifecycle";
import type { R2Like } from "../../apps/web/src/platform/r2";
import { beginAccountDeletion } from "../../apps/web/src/privacy/account-deletion";
import { applyD1Migrations } from "../helpers/migrate-d1";

describe("account deletion reconnect revocation", () => {
  let mf: Miniflare;
  let DB: D1Database;

  beforeEach(async () => {
    mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", d1Databases: ["DB"], compatibilityDate: "2026-05-22" });
    DB = await mf.getD1Database("DB") as D1Database;
    await applyD1Migrations(DB);
  });

  afterEach(async () => mf.dispose());

  it("declines pending reconnects and blocks an old request from reviving a deleted account", async () => {
    const now = Date.now();
    const assets: R2Like = { async put() {}, async get() { return null; }, async delete() {} };
    await DB.batch([
      DB.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES ('delete-reconnect','active','none',?,?),('other-reconnect','active','none',?,?)").bind(now, now, now, now),
      DB.prepare("INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at) VALUES ('reconnect-pair','delete-reconnect','other-reconnect',?)").bind(now),
      DB.prepare("INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,created_at) VALUES ('reconnect-proposal','reconnect-pair',1,1,1,'manual','manual','{}','{}','matched',?,?)").bind(now + 86_400_000, now),
      DB.prepare("INSERT INTO matches(id,match_pair_id,proposal_id,matched_at) VALUES ('reconnect-match','reconnect-pair','reconnect-proposal',?)").bind(now),
      DB.prepare("INSERT INTO connections(id,match_pair_id,match_id,state,created_at,updated_at) VALUES ('reconnect-connection','reconnect-pair','reconnect-match','ended',?,?)").bind(now, now),
      DB.prepare("INSERT INTO connection_sides(connection_id,user_id,created_at,updated_at) VALUES ('reconnect-connection','delete-reconnect',?,?),('reconnect-connection','other-reconnect',?,?)").bind(now, now, now, now),
      DB.prepare("INSERT INTO rooms(id,match_pair_id,connection_id,status,created_at,updated_at) VALUES ('reconnect-room','reconnect-pair','reconnect-connection','ended',?,?)").bind(now, now),
      DB.prepare("INSERT INTO reconnect_requests(id,connection_id,requester_user_id,response,created_at) VALUES ('reconnect-request','reconnect-connection','delete-reconnect','pending',?)").bind(now),
      DB.prepare("INSERT INTO connection_private_notes(id,connection_id,owner_user_id,body,created_at,updated_at) VALUES ('reconnect-note','reconnect-connection','delete-reconnect','private reconnect context',?,?)").bind(now, now),
      DB.prepare("INSERT INTO circles(id,name,purpose,status,governance_mode,governance_version,created_at,updated_at) VALUES ('deleted-circle','Private circle title','Private circle purpose','active','admin',1,?,?)").bind(now, now),
      DB.prepare("INSERT INTO circle_memberships(circle_id,user_id,role,status,joined_at) VALUES ('deleted-circle','delete-reconnect','owner','active',?),('deleted-circle','other-reconnect','member','active',?)").bind(now, now),
      DB.prepare("INSERT INTO invite_links(id,creator_user_id,kind,token_hash,headline,target_id,recipient_user_id,maximum_uses,use_count,expires_at,created_at) VALUES ('deleted-invite','other-reconnect','personal','deleted-invite-token','Invite',NULL,NULL,1,0,?,?)").bind(now + 86_400_000, now),
      DB.prepare("INSERT INTO invite_redemptions(invite_id,user_id,accepted_at) VALUES ('deleted-invite','delete-reconnect',?)").bind(now),
    ]);

    const result = await beginAccountDeletion(DB, "delete-reconnect", assets);
    expect(result.status).toBe("complete");
    expect(await DB.prepare("SELECT response,responded_at AS respondedAt FROM reconnect_requests WHERE id='reconnect-request'").first()).toMatchObject({ response: "declined", respondedAt: expect.any(Number) });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM connection_private_notes WHERE owner_user_id='delete-reconnect'").first()).toEqual({ count: 0 });
    expect(await DB.prepare("SELECT COUNT(*) AS count FROM invite_redemptions WHERE user_id='delete-reconnect'").first()).toEqual({ count: 0 });
    expect(await DB.prepare("SELECT name,purpose,status FROM circles WHERE id='deleted-circle'").first()).toEqual({ name: "Deleted Circle", purpose: "", status: "archived" });

    await expect(respondReconnect(DB, { connectionId: "reconnect-connection", userId: "other-reconnect", requestId: "reconnect-request", response: "accepted", now: now + 1 })).rejects.toThrow("reconnect_not_found");
    await expect(DB.prepare("SELECT state FROM connections WHERE id='reconnect-connection'").first()).resolves.toEqual({ state: "ended" });
    await expect(DB.prepare("SELECT status FROM rooms WHERE id='reconnect-room'").first()).resolves.toEqual({ status: "ended" });

    await DB.prepare("UPDATE reconnect_requests SET response='pending',responded_at=NULL WHERE id='reconnect-request'").run();
    await expect(respondReconnect(DB, { connectionId: "reconnect-connection", userId: "other-reconnect", requestId: "reconnect-request", response: "accepted", now: now + 2 })).rejects.toThrow("reconnect_not_found");
    await expect(DB.prepare("SELECT response FROM reconnect_requests WHERE id='reconnect-request'").first()).resolves.toEqual({ response: "pending" });

    // Exercise the duplicate-response window: the request CAS can win and
    // then an account-status change can happen before the relationship rows
    // are updated. Those later updates must re-check both participants.
    await DB.batch([
      DB.prepare("UPDATE users SET status='active',deleted_at=NULL,updated_at=? WHERE id='delete-reconnect'").bind(now + 3),
      DB.prepare("CREATE TRIGGER reconnect_status_guard AFTER UPDATE OF response ON reconnect_requests WHEN NEW.id='reconnect-request' AND NEW.response='accepted' BEGIN UPDATE users SET status='deleted',deleted_at=NEW.responded_at,updated_at=NEW.responded_at WHERE id='delete-reconnect'; UPDATE connections SET state='ended',ended_at=NEW.responded_at,updated_at=NEW.responded_at WHERE id=NEW.connection_id; UPDATE rooms SET status='ended',updated_at=NEW.responded_at WHERE connection_id=NEW.connection_id; END"),
    ]);
    await expect(DB.prepare("SELECT status FROM users WHERE id='delete-reconnect'").first()).resolves.toEqual({ status: "active" });
    await expect(DB.prepare("SELECT response FROM reconnect_requests WHERE id='reconnect-request'").first()).resolves.toEqual({ response: "pending" });
    await expect(respondReconnect(DB, { connectionId: "reconnect-connection", userId: "other-reconnect", requestId: "reconnect-request", response: "accepted", now: now + 3 })).resolves.toBeUndefined();
    await expect(DB.prepare("SELECT response FROM reconnect_requests WHERE id='reconnect-request'").first()).resolves.toEqual({ response: "accepted" });
    await expect(DB.prepare("SELECT state FROM connections WHERE id='reconnect-connection'").first()).resolves.toEqual({ state: "ended" });
    await expect(DB.prepare("SELECT status FROM rooms WHERE id='reconnect-room'").first()).resolves.toEqual({ status: "ended" });
  }, 30_000);
});
