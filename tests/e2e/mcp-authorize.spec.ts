import { expect, test } from "@playwright/test";
import { signInTestUser } from "./helpers/auth";

const callback = "https://buildmates-mcp.yashserai1.workers.dev/oauth/web-callback?handoff=test-handoff";

test("Codex authorization is clear, actionable, and responsive", async ({ page }, testInfo) => {
  await signInTestUser(page, `mcp-authorize-${testInfo.project.name}-${Date.now()}`);
  await page.goto(`/mcp/authorize?return_to=${encodeURIComponent(callback)}`);

  await expect(page).toHaveTitle("Connect Codex | Buildmates");
  await expect(page.getByRole("heading", { name: "Let Codex work with your Buildmates account." })).toBeVisible();
  await expect(page.getByLabel("Codex connecting to Buildmates")).toBeVisible();
  await expect(page.getByText(/does not give Buildmates access to your repositories/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Codex" })).toBeEnabled();
  await expect(page.getByText(/return to Codex automatically/i)).toBeVisible();

  const layout = await page.locator("main").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("mcp-authorize.png"), fullPage: true });
});

test("expired authorization links explain recovery without a dead button", async ({ page }) => {
  await signInTestUser(page, `mcp-expired-${Date.now()}`);
  await page.goto("/mcp/authorize?return_to");
  await expect(page.getByRole("alert")).toContainText("This connection link has expired.");
  await expect(page.getByRole("button", { name: "Connect Codex" })).toHaveCount(0);
});
