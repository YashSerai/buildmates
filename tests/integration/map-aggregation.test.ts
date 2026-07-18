import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listLocationGroups } from "../../apps/web/src/discovery/service";
import { getMapStatistics } from "../../apps/web/src/discovery/map-statistics";

describe("aggregate city map", () => {
  let miniflare: Miniflare;
  let DB: D1Database;
  const now = Date.parse("2026-07-16T12:00:00Z");

  beforeEach(async () => {
    miniflare = new Miniflare({
      modules: true,
      script: "export default {fetch(){return new Response('ok')}}",
      d1Databases: ["DB"],
      compatibilityDate: "2026-05-22",
    });
    DB = await miniflare.getD1Database("DB") as D1Database;
    for (const file of (await readdir("apps/web/drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
      const sql = await readFile(`apps/web/drizzle/${file}`, "utf8");
      for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
        await DB.prepare(statement).run();
      }
    }
  });

  afterEach(async () => miniflare.dispose());

  it("shows anonymous city totals from the first participating builder regardless of profile audience", async () => {
    const eligible = [
      ["map-1", "Vancouver"],
      ["map-2", "Vancouver, BC"],
      ["map-3", "Vancouver BC"],
      ["map-4", "vancouver-ca"],
      ["map-5", "VANCOUVER"],
    ] as const;
    const excluded = [
      ["map-private", "Vancouver", "private", 1],
      ["map-optout", "Vancouver", "public", 0],
      ["map-unknown", "Vancouver region", "public", 1],
    ] as const;

    for (const [userId, location] of eligible.slice(0, 4)) await insertProfile(DB, { userId, location, audience: "public", optIn: 1, now });
    for (const [userId, location, audience, optIn] of excluded) await insertProfile(DB, { userId, location, audience, optIn, now });

    expect(await listLocationGroups(DB, null)).toEqual([expect.objectContaining({cityId:"vancouver-ca",builderCount:5})]);
    await insertProfile(DB, { userId: eligible[4][0], location: eligible[4][1], audience: "public", optIn: 1, now });
    await insertProfile(DB, { userId: "map-hidden-city", location: "Toronto", audience: "public", optIn: 1, now });

    await DB.prepare("INSERT INTO projects(id,owner_user_id,slug,title,summary,audience,allow_matching,status,stage,indexable,published_at,created_at,updated_at) VALUES ('map-project-1','map-1','map-one','Map One','Public mapped work','public',1,'active','prototype',1,?,?,?),('map-project-2','map-2','map-two','Map Two','More public mapped work','public',1,'active','prototype',1,?,?,?),('map-project-private','map-3','map-private','Map Private','Private mapped work','private',1,'active','prototype',0,?,?,?),('map-project-optout','map-optout','map-optout','Map Optout','Public but not mapped','public',1,'active','prototype',1,?,?,?)")
      .bind(now, now, now, now, now, now, now, now, now, now, now, now).run();

    await DB.prepare("INSERT INTO match_pairs(id,user_a_id,user_b_id,created_at) VALUES ('map-pair','map-1','map-2',?),('map-ended-pair','map-3','map-4',?)").bind(now, now).run();
    await DB.prepare("INSERT INTO match_proposals(id,match_pair_id,attempt_number,evidence_version_a,evidence_version_b,acceptance_mode_a,acceptance_mode_b,explanation_a_json,explanation_b_json,state,expires_at,terminal_at,created_at) VALUES ('map-proposal','map-pair',1,1,1,'manual','manual','{}','{}','matched',?,?,?),('map-ended-proposal','map-ended-pair',1,1,1,'manual','manual','{}','{}','matched',?,?,?)").bind(now + 60_000, now, now, now + 60_000, now, now).run();
    await DB.prepare("INSERT INTO matches(id,match_pair_id,proposal_id,matched_at) VALUES ('map-match','map-pair','map-proposal',?),('map-ended-match','map-ended-pair','map-ended-proposal',?)").bind(now, now).run();
    await DB.prepare("INSERT INTO connections(id,match_pair_id,match_id,state,created_at,updated_at) VALUES ('map-connection','map-pair','map-match','active',?,?),('map-ended-connection','map-ended-pair','map-ended-match','ended',?,?)").bind(now, now, now, now).run();
    await DB.prepare("INSERT INTO connection_sides(connection_id,user_id,created_at,updated_at) VALUES ('map-connection','map-1',?,?),('map-connection','map-2',?,?),('map-ended-connection','map-3',?,?),('map-ended-connection','map-4',?,?)").bind(now, now, now, now, now, now, now, now).run();

    const result = await listLocationGroups(DB, null);
    expect(result).toEqual([{
      cityId: "vancouver-ca",
      label: "Vancouver, Canada",
      latitude: 49.2827,
      longitude: -123.1207,
      builderCount: 6,
      projectCount: 3,
      connectionCount: 1,
    },{
      cityId:"toronto-ca",
      label:"Toronto, Canada",
      latitude:43.6532,
      longitude:-79.3832,
      builderCount:1,
      projectCount:0,
      connectionCount:0,
    }]);
    expect(Object.keys(result[0]).sort()).toEqual(["builderCount", "cityId", "connectionCount", "label", "latitude", "longitude", "projectCount"]);
    expect(await getMapStatistics(DB,result)).toMatchObject({mappedBuilderCount:7,qualifyingCityCount:2});
  });
}, 30_000);

async function insertProfile(db: D1Database, input: { userId: string; location: string; audience: "public" | "private"; optIn: number; now: number }) {
  await db.prepare("INSERT INTO users(id,status,operator_role,created_at,updated_at) VALUES (?,'active','none',?,?)").bind(input.userId, input.now, input.now).run();
  await db.prepare("INSERT INTO profiles(id,user_id,display_name,summary,audience,allow_matching,indexable,coarse_location,location_map_opt_in,published_at,created_at,updated_at) VALUES (?,?,?,?,?,1,0,?,?,?, ?,?)")
    .bind(`profile-${input.userId}`, input.userId, input.userId, "Map test profile", input.audience, input.location, input.optIn, input.now, input.now, input.now).run();
}
