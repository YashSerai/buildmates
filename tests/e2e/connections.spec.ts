import { expect, test } from "@playwright/test";

test("authenticated user can approve a one-time Codex link without layout overflow", async ({ page }, testInfo) => {
  await useIsolatedIdentity(page, `approval-${testInfo.project.name}-${Date.now()}`);
  await page.goto("/settings/connections");

  await expect(page).toHaveTitle("Connect Codex | Buildmates");
  await expect(page.getByRole("heading", { name: "Connect Buildmates to Codex" })).toBeVisible();
  await expect(page.getByText("Codex is not connected")).toBeVisible();
  await expect(page.getByText(/does not grant Buildmates access to your raw chats/i)).toBeVisible();
  await expect(page.locator("section[data-hydrated=true]")).toBeVisible();

  const approval = page.getByRole("button", { name: "Approve and create code" });
  await expect(approval).toBeEnabled();
  await approval.click();

  const code = page.getByLabel(/One-time link code/);
  await expect(code).toBeVisible();
  await expect(code).toHaveText(/^[A-F0-9]{32}$/);
  await expect(page.getByRole("button", { name: "Copy code" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check connection" })).toBeVisible();
  await expect(page.getByText(/Code created\. Return to Codex to finish linking\./)).toBeVisible();

  const layout = await page.locator("main").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(layout.scrollWidth - layout.clientWidth).toBeLessThanOrEqual(1);

  await page.screenshot({ path: test.info().outputPath("connections-issued.png"), fullPage: true });
});

test("connection approval has a visible keyboard focus state and honors reduced motion", async ({ page }, testInfo) => {
  await useIsolatedIdentity(page, `motion-${testInfo.project.name}-${Date.now()}`);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/settings/connections");

  const approval = page.getByRole("button", { name: "Approve and create code" });
  await approval.focus();
  const focus = await approval.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focus.outlineStyle).toBe("solid");
  expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(3);

  await approval.click();
  const pendingLine = page.locator("span[class*=linePending]");
  await expect(pendingLine).toBeVisible();
  expect(await pendingLine.evaluate((element) => getComputedStyle(element, "::after").animationName)).toBe("none");
});

async function useIsolatedIdentity(page: import("@playwright/test").Page, subject: string) {
  await page.setExtraHTTPHeaders({
    "oai-authenticated-user-id": subject,
    "oai-authenticated-user-issuer": "local-e2e",
    "oai-authenticated-user-full-name": "Buildmates%20Tester",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });
}
