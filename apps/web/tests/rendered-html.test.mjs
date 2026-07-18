import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { DB: emptyDiscoveryDb(), ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Buildmates public landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Buildmates<\/title>/i);
  assert.match(html, /Find your people/);
  assert.match(html, /Set up with Codex/);
  assert.match(html, /Codex turns the work you choose to share/);
  assert.match(html, /one Buildmates app/);
  assert.match(html, /Review every introduction or let Full Autopilot/);
  assert.match(html, /your work changes. your network keeps up./);
  assert.doesNotMatch(html, /Browse coarse locations/);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is working|react-loading-skeleton/);
});

test("ships product metadata and removes the starter preview", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /find your people/i);
  assert.match(layout, /title: \{ default: "Buildmates"/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /export const viewport: Viewport/);
  assert.doesNotMatch(layout, /Starter Project|next\/font\/google|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("sitemap and robots omit retired discovery and cohort surfaces", async () => {
  const [sitemapResponse, robotsResponse] = await Promise.all([render("/sitemap.xml"), render("/robots.txt")]);
  assert.equal(sitemapResponse.status, 200);
  assert.equal(robotsResponse.status, 200);
  const [sitemap, robots] = await Promise.all([sitemapResponse.text(), robotsResponse.text()]);
  assert.doesNotMatch(sitemap, /\/discover|\/cohorts/);
  assert.doesNotMatch(robots, /\/discover|\/cohorts/);
  assert.match(robots, /Disallow:\s*\/builders\//);
});

test("privacy and error copy stay aligned with the product boundaries", async () => {
  const [profileReview, graph, errors, profileDesign, onboarding] = await Promise.all([
    readFile(new URL("../components/profile-projects/ProfileReview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/graph/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/user-facing-error.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/profile-projects/RevisionPreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/onboarding/OnboardingClient.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(profileReview, /key === "current_work" \|\|\s+key === "networking_intent"\s+\? "suggested_connections"/);
  assert.match(graph, /anonymous topic network taking shape across Buildmates/);
  assert.match(errors, /export function userFacingError/);
  assert.doesNotMatch(errors, /return value/);
  assert.doesNotMatch(profileDesign, /SurfaceSpec|generation brief|<pre>/i);
  assert.match(profileDesign, /Design with Codex/);
  assert.match(onboarding, /Turn on relevance watch and finish/);
  assert.doesNotMatch(onboarding, /Topic to watch/);
});

function emptyDiscoveryDb() {
  return {
    prepare() {
      return { bind() { return this; }, async all() { return { results: [], success: true }; }, async first() { return null; }, async run() { return { success: true, meta: { changes: 0 } }; } };
    },
    async batch(statements) { return statements.map(() => ({ success: true, meta: { changes: 1 } })); },
  };
}
