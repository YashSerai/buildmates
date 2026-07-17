import { expect, test } from "@playwright/test";

test("landing explains the real product and exposes only current network surfaces", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Buildmates");
  await expect(
    page.getByRole("heading", { name: /find your people/i }),
  ).toBeVisible();
  await expect(page.getByText(/You decide what becomes part of your profile/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Discover" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Cohorts" })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("landing.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Map" }).click();
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

test("product, privacy, install, and account paths are complete", async ({
  page,
}) => {
  for (const [path, heading] of [
    ["/product", "Networking that starts with the work."],
    ["/privacy", "Your work stays yours."],
    ["/install", "Start in Codex."],
    ["/account", "Sign in to Buildmates."],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});
