import { expect, test } from "@playwright/test";

test("protected Surface Lab renders both isolated responsive specs and trusted actions", async ({ page }) => {
  await page.goto("/surface-lab");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Surface lab" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Aya Chen/ })).toBeVisible();
  expect(await renderedHeadingLevels(page)).toEqual([1, 1]);
  await expect(page.getByTestId("contrast-result")).toContainText(/Contrast passed · minimum [4-9]/);
  const lightRoot = page.locator("article.surface-root");
  await expect(lightRoot).toHaveClass(/surface-width-wide/);
  await expect(lightRoot).toHaveClass(/surface-density-spacious/);
  await expect(lightRoot).toHaveClass(/surface-display-editorial/);
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
  await page.getByRole("button", { name: "Dark room" }).click();
  await expect(page.getByRole("heading", { name: "Retrieval field notes" })).toBeVisible();
  expect(await renderedHeadingLevels(page)).toEqual([1, 1]);
  const darkRoot = page.locator("article.surface-root");
  await expect(darkRoot).toHaveClass(/surface-width-standard/);
  await expect(darkRoot).toHaveClass(/surface-display-technical/);
  await expect(darkRoot).toHaveAttribute("data-collapse-below", "lg");
  const darkMetrics = await darkRoot.evaluate((element) => { const style = getComputedStyle(element); const section = element.querySelector(".surface-section")!; const heading = element.querySelector(".surface-heading")!; return { maxWidth: style.maxWidth, padding: Number.parseFloat(style.paddingLeft), sectionPadding: Number.parseFloat(getComputedStyle(section).paddingTop), headingFont: getComputedStyle(heading).fontFamily }; });
  expect(lightMetrics.maxWidth).not.toBe(darkMetrics.maxWidth);
  expect(lightMetrics.padding).toBeGreaterThan(darkMetrics.padding);
  expect(lightMetrics.sectionPadding).toBeGreaterThan(darkMetrics.sectionPadding);
  expect(darkMetrics.headingFont).toMatch(/Cascadia|Consolas|monospace/i);
  await page.getByRole("button", { name: "Phone" }).click();
  const previewWidth = await page.getByTestId("preview-frame").evaluate((element) => element.getBoundingClientRect().width);
  expect(previewWidth).toBeGreaterThanOrEqual(320);
  expect(previewWidth).toBeLessThanOrEqual(375);
  const overflow = await page.getByTestId("preview-frame").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(await page.locator(".surface-grid-2").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
});

async function renderedHeadingLevels(page: import("@playwright/test").Page): Promise<number[]> {
  const levels = await page.locator("h1,h2,h3,h4,h5,h6").evaluateAll((elements) => elements.map((element) => Number(element.tagName.slice(1))));
  for (let index = 1; index < levels.length; index++) expect(levels[index]).toBeLessThanOrEqual(levels[index - 1] + 1);
  return levels;
}

test("state controls expose loading, empty, error, stale, private, and malformed fallbacks", async ({ page }) => {
  await page.goto("/surface-lab");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible({ timeout: 15_000 });
  const select = page.getByLabel("Interface state");
  await select.selectOption("loading");
  const themedState = page.locator("article.surface-root[data-surface-state=loading]");
  await expect(themedState).toHaveClass(/surface-width-wide/);
  const computed = await themedState.locator(".surface-state").evaluate((element) => { const style = getComputedStyle(element); const strong = getComputedStyle(element.querySelector("strong")!); return { background: style.backgroundColor, border: style.borderStyle, borderColor: style.borderColor, type: strong.fontFamily }; });
  expect(computed).toMatchObject({ background: "rgb(255, 253, 247)", border: "solid", borderColor: "rgb(201, 199, 186)" });
  expect(computed.type).toMatch(/Charter|Cambria|Georgia/i);
  const defaultDuration = await page.locator(".surface-loading-track span").evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(defaultDuration)).toBeGreaterThanOrEqual(1);
  for (const [value, text] of [["loading", "Loading this surface"], ["empty", "Nothing has been placed"], ["error", "surface is unavailable"], ["stale", "newer revision"], ["permission", "surface is private"], ["malformed", "could not be displayed"]] as const) {
    await select.selectOption(value);
    await expect(page.getByText(new RegExp(text, "i"))).toBeVisible();
  }
  await expect(page.locator("article.surface-root[data-surface-state=malformed]")).toHaveClass(/surface-width-standard/);
  expect(await page.locator("article.surface-root[data-surface-state=malformed]").evaluate((element) => getComputedStyle(element).getPropertyValue("--surface-panel").trim())).toBe("#f5f5f2");
});

test("keyboard focus is visible and reduced motion removes substantive animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/surface-lab");
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Tab");
  const focused = page.getByRole("button", { name: "Connect", exact: true });
  await focused.focus();
  const focusStyle = await focused.evaluate((element) => { const style = getComputedStyle(element); return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, boxShadow: style.boxShadow }; });
  expect(focusStyle).toMatchObject({ outlineStyle: "solid", outlineWidth: "2px", outlineColor: "rgb(0, 0, 0)" });
  expect(focusStyle.boxShadow).toContain("rgb(255, 255, 255)");
  await page.getByLabel("Interface state").selectOption("loading");
  const duration = await page.locator(".surface-loading-track span").evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
});
