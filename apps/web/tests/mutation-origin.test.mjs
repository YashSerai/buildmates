import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browserMutationRoutes = [
  "../app/api/projects/route.ts",
  "../app/api/surface-assets/route.ts",
  "../app/api/capability/d1/route.ts",
  "../app/api/capability/r2/route.ts",
];

test("cookie-authenticated browser mutations enforce exact same-origin requests", async () => {
  for (const route of browserMutationRoutes) {
    const source = await readFile(new URL(route, import.meta.url), "utf8");
    assert.match(source, /requireSameOriginMutation\(request\)/, route);
  }
});

test("the synthetic identity route cannot mint sessions in production", async () => {
  const source = await readFile(new URL("../app/api/testing/session/route.ts", import.meta.url), "utf8");
  assert.match(source, /process\.env\.NODE_ENV === "production"/);
});

test("viewer-dependent profile and project reads are never shared-cacheable", async () => {
  for (const route of ["../app/api/profiles/[handle]/route.ts", "../app/api/projects/[slug]/route.ts", "../app/api/projects/route.ts"]) {
    const source = await readFile(new URL(route, import.meta.url), "utf8");
    assert.match(source, /private, no-store/, route);
    assert.match(source, /vary:\s*"Cookie"/, route);
  }
});
