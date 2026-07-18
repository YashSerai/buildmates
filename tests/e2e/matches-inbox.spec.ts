import { expect, test } from "@playwright/test";
import { signInTestUser } from "./helpers/auth";
test.beforeEach(async ({ page }, testInfo) => {
  await signInTestUser(
    page,
    `matches-${testInfo.project.name}-${testInfo.title}`,
  );
});

test("introductions provides honest cold-start actions without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/matches");
  await expect(page).toHaveTitle("Introductions | Buildmates");
  await expect(
    page.getByRole("heading", { name: "Meet through current work." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No new introductions to review" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open the build graph" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Invite a builder" }).first(),
  ).toBeVisible();
  const dimensions = await page.locator("main").evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(dimensions.scroll - dimensions.client).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: test.info().outputPath("introductions-cold-start.png"),
    fullPage: true,
  });
});

test("inbox exposes loading and truthful empty activity states", async ({
  page,
}) => {
  await page.goto("/inbox");
  await expect(page).toHaveTitle("Activity | Buildmates");
  await expect(
    page.getByRole("heading", { name: "What needs your attention." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nothing needs your attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open introductions" }),
  ).toBeVisible();
  const dimensions = await page.locator("main").evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(dimensions.scroll - dimensions.client).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: test.info().outputPath("activity-cold-start.png"),
    fullPage: true,
  });
});

test("connections preserves a useful cold-start state", async ({ page }) => {
  await page.goto("/connections");
  await expect(page).toHaveTitle("Connections | Buildmates");
  await expect(
    page.getByRole("heading", { name: "People you met through building." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your connections will appear here." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open introductions" }),
  ).toBeVisible();
  const dimensions = await page.locator("main").evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(dimensions.scroll - dimensions.client).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: test.info().outputPath("connections-cold-start.png"),
    fullPage: true,
  });
});

test("circles separates the active collection and preserves its cold-start state", async ({
  page,
}) => {
  await page.goto("/circles");
  await expect(page).toHaveTitle("Circles | Buildmates");
  await expect(
    page.getByRole("heading", {
      name: "Bring related connections into one room.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Active Circles" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No Circles yet" }),
  ).toBeVisible();
  const dimensions = await page.locator("main").evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(dimensions.scroll - dimensions.client).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: test.info().outputPath("circles-cold-start.png"),
    fullPage: true,
  });
});
