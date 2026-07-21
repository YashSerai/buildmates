import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { getBuildGraph, listLocationGroups } from "../apps/web/src/discovery/service";
import { getMapStatistics } from "../apps/web/src/discovery/map-statistics";

async function main() {
  const miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: ["DB"],
    compatibilityDate: "2026-05-22",
  });

  try {
  const DB = await miniflare.getD1Database("DB") as D1Database;
  const migrations = (await readdir("apps/web/drizzle"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const fixtures = [
    "scripts/fixtures/0025_visualization_qa_fixture.sql",
    "scripts/fixtures/0026_expand_visualization_qa_fixture.sql",
    "scripts/fixtures/0027_visualization_connection_fixture.sql",
    "scripts/fixtures/0028_richer_build_graph_fixture.sql",
  ];

  for (const migration of migrations) {
    const sql = await readFile(`apps/web/drizzle/${migration}`, "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
      await DB.prepare(statement).run();
    }
  }

  for (const fixture of fixtures) {
    const sql = await readFile(fixture, "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) {
      await DB.prepare(statement).run();
    }
  }

  const cities = await listLocationGroups(DB, null);
  const statistics = await getMapStatistics(DB, cities);
  const graph = await getBuildGraph(DB, null);
  const privacy = await DB.prepare(`SELECT
    sum(CASE WHEN audience <> 'private' THEN 1 ELSE 0 END) AS visible,
    sum(CASE WHEN indexable <> 0 THEN 1 ELSE 0 END) AS indexed,
    sum(CASE WHEN allow_matching <> 0 THEN 1 ELSE 0 END) AS matching,
    sum(CASE WHEN published_at IS NOT NULL THEN 1 ELSE 0 END) AS published
    FROM profiles WHERE id LIKE 'qa_visual_profile_%'`).first<Record<string, number>>();
  const handles = await DB.prepare("SELECT count(*) AS count FROM handles WHERE user_id LIKE 'qa_visual_user_%'").first<{ count: number }>();

  const cityCounts = new Map(cities.map((city) => [city.cityId, city.builderCount]));
  assert.equal(cityCounts.get("vancouver-ca"), 16);
  assert.equal(cityCounts.get("burnaby-ca"), 7);
  assert.equal(cityCounts.get("san-francisco-us"), 14);
  assert.equal(cityCounts.get("oakland-us"), 7);
  assert.equal(cityCounts.get("new-york-us"), 12);
  assert.equal(cityCounts.get("jersey-city-us"), 6);
  assert.equal(cityCounts.get("tokyo-jp"), 2);
  assert.equal(cityCounts.get("yokohama-jp"), 5);
  assert.equal(statistics.publishedBuilderCount, 253);
  assert.equal(statistics.mappedBuilderCount, 253);
  assert.equal(statistics.qualifyingCityCount, 47);
  assert.equal(statistics.publicProjectCount, 253);
  assert.ok(statistics.publicTopicCount >= 55);
  assert.equal(statistics.connectionCount, 96);
  assert.ok(cities.filter((city) => city.connectionCount > 0).length >= 20);
  assert.equal(cities.reduce((total, city) => total + city.connectionCount, 0), 192);
  assert.ok(graph.topics.length >= 85);
  assert.ok(graph.edges.length >= 220);
  assert.ok(graph.relationships.length >= 70);
  assert.ok(graph.topics.every((topic) => topic.broaderBuilderCount <= topic.builderCount));
  const payments = graph.topics.find((topic) => topic.id === "payments");
  const billing = graph.topics.find((topic) => topic.id === "payment-infrastructure");
  assert.ok(payments && billing);
  assert.ok(payments.builderCount >= billing.builderCount);
  assert.ok(payments.broaderBuilderCount > 0);
  assert.deepEqual(privacy, { visible: 0, indexed: 0, matching: 0, published: 0 });
  assert.equal(Number(handles?.count ?? -1), 0);

  console.log(JSON.stringify({ cities, statistics, topicCount: graph.topics.length, edgeCount: graph.edges.length, relationshipCount: graph.relationships.length }, null, 2));
  } finally {
    await miniflare.dispose();
  }
}

void main();
