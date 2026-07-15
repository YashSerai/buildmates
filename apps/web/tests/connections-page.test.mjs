import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeRoot = new URL("../app/settings/connections/", import.meta.url);

test("connection settings page is protected and uses the real link-code API", async () => {
  const [page, client, api] = await Promise.all([
    readFile(new URL("page.tsx", routeRoot), "utf8"),
    readFile(new URL("ConnectionsClient.tsx", routeRoot), "utf8"),
    readFile(new URL("../app/api/identity/link-code/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /requireUser\("\/settings\/connections"\)/);
  assert.match(page, /getIdentityConnectionStatus/);
  assert.match(client, /fetch\("\/api\/identity\/link-code", \{ method: "POST" \}\)/);
  assert.match(client, /method: "GET", cache: "no-store"/);
  assert.match(client, /method: "DELETE"/);
  assert.match(client, /navigator\.clipboard\.writeText\(linkCode\.code\)/);
  assert.match(api, /export async function GET\(\)/);
  assert.match(api, /export async function POST\(request: Request\)/);
  assert.match(api, /export async function DELETE\(request: Request\)/);
  assert.match(api, /"cache-control": "private, no-store"/);
});

test("connection UI includes explicit approval, privacy copy, and accessible states", async () => {
  const [page, client, css] = await Promise.all([
    readFile(new URL("page.tsx", routeRoot), "utf8"),
    readFile(new URL("ConnectionsClient.tsx", routeRoot), "utf8"),
    readFile(new URL("connections.module.css", routeRoot), "utf8"),
  ]);

  assert.match(page, /Approve a private link/);
  assert.match(page, /does not grant Buildmates access to your raw chats/);
  assert.match(client, /Approve and create code/);
  assert.match(client, /role="status" aria-live="polite"/);
  assert.match(client, /window\.confirm\("Disconnect Buildmates from Codex\?/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|backdrop-filter/i);
});
