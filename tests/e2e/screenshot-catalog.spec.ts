import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { signInTestUser } from "./helpers/auth";
import { qaEvidencePath } from "./helpers/evidence-path";

test.setTimeout(120_000);

const evidenceRoot = qaEvidencePath("2026-07-18", "pages");
const manifestPath = path.join(evidenceRoot, "manifest.csv");
const header = "run_date,route_key,route,state,access,fixture_id,viewer_id,dynamic_values,viewport,screenshot_file,console_errors,page_errors,failed_requests,horizontal_overflow_px,reduced_motion_checked,keyboard_checked,touch_targets_checked,status,notes\n";

test.beforeAll(async () => {
  await mkdir(path.join(evidenceRoot, "desktop"), { recursive: true });
  await mkdir(path.join(evidenceRoot, "phone"), { recursive: true });
  try {
    await writeFile(manifestPath, header, { flag: "wx" });
  } catch {
    // The second Playwright project appends to the run created by the first.
  }
});

test("captures public and signed-out page catalog", async ({ page }, testInfo) => {
  const routes = [
    ["001", "/", "landing--signed-out"],
    ["002", "/product", "product--signed-out"],
    ["003", "/install", "install--signed-out"],
    ["004", "/privacy", "privacy--signed-out"],
    ["005", "/terms", "terms--signed-out"],
    ["006", "/support", "support--signed-out"],
    ["007", "/account", "account--signed-out"],
    ["008", "/account/deleted", "account-deleted"],
    ["009", "/account/appeal", "account-appeal--signed-out"],
    ["010", "/capability-check", "capability-check--signed-out"],
    ["011", "/mcp/authorize", "mcp-authorize--missing-callback"],
    ["012", "/i/not-a-valid-token", "invite--invalid-token"],
    ["013", "/map", "map--current"],
    ["014", "/graph", "graph--current"],
    ["018", "/builders/not-a-real-builder", "builder--unavailable"],
    ["020", "/projects/not-a-real-project", "project--unavailable"],
    ["028", "/rooms/not-a-real-room", "room--unavailable"],
    ["032", "/circles/not-a-real-circle", "circle--unavailable"],
    ["042", "/this-route-does-not-exist", "framework-not-found"],
  ] as const;

  for (const [key, route, state] of routes) {
    await capture(page, testInfo, { key, route, state, access: "public" });
  }

  await page.goto("/");
  await page.getByRole("button", { name: /Set up with Codex/ }).click();
  await expect(page.getByRole("dialog", { name: "Buildmates setup prompt" })).toBeVisible();
  await capture(page, testInfo, { key: "001", route: "/", state: "setup-prompt-dialog", access: "public" });

  await page.goto("/install");
  await page.getByRole("button", { name: "Copy setup prompt" }).click();
  await expect(page.getByRole("dialog", { name: "Buildmates setup prompt" })).toBeVisible();
  await capture(page, testInfo, { key: "003", route: "/install", state: "setup-prompt-dialog", access: "public" });
});

test("captures safe public pages from the deployed Site", async ({ page }, testInfo) => {
  test.skip(process.env.BUILDMATES_CAPTURE_PRODUCTION !== "1", "production capture is an explicit QA action");
  const origin = "https://buildmates.yashns.chatgpt.site";
  const routes = [
    ["001", "/", "landing--production-signed-out"],
    ["002", "/product", "product--production-signed-out"],
    ["003", "/install", "install--production-signed-out"],
    ["004", "/privacy", "privacy--production-signed-out"],
    ["005", "/terms", "terms--production-signed-out"],
    ["006", "/support", "support--production-signed-out"],
    ["007", "/account", "account--production-signed-out"],
    ["008", "/account/deleted", "account-deleted--production"],
    ["010", "/capability-check", "capability-check--production-signed-out"],
    ["011", "/mcp/authorize", "mcp-authorize--production-missing-callback"],
    ["012", "/i/not-a-valid-token", "invite--production-invalid-token"],
    ["013", "/map", "map--production-current"],
    ["014", "/graph", "graph--production-current"],
    ["018", "/builders/not-a-real-builder", "builder--production-unavailable"],
    ["020", "/projects/not-a-real-project", "project--production-unavailable"],
    ["042", "/this-route-does-not-exist", "framework-not-found--production"],
  ] as const;
  for (const [key, route, state] of routes) {
    await capture(page, testInfo, { key, route, state, access: "public-production", absoluteUrl: `${origin}${route}` });
  }
});

