import { expect, test } from "@playwright/test";
import { signInTestUser } from "./helpers/auth";

test.beforeEach(async ({ page }, testInfo) => {
  await page.route("**/api/surface-assets/fixture/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
  });
  await signInTestUser(page, `surfaces-${testInfo.project.name}-${testInfo.title}`);
});

test("six v2 profile concepts keep distinct structure without horizontal overflow", async ({ page }, testInfo) => {
  await page.route("**/api/surface-assets/fixture/**", async (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/surface-lab");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Mira Chen" })).toBeVisible();
  await expect(page.locator("article.surface-v2 .surface-canvas")).toBeVisible();
  expect(await surfaceOverflow(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("orbital-desktop.png"), fullPage: true, caret: "initial" });

  const concepts = page.getByLabel("Concept");
  for (const [value, marker] of [["editorial", ".surface-projects-editorial"], ["journal", ".surface-gallery-masonry"], ["collage", ".surface-canvas"], ["ledger", ".surface-projects-cards"]] as const) {
    await concepts.selectOption(value);
    await expect(page.locator(`article.surface-v2 ${marker}`)).toBeVisible();
    expect(await surfaceOverflow(page)).toBeLessThanOrEqual(1);
  }

  await concepts.selectOption("atlas");
  await expect(page.locator(".surface-project-artifact-orbit-map")).toBeVisible();
  await expect(page.getByText("Safari Gigs", { exact: true }).first()).toBeVisible();
  expect(await surfaceOverflow(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("working-atlas-desktop.png"), fullPage: true, caret: "initial" });

  await concepts.selectOption("atlas");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Phone" }).click();
  expect(await surfaceOverflow(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("working-atlas-phone.png"), fullPage: true, caret: "initial" });
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await surfaceOverflow(page)).toBeLessThanOrEqual(1);
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await surfaceOverflow(page)).toBeLessThanOrEqual(1);
});

test("protected Surface Lab renders isolated responsive specs and trusted actions", async ({ page }) => {
  await page.goto("/surface-lab");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Concept").selectOption("workshop");
  await expect(page.getByRole("heading", { name: "Surface lab" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Aya Chen/ })).toBeVisible();
  expect(await renderedHeadingLevels(page)).toEqual([1, 1]);
  await expect(page.getByTestId("contrast-result")).toContainText(/Contrast passed - minimum [4-9]/);
  const lightRoot = page.locator("article.surface-root");
  await expect(lightRoot).toHaveClass(/surface-width-wide/);
  await expect(lightRoot).toHaveClass(/surface-density-spacious/);
  await expect(lightRoot).toHaveClass(/surface-display-sturdy-slab/);
  await expect(lightRoot).toHaveAttribute("data-collapse-below", "md");
  const lightMetrics = await lightRoot.evaluate((element) => { const style = getComputedStyle(element); const section = element.querySelector(".surface-section")!; return { maxWidth: style.maxWidth, padding: Number.parseFloat(style.paddingLeft), sectionPadding: Number.parseFloat(getComputedStyle(section).paddingTop) }; });
  const frame = page.locator('iframe[title="Current work note"]');
  await expect(frame).toHaveAttribute("sandbox", "");
  await expect(frame).toHaveAttribute("credentialless", "");
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  const srcDoc = await frame.getAttribute("srcdoc");
  expect(srcDoc).toContain("default-src 'none'");
  expect(srcDoc).not.toContain("<script");
  await expect(page.frameLocator('iframe[title="Current work note"]').getByText("On the workbench")).toBeVisible();
  const decorationOverflow = await page.frameLocator('iframe[title="Current work note"]').locator("html").evaluate((element) => ({ client: element.clientHeight, content: element.scrollHeight }));
  expect(decorationOverflow.content).toBeLessThanOrEqual(decorationOverflow.client);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText(/Connect action received from trusted control/)).toBeVisible();

  await page.getByLabel("Concept").selectOption("room");
  await expect(page.getByRole("heading", { name: "Retrieval field notes" })).toBeVisible();
  expect(await renderedHeadingLevels(page)).toEqual([1, 1]);
  const darkRoot = page.locator("article.surface-root");
  await expect(darkRoot).toHaveClass(/surface-width-wide/);
  await expect(darkRoot).toHaveClass(/surface-display-engine-mono/);
  await expect(darkRoot).toHaveAttribute("data-collapse-below", "lg");
  const darkMetrics = await darkRoot.evaluate((element) => { const style = getComputedStyle(element); const section = element.querySelector(".surface-section")!; const heading = element.querySelector(".surface-heading")!; return { maxWidth: style.maxWidth, padding: Number.parseFloat(style.paddingLeft), sectionPadding: Number.parseFloat(getComputedStyle(section).paddingTop), headingFont: getComputedStyle(heading).fontFamily }; });
  expect(lightMetrics.padding).toBeGreaterThan(darkMetrics.padding);
  expect(lightMetrics.sectionPadding).toBeGreaterThanOrEqual(darkMetrics.sectionPadding);
  expect(darkMetrics.headingFont).toMatch(/Cascadia|Consolas|monospace/i);
  await page.getByRole("button", { name: "Phone" }).click();
  const previewWidth = await page.getByTestId("preview-frame").evaluate((element) => element.getBoundingClientRect().width);
  expect(previewWidth).toBeGreaterThanOrEqual(320);
  expect(previewWidth).toBeLessThanOrEqual(375);
  expect(await surfaceOverflow(page)).toBeLessThanOrEqual(1);
  expect(await page.locator(".surface-grid-2").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
});

