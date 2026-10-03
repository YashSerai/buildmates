import { expect, test } from "@playwright/test";
import { signInTestUser } from "./helpers/auth";

test("Circle reports require a reason, accept context, and appear in Safety", async ({
  page,
}, testInfo) => {
  await signInTestUser(
    page,
    `safety-report-${testInfo.project.name}-${Date.now()}`,
  );
  const circle = await page.evaluate(async () => {
    const response = await fetch("/api/circles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Safety review Circle",
        purpose: "Verify the private Buildmates reporting workflow end to end.",
        governanceMode: "admin",
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as { id: string };
  });

  await page.goto(`/circles/${encodeURIComponent(circle.id)}`);
  const report = page.getByRole("button", { name: "Report Circle" });
  await expect(report).toHaveAttribute("data-hydrated", "true");
  await report.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(/Reports are private and do not automatically block anyone/i),
  ).toBeVisible();
  await dialog.getByLabel("What is the concern?").selectOption("privacy");
  await dialog
    .getByLabel(/What should the reviewer know/)
    .fill("This Circle includes information that should be reviewed for privacy.");
  await dialog.getByRole("button", { name: "Submit private report" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Buildmates will review it." }),
  ).toBeVisible();

  await page.goto("/settings/safety");
  await expect(page.getByText("Privacy concern", { exact: true })).toBeVisible();
  await expect(page.getByText(/Circle · submitted/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("safety-settings.png"), fullPage: true, caret: "initial" });
});