test("captures authenticated catalog with shared seeded data", async ({ page }, testInfo) => {
  await page.route("**/api/surface-assets/fixture/**", async (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  }));
  const subject = `catalog-${testInfo.project.name}-${Date.now()}`;
  await signInTestUser(page, subject);
  const fixture = await seedFixture(page, testInfo);

  const routes = [
    ["007", "/account", "account--signed-in"],
    ["009", "/account/appeal", "account-appeal--no-outcome"],
    ["010", "/capability-check", "capability-check--signed-in"],
    ["011", "/mcp/authorize?return_to=https%3A%2F%2Fexample.com%2Fcallback", "mcp-authorize--signed-in"],
    ["012", `/i/${fixture.inviteToken}`, "invite--valid-signed-in"],
    ["015", "/profile", "profile-redirect"],
    ["016", "/profile/edit", "profile-edit--populated"],
    ["017", "/profile/design", "profile-design--no-generated-design"],
    ["018", `/builders/${fixture.handle}`, "builder--owner-fallback"],
    ["019", "/projects/new", "project-new--empty"],
    ["020", `/projects/${fixture.projectSlug}`, "project--owner-populated"],
    ["021", `/projects/${fixture.projectSlug}/edit`, "project-edit--owner"],
    ["022", `/projects/${fixture.projectSlug}/collaboration`, "project-collaboration--unavailable-for-owner"],
    ["023", "/onboarding", "onboarding--current-authoritative-state"],
    ["024", "/onboarding/manual", "onboarding-manual--current-state"],
    ["025", "/home", "home--populated"],
    ["026", "/matches", "introductions--ranked-and-pending"],
    ["027", "/connections", "connections--active"],
    ["028", `/rooms/${fixture.roomId}`, "room--populated"],
    ["029", "/inbox", "activity--mixed-unread"],
    ["030", "/invite", "invite--history"],
    ["031", "/circles", "circles--invitation-and-active"],
    ["032", `/circles/${fixture.activeCircleId}`, "circle--owner-populated"],
    ["033", "/settings/privacy", "privacy-settings--populated"],
    ["034", "/settings/automation", "work-pulse-settings--default"],
    ["035", "/settings/connections", "codex-connection--disconnected"],
    ["036", "/settings/safety", "safety--empty"],
    ["037", "/operator/moderation", "moderation--normal-user-not-found"],
    ["038", "/operator/idempotency-recovery", "recovery--normal-user-not-found"],
    ["039", "/surface-lab", "surface-lab--fixture"],
  ] as const;

  for (const [key, route, state] of routes) {
    await capture(page, testInfo, {
      key,
      route,
      state,
      access: "authenticated",
      fixtureId: "shared-populated-network",
      viewerId: subject,
    });
  }
});

async function seedFixture(page: Page, testInfo: TestInfo) {
  const suffix = `${testInfo.project.name}-${Date.now()}`.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const projectSlug = `catalog-${suffix}`.slice(0, 70).replace(/-+$/, "");
  const created = await page.evaluate(async ({ projectSlug }) => {
    const send = async (url: string, body: unknown, method = "POST") => {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(`${url}:${response.status}:${await response.text()}`);
      return response.json() as Promise<Record<string, unknown>>;
    };
    await send("/api/projects", {
      slug: projectSlug,
      title: "Field Notes for Reliable Agents",
      summary: "A small toolkit for turning agent failures into reproducible evaluations and useful product decisions.",
      audience: "public",
      allowMatching: true,
      status: "active",
      stage: "building",
      links: [{ label: "Project notes", url: "https://example.com/field-notes" }],
      taxonomy: [],
    });
    const invite = await send("/api/invites", { kind: "personal", maximumUses: 5 });
    return { inviteToken: String(invite.token ?? "") };
  }, { projectSlug });
  if (!created.inviteToken) throw new Error("invite_token_missing");
  // Seed the match and relationship graph last. Saving profiles or projects
  // deliberately invalidates ranking evidence, so doing that after this call
  // would make the UI fixture internally inconsistent.
  const network = await page.evaluate(async () => {
    const response = await fetch("/api/testing/populated-network", { method: "POST", headers: { "x-buildmates-e2e": "1" } });
    if (!response.ok) throw new Error(`seed_network_failed:${response.status}:${await response.text()}`);
    const fixture = await response.json() as { viewerHandle: string; roomId: string; activeCircleId: string };
    const spectrum = await fetch("/api/testing/qa-scenarios", {
      method: "POST",
      headers: { "content-type": "application/json", "x-buildmates-e2e": "1" },
      body: JSON.stringify({ scenario: "candidate_spectrum" }),
    });
    if (!spectrum.ok) throw new Error(`seed_spectrum_failed:${spectrum.status}:${await spectrum.text()}`);
    return fixture;
  });
  return { ...network, handle: network.viewerHandle, projectSlug, inviteToken: created.inviteToken };
}

