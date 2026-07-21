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
  assert.match(html, /Codex turns the work you.*already doing into a living/);
  assert.doesNotMatch(html, /built for people/i);
  assert.match(html, /Mutual relevance over popularity/);
  assert.match(html, /Generative UI for every connection/);
  assert.match(html, /The same idea, expanded to a group/);
  assert.match(html, /See where builders are/);
  assert.match(html, /See where ideas overlap/);
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
  assert.match(page, /if \(await getCurrentUser\(\)\) redirect\("\/home"\)/);
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
  assert.match(robots, /Allow:\s*\/builders\//);
  assert.match(robots, /Disallow:\s*\/@/);
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
  assert.match(profileDesign, /Edit profile details/);
  assert.match(onboarding, /Recommended: Tuesdays and Fridays/);
  assert.match(onboarding, /Save Work Pulse preferences/);
  assert.doesNotMatch(onboarding, /Topic to watch/);
});

test("public builder pages are canonical surfaces and keep design controls private", async () => {
  const [builder, designWorkspace, profile, profileReview, surfacePreview, nextConfig, sitemap, robots] = await Promise.all([
    readFile(new URL("../app/builders/[handle]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/profile-projects/RevisionPreview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/profile-projects/ProfileReview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/surfaces/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/robots.ts", import.meta.url), "utf8"),
  ]);
  assert.match(builder, /const canonical = `\/builders\/\$\{encodeURIComponent\(profile\.handle\)\}`/);
  assert.match(builder, /This is your published profile\./);
  assert.match(builder, /Edit design/);
  assert.match(builder, /Tell Codex what to change/);
  assert.match(builder, /if \(profile\.publishedSpec\)[\s\S]*<ProductHeader signedIn=\{Boolean\(profile\.viewerId\)\} \/>/);
  assert.match(builder, /className=\{styles\.publishedSurface\}/);
  assert.match(builder, /const ownPublishedProfile = ownProfile && Boolean\(profile\.publishedSpec\)/);
  assert.match(builder, /profile_fields WHERE profile_id=\? AND audience='public'/);
  assert.match(builder, /"profile\.facts": profile\.surfaceFacts/);
  assert.match(builder, /"profile\.projects": profile\.surfaceProjects/);
  assert.match(builder, /surfaceFactValue\(field\.valueJson\)/);
  assert.match(surfacePreview, /surfaceFactValue\(field\.valueJson\)/);
  assert.match(surfacePreview, /profile_fields WHERE profile_id=\? AND audience<>'private'/);
  assert.match(surfacePreview, /projects WHERE owner_user_id=\? AND status='active' AND audience<>'private'/);
  assert.doesNotMatch(builder, /workSignals/);
  assert.doesNotMatch(builder, /Make this page feel like you\./);
  assert.match(designWorkspace, /Make your page feel like you\./);
  assert.match(designWorkspace, /className=\{styles\.designHistory\}/);
  assert.match(designWorkspace, /<SurfaceRenderer\s+spec=\{activePreview\.spec\}/);
  assert.doesNotMatch(designWorkspace, /isRecoveryStarter/);
  assert.doesNotMatch(designWorkspace, /Safe starter preview/);
  assert.doesNotMatch(designWorkspace, /Design \{revision\.revisionNumber\}/);
  assert.equal(designWorkspace.includes(String.fromCharCode(0xe2, 0x20ac, 0xa6)), false);
  assert.equal(designWorkspace.includes(String.fromCharCode(0xc2, 0xb7)), false);
  assert.match(profile, /profile\?\.handle && profile\.publishedRevisionId/);
  assert.match(profile, /if \(profile\?\.handle\) redirect\("\/profile\/design"\)/);
  assert.match(profileReview, /router\.push\("\/profile\/design"\)/);
  assert.match(profileReview, /Save and continue to design/);
  assert.match(builder, /profile\.fields\s*\.filter\(\(field\) => field\.key !== "projects"\)/);
  assert.match(builder, /field\.key === "current_work"[\s\S]*currentWorkProjectsValue/);
  assert.match(builder, /profile\.surfaceProjects\.map/);
  assert.match(nextConfig, /async redirects\(\)/);
  assert.match(nextConfig, /source: "\/@:handle", destination: "\/builders\/:handle", permanent: true/);
  assert.doesNotMatch(nextConfig, /async rewrites\(\)/);
  assert.match(sitemap, /\/builders\/\$\{encodeURIComponent\(row\.handle\)\}/);
  assert.match(robots, /"\/builders\/"/);
  assert.match(robots, /"\/@"/);
});

function emptyDiscoveryDb() {
  return {
    prepare() {
      return { bind() { return this; }, async all() { return { results: [], success: true }; }, async first() { return null; }, async run() { return { success: true, meta: { changes: 0 } }; } };
    },
    async batch(statements) { return statements.map(() => ({ success: true, meta: { changes: 1 } })); },
  };
}
