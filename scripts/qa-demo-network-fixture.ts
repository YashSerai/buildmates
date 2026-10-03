import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { getMcpCandidateShortlist } from "../apps/web/src/matching/mcp-adapter";
import { listMatchInbox } from "../apps/web/src/matching/service";
import { listConnections } from "../apps/web/src/rooms/service";
import { listCircles, listCircleMessages } from "../apps/web/src/circles/service";
import { getProfileByHandle } from "../apps/web/src/profile-projects/service";

const viewerId = "fixture_yashns_user";
const fixture = "scripts/fixtures/0031_demo_network_yashns.sql";
const cleanup = "scripts/fixtures/0031_demo_network_yashns_cleanup.sql";

async function applySql(DB: D1Database, path: string) {
  const sql = await readFile(path, "utf8");
  const statements = sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean);
  for (const [index, statement] of statements.entries()) {
    try {
      await DB.prepare(statement).run();
    } catch (error) {
      throw new Error(`${path} statement ${index + 1} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
}

async function main() {
  const miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: ["DB"],
    compatibilityDate: "2026-05-22",
  });

  try {
    const DB = await miniflare.getD1Database("DB") as D1Database;
    for (const migration of (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
      await applySql(DB, `apps/web/drizzle/${migration}`);
    }

    const now = Date.now();
    const taxonomy = await DB.prepare("SELECT id,version FROM taxonomy_versions WHERE status='active' ORDER BY version DESC LIMIT 1")
      .first<{ id: string; version: number }>();
    assert.ok(taxonomy);
    await DB.batch([
      DB.prepare("INSERT INTO users(id,status,operator_role,data_origin,created_at,updated_at) VALUES(?,'active','none','qa_fixture',?,?)").bind(viewerId, now, now),
      DB.prepare("INSERT INTO handles(user_id,handle,normalized_handle,created_at) VALUES(?,'yashns','yashns',?)").bind(viewerId, now),
      DB.prepare("INSERT INTO profiles(id,user_id,display_name,summary,project_or_interest,portfolio_links_json,audience,allow_matching,acceptance_mode,indexable,published_at,created_at,updated_at) VALUES('fixture_yashns_profile',?,'Yash Serai','Builds AI-native products.','Buildmates','[]','public',1,'manual',1,?,?,?)").bind(viewerId, now, now, now),
      DB.prepare("INSERT INTO builder_match_index(user_id,version,taxonomy_version_id,topics_json,tools_json,domains_json,stages_json,intents_json,updated_at) VALUES(?,3,?,'[\"ai-agents\",\"mcp\"]','[]','[]','[\"building\"]','[]',?)").bind(viewerId, taxonomy.id, now),
    ]);

    // Exercise the production migration in the state it will actually see: the
    // existing yashns account already has a handle and match index.
    await applySql(DB, "apps/web/drizzle/0031_demo_network_yashns.sql");
    await applySql(DB, fixture);
    await applySql(DB, fixture);

    const shortlist = await getMcpCandidateShortlist(DB, { userId: viewerId, limit: 30, now: new Date().toISOString() });
    assert.deepEqual(shortlist.candidates.map((candidate) => candidate.displayName), ["Amina Sol", "Marcus Vale", "Noor Bell"]);

    const inbox = await listMatchInbox(DB, viewerId, Date.now());
    assert.ok(inbox.some((item) => item.proposalId === "demo_network_proposal_amina" && item.theirEvaluation === "approve" && item.myResponse === null));

    const connections = await listConnections(DB, viewerId);
    assert.ok(connections.some((connection) => connection.id === "demo_network_connection_rowan" && connection.roomId === "demo_network_room_rowan"));

    const circles = await listCircles(DB, viewerId);
    assert.ok(circles.some((circle) => circle.id === "demo_network_circle_agents" && circle.membershipStatus === "active"));
    const circleMessages = await listCircleMessages(DB, "demo_network_circle_agents", viewerId);
    assert.equal(circleMessages.at(-1)?.body, "I added a compact failure taxonomy from this week's agent run.");

    const activity = await DB.prepare("SELECT kind FROM notifications WHERE user_id=? AND id LIKE 'demo_network_%' ORDER BY id")
      .bind(viewerId).all<{ kind: string }>();
    assert.deepEqual(activity.results.map((row) => row.kind).sort(), ["circle_message", "match_interest", "new_message"]);

    for (const handle of ["amina_demo", "marcus_demo", "noor_demo", "rowan_demo"]) {
      assert.equal(await getProfileByHandle(DB, handle, null), null);
      assert.ok(await getProfileByHandle(DB, handle, viewerId));
    }
    const privacy = await DB.prepare("SELECT count(*) AS count FROM profiles WHERE id LIKE 'demo_network_profile_%' AND (audience<>'signed_in' OR indexable<>0)")
      .first<{ count: number }>();
    assert.equal(Number(privacy?.count), 0);

    await applySql(DB, cleanup);
    const remaining = await DB.prepare(`SELECT
      (SELECT count(*) FROM users WHERE id LIKE 'demo_network_%')+
      (SELECT count(*) FROM pair_scores WHERE id LIKE 'demo_network_%')+
      (SELECT count(*) FROM match_proposals WHERE id LIKE 'demo_network_%')+
      (SELECT count(*) FROM connections WHERE id LIKE 'demo_network_%')+
      (SELECT count(*) FROM rooms WHERE id LIKE 'demo_network_%')+
      (SELECT count(*) FROM notifications WHERE id LIKE 'demo_network_%')+
      (SELECT count(*) FROM circles WHERE id LIKE 'demo_network_%') AS count`).first<{ count: number }>();
    assert.equal(Number(remaining?.count), 0);
    assert.ok(await DB.prepare("SELECT 1 AS ok FROM users WHERE id=?").bind(viewerId).first());
    assert.ok(await DB.prepare("SELECT 1 AS ok FROM handles WHERE user_id=? AND normalized_handle='yashns'").bind(viewerId).first());

    console.log(JSON.stringify({ shortlist: shortlist.candidates.map((candidate) => candidate.displayName), inbox: inbox.length, connections: connections.length, activity: activity.results.length, circles: circles.length, cleanup: "pass" }, null, 2));
  } finally {
    await miniflare.dispose();
  }
}

void main();