type CaptureInput = {
  key: string;
  route: string;
  state: string;
  access: string;
  fixtureId?: string;
  viewerId?: string;
  absoluteUrl?: string;
};

async function capture(page: Page, testInfo: TestInfo, input: CaptureInput) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const onConsole = (message: { type(): string; text(): string }) => { if (message.type() === "error") consoleErrors.push(message.text()); };
  const onPageError = (error: Error) => pageErrors.push(error.message);
  const onRequestFailed = (request: { url(): string; failure(): { errorText?: string } | null }) => {
    const error = request.failure()?.errorText ?? "failed";
    // Next navigation cancels speculative RSC/link prefetches from the previous
    // page. Chromium reports those intentional cancellations as ERR_ABORTED.
    if (!error.includes("ERR_ABORTED")) failedRequests.push(`${request.url()} ${error}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  // Activity and room pages poll by design, so networkidle is not a valid
  // readiness signal for the catalog. The page-level rendered checks below
  // run after the first complete paint instead.
  const response = await page.goto(input.absoluteUrl ?? input.route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const metrics = await page.evaluate(() => {
    const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth;
    const internalTerms = /surface_spec|profile_id|workspaceScope|idempotencyKey|schema validation|internal note/i.test(document.body.innerText);
    return { overflow: Math.max(0, overflow), internalTerms, title: document.title };
  });
  const firstControl = page.locator("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])").first();
  let keyboardChecked = false;
  let touchTargetsChecked = false;
  if (await firstControl.count()) {
    await firstControl.focus();
    keyboardChecked = await firstControl.evaluate((element) => {
      const style = getComputedStyle(element);
      return Number.parseFloat(style.outlineWidth || "0") > 0 || style.boxShadow !== "none";
    });
    const box = await firstControl.boundingBox();
    touchTargetsChecked = Boolean(box && box.width >= 44 && box.height >= 44);
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const viewport = testInfo.project.name.includes("phone") ? "phone" : "desktop";
  const filename = `${input.key}-${slug(input.state)}.png`;
  const relative = `${viewport}/${filename}`;
  await page.screenshot({ path: path.join(evidenceRoot, relative), fullPage: true, caret: "initial" });
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("requestfailed", onRequestFailed);

  const expectedNotFound = input.state.includes("unavailable") || input.state.includes("not-found") || input.state.includes("invalid-token") || input.state.includes("missing-callback");
  const status = metrics.overflow <= 1 && !metrics.internalTerms && pageErrors.length === 0 && failedRequests.length === 0 && (response?.status() ?? 500) < 500 ? "pass" : "review";
  const notes = [
    expectedNotFound ? "Expected recovery or not-found state." : "",
    !keyboardChecked ? "First control focus indicator needs manual review." : "",
    !touchTargetsChecked ? "First control is below 44px or no control exists; manual route review required." : "",
    metrics.internalTerms ? "Potential internal term detected." : "",
    failedRequests.length ? `Failed requests: ${failedRequests.slice(0, 3).join(" | ")}` : "",
    consoleErrors.length ? `Console errors: ${consoleErrors.slice(0, 2).join(" | ")}` : "",
  ].filter(Boolean).join(" ");
  await appendFile(manifestPath, [
    "2026-07-18", input.key, input.route, input.state, input.access, input.fixtureId ?? "", input.viewerId ?? "", "",
    viewport, relative, String(consoleErrors.length), String(pageErrors.length), String(failedRequests.length), String(metrics.overflow),
    "true", String(keyboardChecked), String(touchTargetsChecked), status, notes,
  ].map(csv).join(",") + "\n");
}

function slug(value: string) { return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(); }
function csv(value: string) { return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value; }
