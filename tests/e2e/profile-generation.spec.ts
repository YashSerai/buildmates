import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { signInTestUser } from "./helpers/auth";
import { qaEvidencePath } from "./helpers/evidence-path";

const evidenceRoot = qaEvidencePath("2026-07-20", "profile-flow");
test.beforeAll(async () => { await mkdir(evidenceRoot, { recursive: true }); });

test.beforeEach(async ({ page }, testInfo) => {
  await signInTestUser(page, `profiles-${testInfo.project.name}-${testInfo.title}`);
});

test("profile review is a complete responsive privacy form", async ({ page }) => {
  await page.goto("/profile/edit");
  await expect(page.getByRole("heading", { name: "Choose what Buildmates can use in your profile." })).toBeVisible();
  await expect(page.getByLabel("Introduction approval")).toBeVisible();
  await expect(page.getByLabel("Who can see this?").first()).toBeVisible();
  await expect(page.getByText("Let Buildmates suggest me using my reviewed name and short introduction")).toBeVisible();
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  await page.screenshot({ path: path.join(evidenceRoot, `${test.info().project.name}-profile-edit.png`), fullPage: true, caret: "initial" });
});

test("profile editing continues into the private custom-design workspace", async ({ page }, testInfo) => {
  const project = testInfo.project.name.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const handle = `route_${project}_${Date.now().toString(36).slice(-6)}`.slice(0, 32);
  await page.goto("/profile/edit");
  await page.getByLabel("Display name").fill("Route Tester");
  await page.getByLabel("Profile address").fill(handle);
  await page.getByRole("textbox", { name: "Short introduction" }).fill("Building a clear way to meet other builders.");
  const profileResponse = page.waitForResponse((response) => response.url().includes(`/api/profiles/${handle}`) && response.request().method() === "PUT", { timeout: 30_000 });
  await page.getByRole("button", { name: "Save and continue to design" }).click();
  const response = await profileResponse;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(page).toHaveURL(/\/profile\/design$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Make your page feel like you." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit profile details" })).toHaveAttribute("href", "/profile/edit");
  await expect(page.getByText("Review the complete page on desktop and phone before publishing.")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(evidenceRoot, `${testInfo.project.name}-profile-design.png`), fullPage: true, caret: "initial" });
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile\/design$/);
});

test("profile review keeps the draft after an unconfirmed save and a network retry", async ({ page }, testInfo) => {
  const handle = `recovery_${testInfo.project.name.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
  let releaseScripts!: () => void;
  const scriptGate = new Promise<void>((resolve) => { releaseScripts = resolve; });
  const holdScripts = async (route: import("@playwright/test").Route) => {
    if (route.request().resourceType() === "script") await scriptGate;
    await route.continue();
  };
  await page.route("**/*", holdScripts);
  const save = page.getByRole("button", { name: "Save and continue to design" });
  try {
    await page.goto("/profile/edit", { waitUntil: "commit" });
    await expect(save).toBeDisabled();
    await expect(page.locator('form[data-hydrated="false"]')).toHaveCount(1);
    expect(page.url()).toMatch(/\/profile\/edit$/);
  } finally {
    releaseScripts();
    await page.unrouteAll({ behavior: "wait" });
  }
  await page.waitForLoadState("load", { timeout: 30_000 });
  await expect(page.locator('form[data-hydrated="true"]')).toHaveCount(1);
  await expect(save).toBeEnabled();

  let attempts = 0;
  await page.route("**/api/profiles/**", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<p>not json</p>" });
      return;
    }
    await route.abort("failed");
  });

  const displayName = page.getByLabel("Display name");
  const profileAddress = page.getByLabel("Profile address");
  const summary = page.getByRole("textbox", { name: "Short introduction" });
  await displayName.fill("Retry Tester");
  await profileAddress.fill(handle);
  await summary.fill("Keeping the profile draft available while the connection recovers.");

  await save.click();
  await expect(page.getByRole("alert")).toHaveText("Profile save was not confirmed. Refresh and try again.");
  await expect(save).toBeEnabled();
  await expect(displayName).toHaveValue("Retry Tester");
  await expect(profileAddress).toHaveValue(handle);
  await expect(summary).toHaveValue("Keeping the profile draft available while the connection recovers.");

  await save.click();
  await expect(page.getByRole("alert")).toHaveText("Buildmates could not reach the server. Check your connection and try again.");
  await expect(save).toBeEnabled();
  await expect(displayName).toHaveValue("Retry Tester");
  await expect(profileAddress).toHaveValue(handle);
  await expect(summary).toHaveValue("Keeping the profile draft available while the connection recovers.");
  expect(attempts).toBe(2);
});

test("signed-in landing visits enter the product home", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
});

test("the canonical builder fallback shows approved project drafts without an empty grid cell", async ({ page }) => {
  const fixture = await page.evaluate(async () => {
    const response = await fetch("/api/testing/populated-network", { method: "POST", headers: { "x-buildmates-e2e": "1" } });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{ viewerHandle: string }>;
  });
  await page.goto(`/builders/${fixture.viewerHandle}`);
  await expect(page.getByRole("heading", { name: "Match quality harness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Relationship journey" })).toBeVisible();
  await expect(page.getByText("No visible projects yet.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit design" })).toHaveAttribute("href", "/profile/design");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(evidenceRoot, `${test.info().project.name}-builder-fallback.png`), fullPage: true, caret: "initial" });
});

test("project creation exposes lifecycle and audience controls", async ({ page }) => {
  await page.goto("/projects/new");
  await expect(page.getByRole("heading", { name: "Show what you are building." })).toBeVisible();
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByLabel("Visibility")).toBeVisible();
  await expect(page.getByText("Use this project for matching")).toBeVisible();
});
