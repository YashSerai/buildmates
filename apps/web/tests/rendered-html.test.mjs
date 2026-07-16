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
  assert.match(html, /Build your profile/);
  assert.match(html, /You approve the work summaries that leave your conversation/);
  assert.match(html, /work signals in. mutual relevance out./);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is working|react-loading-skeleton/);
});

test("ships product metadata and removes the starter preview", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /a connection, from signal to room/i);
  assert.match(layout, /title: \{ default: "Buildmates"/);
  assert.match(layout, /summary_large_image/);
  assert.match(layout, /export const viewport: Viewport/);
  assert.doesNotMatch(layout, /Starter Project|next\/font\/google|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

function emptyDiscoveryDb() {
  return {
    prepare() {
      return { bind() { return this; }, async all() { return { results: [], success: true }; }, async first() { return null; }, async run() { return { success: true, meta: { changes: 0 } }; } };
    },
    async batch(statements) { return statements.map(() => ({ success: true, meta: { changes: 1 } })); },
  };
}
