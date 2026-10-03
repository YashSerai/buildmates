import { expect, test } from "@playwright/test";
import { DESIGN_POLICY_VERSION } from "@buildmates/surfaces";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { signInTestUser } from "./helpers/auth";
import { qaEvidencePath } from "./helpers/evidence-path";

const evidenceRoot = qaEvidencePath("2026-07-18", "profile-design-workspace");

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
        audience: "public",
        allowMatching: true,
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
    schemaVersion: "3",
    designPolicyVersion: DESIGN_POLICY_VERSION,
    kind: "profile",
    title: "Field Notes profile",
    document: {
      html: `<main class="profile-page"><header><p>{{profile.summary}}</p><h1>{{profile.displayName}}</h1></header><section><h2>Selected work</h2><template data-buildmates-repeat="profile.projects"><article><h3>{{item.title}}</h3><p>{{item.summary}}</p></article></template></section></main>`,
      css: ".profile-page{max-width:72rem;margin:auto;padding:clamp(1.25rem,5vw,5rem);font-family:system-ui,sans-serif;color:#171914;background:#f7f4ec}.profile-page h1{font-size:clamp(3rem,9vw,8rem);line-height:.9}.profile-page section{display:grid;gap:1rem}.profile-page article{border-top:1px solid #4d5148;padding:1.5rem 0}@media(max-width:720px){.profile-page{padding:1rem}.profile-page h1{font-size:clamp(2.6rem,16vw,5rem)}}@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms;animation-iteration-count:1;scroll-behavior:auto}}",
    },
    bindingManifest: {
      content: [
        { key: "profile.displayName", type: "text" },
        { key: "profile.summary", type: "text" },
        { key: "profile.projects", type: "projects" },
      ],
      media: [],
    },
    approvedAssets: [],
    responsive: { desktopMinHeight: 900, phoneMinHeight: 1000 },
    accessibility: { label: "Field Notes profile", reducedMotion: "required" },
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
  await expect(page.getByRole("heading", { name: "What visitors will see" })).toBeVisible();
  const generatedPreview = page.frameLocator("iframe.surface-generated-site");
  await expect(generatedPreview.getByText("Field Notes for Reliable Agents", { exact: true })).toBeVisible();

  const [inner, header, preview] = await Promise.all([
    page.locator("main > div").first().boundingBox(),
    page.locator("main header").first().boundingBox(),
    page.getByRole("region", { name: "What visitors will see" }).boundingBox(),
  ]);
  expect(inner).not.toBeNull();
  expect(header).not.toBeNull();
  expect(preview).not.toBeNull();
  expect(Math.abs((inner?.x ?? 0) - (header?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((inner?.x ?? 0) - (preview?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  const publish = page.getByRole("button", { name: "Publish this design" });
  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page.getByRole("status")).toContainText("Profile design published.", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Your published profile" })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your published profile" })).toBeVisible();
  await expect(page.frameLocator("iframe.surface-generated-site").getByText("Field Notes for Reliable Agents", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit this design" })).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceRoot, `${testInfo.project.name}.png`),
    fullPage: true, caret: "initial",
  });
});
