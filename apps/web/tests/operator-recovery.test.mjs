import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("operator recovery is Sites-native, authenticated, admin-only, and same-origin", async () => {
  const [route, page, consoleSource, runbook, linkRoute] = await Promise.all([
    readFile(new URL("../app/api/operator/idempotency-recovery/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/operator/idempotency-recovery/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/operator/idempotency-recovery/RecoveryConsole.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../../docs/runbooks/idempotency-recovery.md", import.meta.url), "utf8"),
    readFile(new URL("../app/api/identity/link-code/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /requireApiIdentity/);
  assert.match(route, /getPlatformBindings/);
  assert.match(route, /operator_role AS role/);
  assert.match(route, /requireSameOriginMutation/);
  assert.match(route, /GROUP_RECOVERY_ERROR/);
  assert.match(route, /recoveryErrorMessage/);
  assert.match(page, /operator_role AS role/);
  assert.match(consoleSource, /mode === "manual_only"/);
  assert.match(consoleSource, /body\.message/);
  assert.match(runbook, /There is intentionally no Wrangler/);
  assert.match(runbook, /are manual-only/i);
  assert.match(runbook, /live owner-database proof remains pending/i);
  assert.match(linkRoute, /export async function POST\(request: Request\)/);
  assert.match(linkRoute, /export async function DELETE\(request: Request\)/);
  assert.equal((linkRoute.match(/requireSameOriginMutation\(request\)/g) ?? []).length, 2);
});