test("state controls expose loading, empty, error, stale, private, and malformed fallbacks", async ({ page }) => {
  await page.goto("/surface-lab");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible({ timeout: 15_000 });
  const select = page.getByLabel("Interface state");
  await select.selectOption("loading");
  const themedState = page.locator("article.surface-root[data-surface-state=loading]");
  await expect(themedState).toHaveClass(/surface-width-full/);
  const computed = await themedState.locator(".surface-state").evaluate((element) => { const style = getComputedStyle(element); return { background: style.backgroundColor, border: style.borderStyle, borderColor: style.borderColor }; });
  expect(computed).toMatchObject({ background: "rgb(241, 238, 228)", border: "solid", borderColor: "rgb(170, 169, 159)" });
  for (const [value, text] of [["loading", "Loading this surface"], ["empty", "Nothing has been placed"], ["error", "surface is unavailable"], ["stale", "newer revision"], ["permission", "surface is private"], ["malformed", "could not be displayed"]] as const) {
    await select.selectOption(value);
    await expect(page.getByText(new RegExp(text, "i"))).toBeVisible();
  }
  await expect(page.locator("article.surface-root[data-surface-state=malformed]")).toHaveClass(/surface-width-standard/);
});

test("keyboard focus is visible and reduced motion removes substantive animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/surface-lab");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible({ timeout: 15_000 });
  const focused = page.getByRole("button", { name: "Connect", exact: true });
  await focused.focus();
  const focusStyle = await focused.evaluate((element) => { const style = getComputedStyle(element); return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, boxShadow: style.boxShadow }; });
  expect(focusStyle).toMatchObject({ outlineStyle: "solid", outlineWidth: "2px", outlineColor: "rgb(0, 0, 0)" });
  expect(focusStyle.boxShadow).toContain("rgb(255, 255, 255)");
  const markDuration = await page.locator(".surface-mark").first().evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(markDuration)).toBeLessThanOrEqual(0.001);
});

async function renderedHeadingLevels(page: import("@playwright/test").Page): Promise<number[]> {
  const levels = await page.locator("h1,h2,h3,h4,h5,h6").evaluateAll((elements) => elements.map((element) => Number(element.tagName.slice(1))));
  for (let index = 1; index < levels.length; index++) expect(levels[index]).toBeLessThanOrEqual(levels[index - 1] + 1);
  return levels;
}
async function surfaceOverflow(page: import("@playwright/test").Page): Promise<number> {
  return page.locator("article.surface-root").evaluate((element) => element.scrollWidth - element.clientWidth);
}
