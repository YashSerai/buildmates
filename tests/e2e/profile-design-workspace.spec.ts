import { expect, test } from "@playwright/test";
import { EDITORIAL_RESEARCH_PROFILE } from "@buildmates/surfaces";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { signInTestUser } from "./helpers/auth";

const evidenceRoot = path.resolve("docs/qa/evidence/2026-07-18/profile-design-workspace");

test.beforeAll(async () => {
  await mkdir(evidenceRoot, { recursive: true });
});

test("profile design workspace stays aligned and renders real project content", async ({ page }, testInfo) => {
  await signInTestUser(page, `profile-design-${testInfo.project.name}-${Date.now()}`);

  const seeded = await page.evaluate(async () => {
    const network = await fetch("/api/testing/populated-network", {
      method: "POST",
      headers: { "x-buildmates-e2e": "1" },
    });
    if (!network.ok) throw new Error(`network_seed_failed:${network.status}`);
    const suffix = Date.now().toString(36);
    const project = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: `profile-workspace-${suffix}`,
        title: "Field Notes for Reliable Agents",
        summary: "A practical collection of agent failure cases, evaluations, and product decisions.",
        audience: "suggested_connections",
        allowMatching: true,
        indexable: false,
        status: "active",
        stage: "building",
        links: [],
        taxonomy: [],
      }),
    });
    if (!project.ok) throw new Error(`project_seed_failed:${project.status}`);
    return true;
  });
  expect(seeded).toBe(true);

  const spec = {
    ...EDITORIAL_RESEARCH_PROFILE,
    approvedAssets: [],
    bindingManifest: {
      ...EDITORIAL_RESEARCH_PROFILE.bindingManifest,
      media: [],
    },
  };
  const draft = await page.evaluate(async (profileSpec) => {
    const response = await fetch("/api/surfaces/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "draft", spec: profileSpec }),
    });
    return { ok: response.ok, status: response.status, body: await response.text() };
  }, spec);
  expect(draft.ok, draft.body).toBe(true);

  await page.goto("/profile/design");
  await expect(page.getByRole("heading", { name: "Make your page feel like you." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your latest preview" })).toBeVisible();
  await expect(page.getByText("Field Notes for Reliable Agents", { exact: true })).toBeVisible();

  const [inner, header, preview] = await Promise.all([
    page.locator("main > div").first().boundingBox(),
    page.locator("main header").first().boundingBox(),
    page.getByRole("region", { name: "Your latest preview" }).boundingBox(),
  ]);
  expect(inner).not.toBeNull();
  expect(header).not.toBeNull();
  expect(preview).not.toBeNull();
  expect(Math.abs((inner?.x ?? 0) - (header?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((inner?.x ?? 0) - (preview?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  await page.screenshot({
    path: path.join(evidenceRoot, `${testInfo.project.name}.png`),
    fullPage: true,
  });
});
