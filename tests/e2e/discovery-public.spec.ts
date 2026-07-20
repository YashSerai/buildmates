import { expect, test } from "@playwright/test";

test("landing explains the real product and exposes only current network surfaces", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Buildmates");
  await expect(
    page.getByRole("heading", { name: /find your people/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Set up with Codex/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy setup prompt" })).toHaveCount(0);
  await page.getByRole("button", { name: /Set up with Codex/ }).click();
  const setupToast = page.getByRole("dialog", { name: "Buildmates setup prompt" });
  await expect(setupToast).toBeVisible();
  const closePrompt = page.getByRole("button", { name: "Close setup prompt" });
  await expect(closePrompt).toBeFocused();
  const backdrop = setupToast.locator("..");
  await expect(backdrop).toHaveCSS("position", "fixed");
  await expect(backdrop).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const [dialogBox, viewport] = await Promise.all([
    setupToast.boundingBox(),
    page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
  ]);
  expect(dialogBox).not.toBeNull();
  expect(Math.abs(dialogBox!.x + dialogBox!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(dialogBox!.y + dialogBox!.height / 2 - viewport.height / 2)).toBeLessThan(2);
  await expect(page.getByLabel("Copied Buildmates setup prompt")).toHaveValue(
    /buildmates\.yashns\.chatgpt\.site\/llms\.txt/,
  );
  await expect(setupToast.getByRole("status")).toContainText(/Copied|Clipboard access was blocked/);
  await expect(page.getByText(/You decide what becomes part of your profile/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Discover" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Cohorts" })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("landing.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(setupToast).toBeHidden();
  await expect(page.getByRole("button", { name: /Set up with Codex/ })).toBeFocused();
  await page.getByLabel("Footer").getByRole("link", { name: "Map" }).click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(
    page.getByRole("heading", { name: "See where builders are gathering." }),
  ).toBeVisible();
});

test("public map and graph retain honest empty states", async ({ page }) => {
  for (const [path, heading] of [
    ["/map", "See where builders are gathering."],
    ["/graph", "See what builders are working on."],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow, `${path} has no horizontal overflow`).toBe(false);
  }
});

test("removed discovery and cohort routes are unavailable", async ({
  request,
}) => {
  for (const path of [
    "/discover",
    "/cohorts",
    "/cohorts/old-cohort",
    "/api/discovery",
    "/api/cohorts",
    "/api/cohorts/old-cohort",
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test("sitemap and robots expose no discovery or cohort URLs", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const robots = await (await request.get("/robots.txt")).text();
  expect(sitemap).not.toContain("/discover");
  expect(sitemap).not.toContain("/cohorts");
  expect(robots).not.toContain("/discover");
  expect(robots).not.toContain("/cohorts");
});

test("Codex can read the public setup contract", async ({ request }) => {
  const response = await request.get("/llms.txt");
  expect(response.status()).toBe(200);
  const instructions = await response.text();
  expect(instructions).toContain("Canonical setup guide: https://buildmates.yashns.chatgpt.site/install");
  expect(instructions).toContain("Fetch this file directly as public text");
  expect(instructions).toContain("host's native plugin-install confirmation");
  expect(instructions).toContain("A plugin installed during a task does not hot-load its skills and MCP tools");
  expect(instructions).toContain("Buildmates is installed. May I open a fresh Codex task to activate it and continue setup?");
  expect(instructions).toContain("Buildmates setup - continue here");
  expect(instructions).toContain("Buildmates installation - complete");
  expect(instructions).toContain("Never fork when native task creation is available");
  expect(instructions).toContain("If task creation or title/archive controls are unavailable");
  expect(instructions).toContain("Never spawn recursive `codex exec` helpers or use a child Codex process");
  expect(instructions).toContain("Call `get_setup_state` immediately");
  expect(instructions).toContain("Never infer progress from old tasks");
  expect(instructions).toContain("show up to three concrete next actions");
  expect(instructions).toContain("Use my Codex workspace");
  expect(instructions).toContain("every accessible task without filtering to the current directory");
  expect(instructions).toContain("limit: 50");
  expect(instructions).toContain("Never collapse product roots");
  expect(instructions).toContain("exact absolute normalized root(s)");
  expect(instructions).toContain("never submit `codex_workspace` as a source ID");
  expect(instructions).toContain("every project and every task in the approved inventory");
  expect(instructions).toContain("only the current project is represented");
  expect(instructions).toContain("Skip workspace review");
  expect(instructions).toContain("without asking for permission again");
  expect(instructions).toContain("published profile is public");
  expect(instructions).toContain("anonymous aggregate bubble");
  expect(instructions).toContain("Do not compress these settings into one unexplained approval sentence");
  expect(instructions).toContain("Do not treat GitHub website sign-in as repository permission");
  expect(instructions).toContain("submit only reviewed structured profile fields");
});

test("product, privacy, install, and account paths are complete", async ({
  page,
}, testInfo) => {
  for (const [path, heading] of [
    ["/product", "Networking that starts with the work."],
    ["/privacy", "Your work stays yours."],
    ["/install", "Give Codex one link."],
    ["/account", "Sign in to Buildmates."],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await page.goto("/install");
  await page.getByRole("button", { name: /Set up with Codex/ }).click();
  const installDialog = page.getByRole("dialog", { name: "Buildmates setup prompt" });
  await expect(installDialog).toBeVisible();
  await expect(page.getByLabel("Copied Buildmates setup prompt")).toHaveValue(
    "Set up Buildmates for me using the official Codex instructions: https://buildmates.yashns.chatgpt.site/llms.txt",
  );
  await expect(page.getByText(/handles the Buildmates connection inside Codex/i)).toBeVisible();
  await expect(page.getByText(/continue an unfinished setup/i)).toBeVisible();
  await expect(page.getByText(/Use my Codex workspace/i)).toBeVisible();
  await expect(page.getByText(/research stays in Codex/i)).toBeVisible();
  await expect(page.getByText("Testing before publication")).toHaveCount(0);
  await expect(page.getByText(/buildmates-mcp\.yashserai1/i)).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("install-dialog.png"),
  });
  await page.keyboard.press("Escape");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, "/install has no horizontal overflow").toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("install.png"),
    fullPage: true,
  });
});
