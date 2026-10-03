import { expect, test } from "@playwright/test";
import { signInTestUser } from "./helpers/auth";

test("website directs first run to Codex without impersonating an identity link", async ({
  page,
}, testInfo) => {
  await signInTestUser(
    page,
    `website-only-${testInfo.project.name}-${Date.now()}`,
  );
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: "Build your profile with your AI host" }),
  ).toBeVisible();
  await expect(page.getByText("Connect Buildmates once")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue in ChatGPT or Codex" }),
  ).toBeVisible();
  await expect(page.getByText("0 of 10", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Set up manually instead" }),
  ).toHaveAttribute("href", "/onboarding/manual");
});

test("sparse-context builder completes the mandatory first run and resumes", async ({
  page,
}, testInfo) => {
  await useIdentity(page, `onboarding-${testInfo.project.name}-${Date.now()}`);
  await page.goto("/onboarding/manual");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveTitle("Set up on the web | Buildmates");
  await expect(
    page.getByRole("heading", { name: "You choose what Buildmates learns" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "I understand the boundary" }).click();
  await page
    .getByRole("button", { name: "Continue without connected sources" })
    .click();
  await page
    .getByLabel("What are you building or exploring now?")
    .fill("A retrieval evaluation toolkit for small AI teams");
  await page
    .getByLabel("What should another builder understand about you?")
    .fill(
      "I build practical AI developer tools and want to meet people comparing retrieval quality, evaluation methods, and useful product workflows.",
    );
  await page
    .getByLabel(/Portfolio, GitHub/)
    .fill("https://github.com/example/retrieval-evals");
  await page.getByRole("button", { name: "Save builder context" }).click();
  await expect(page.getByText("Nothing to review yet")).toBeVisible();
  await page.getByRole("button", { name: "Finish privacy review" }).click();

  const handle = `builder_${Date.now().toString(36)}`;
  await page.getByLabel("Handle").fill(handle);
  await page.getByLabel("Display name").fill("Avery Builder");
  await page.getByRole("button", { name: "Confirm profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose whether to publish a profile page" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue without a public page" }).click();
  await page.getByRole("button", { name: "Save Networking Pulse" }).click();
  await page.getByText("Full Autopilot", { exact: true }).click();
  await page.getByRole("button", { name: "Save acceptance mode" }).click();
  await page.getByLabel(/local and device-bound sources/).check();
  await page.getByRole("button", { name: "Save Work Pulse preferences" }).click();

  await expect(
    page.getByRole("heading", { name: "Your Buildmates profile is ready" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "View your public profile" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Redesign your page with your AI host" })).toHaveAttribute("href", "/profile/design");
  await expect(page.getByRole("link", { name: "Create a personal link to invite builders you know" })).toHaveAttribute("href", "/invite");
  await page.reload();
  await expect(page.getByText("10 of 10")).toBeVisible();
  await expect(page.getByText("Buildmates connected", { exact: true })).toBeVisible();
  await assertNoOverflow(page);
  await page.screenshot({
    path: test.info().outputPath("onboarding-complete.png"),
    fullPage: true, caret: "initial",
  });
});

test("source policy language is individual, non-exhaustive, and keyboard operable", async ({
  page,
}, testInfo) => {
  await useIdentity(
    page,
    `source-policy-${testInfo.project.name}-${Date.now()}`,
  );
  await page.goto("/onboarding/manual");
  await expect(page.locator("[data-hydrated=true]")).toBeVisible();
  await page.getByRole("button", { name: "I understand the boundary" }).click();
  await expect(
    page.getByText(/Only the connected apps and information you allow/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add a named source" }).click();
  await page.getByLabel("Source name").fill("Google Calendar");
  await page
    .getByLabel("Buildmates source-use policy")
    .selectOption("actions_only");
  await expect(
    page.getByText(/Choose this only when your connected host confirms the source supports an action/),
  ).toBeVisible();
  const save = page.getByRole("button", { name: "Save policies and continue" });
  await save.focus();
  expect(
    await save.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).outlineWidth),
    ),
  ).toBeGreaterThanOrEqual(3);
  await save.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: /Fill the gaps|Start with what you know/,
    }),
  ).toBeVisible();
  await assertNoOverflow(page);
});

async function useIdentity(
  page: import("@playwright/test").Page,
  subject: string,
) {
  await signInTestUser(page, subject);
  await page.evaluate(async () => {
    const codeResponse = await fetch("/api/identity/link-code", {
      method: "POST",
    });
    const { code } = (await codeResponse.json()) as { code: string };
    const linked = await fetch("/api/testing/complete-link", {
      method: "POST",
      headers: { "content-type": "application/json", "x-buildmates-e2e": "1" },
      body: JSON.stringify({ code }),
    });
    if (!linked.ok)
      throw new Error(
        `e2e_link_failed:${linked.status}:${await linked.text()}`,
      );
  });
}
async function assertNoOverflow(page: import("@playwright/test").Page) {
  const size = await page
    .locator("main")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(size.scrollWidth - size.clientWidth).toBeLessThanOrEqual(1);
}
