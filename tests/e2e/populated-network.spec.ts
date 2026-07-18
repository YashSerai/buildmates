import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { signInTestUser } from "./helpers/auth";

type PopulatedNetwork = {
  pendingProposalId: string;
  connectionId: string;
  roomId: string;
  activeCircleId: string;
  invitationCircleId: string;
};

test("signed-in network surfaces render realistic populated states", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

  await signInTestUser(page, `populated-network-${testInfo.project.name}`);
  const fixture = await seedFixture(page);

  await page.goto("/matches");
  await expect(page.getByRole("heading", { name: "Meet through current work." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mira Chen" })).toBeVisible();
  await expect(page.getByText("Your interest is needed", { exact: true })).toBeVisible();
  await expectTouchTarget(page.getByRole("button", { name: "Interested" }));
  await expectTouchTarget(page.getByRole("button", { name: "Pass" }));
  await expectNavigationLabels(page);
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, "introductions");

  await page.goto("/connections");
  await expect(page.getByRole("heading", { name: "Rowan Patel" })).toBeVisible();
  await expect(page.getByText("Agent reliability", { exact: true })).toBeVisible();
  await expectTouchTarget(page.getByRole("link", { name: "Open room" }));
  await expectTouchTarget(page.getByRole("button", { name: "Manage" }));
  await page.getByRole("button", { name: "Manage" }).click();
  await verifyReportDialog(page, "Report", "Report the Connection with Rowan Patel");
  await expectNavigationLabels(page);
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, "connections");

  await page.goto(`/rooms/${fixture.roomId}`);
  const roomConversation = page.locator('section[aria-label="Conversation with Rowan Patel"]');
  await expect(roomConversation).toBeVisible();
  await expect(page.getByText("stale context looks like a retrieval miss", { exact: false })).toBeVisible();
  const roomComposer = page.getByLabel("Message Rowan Patel");
  await expect(roomComposer).toBeVisible();
  await expectVisuallyBefore(roomComposer, page.getByText("Shared room tools", { exact: true }));
  await expectTouchTarget(page.getByRole("button", { name: "Send message" }));
  await verifyReportDialog(page, "Report room", "Report this room with Rowan Patel");
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, "room");

  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "What needs your attention." })).toBeVisible();
  await expect(page.getByText("New message", { exact: true })).toBeVisible();
  await expect(page.getByText("Circle invitation", { exact: true })).toBeVisible();
  await expectTouchTarget(page.getByRole("button", { name: "Mark all read" }));
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, "activity");

  await page.goto("/circles");
  await expect(page.getByRole("heading", { name: "Invitations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active Circles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "RAG Field Notes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reliable Agents Lab" })).toBeVisible();
  await expectTouchTarget(page.getByRole("link", { name: "Review invitation" }));
  await expectTouchTarget(page.getByRole("link", { name: "Open Circle" }));
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, "circles");

  await page.goto(`/circles/${fixture.activeCircleId}`);
  await expect(page.getByRole("heading", { name: "Circle chat" })).toBeVisible();
  await expect(page.getByText("evaluation notes from this week's agent run", { exact: false })).toBeVisible();
  const circleComposer = page.getByLabel("Message the Circle");
  await expect(circleComposer).toBeVisible();
  await expectVisuallyBefore(circleComposer, page.getByText("Members and administration", { exact: true }));
  await expectTouchTarget(page.getByRole("button", { name: "Send" }));
  await expectNoHorizontalOverflow(page);
  await capture(page, testInfo, "circle-chat");

  expect(fixture.pendingProposalId).toBeTruthy();
  expect(fixture.connectionId).toBeTruthy();
  expect(fixture.invitationCircleId).toBeTruthy();
  expect(browserErrors, browserErrors.join("\n")).toEqual([]);
});

async function seedFixture(page: Page): Promise<PopulatedNetwork> {
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/testing/populated-network", {
      method: "POST",
      headers: { "x-buildmates-e2e": "1" },
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  });
  if (!result.ok) throw new Error(`populated_network_fixture_failed:${result.status}:${result.text}`);
  return JSON.parse(result.text) as PopulatedNetwork;
}

async function expectNavigationLabels(page: Page) {
  const labels = await page
    .locator('nav[aria-label="Your Buildmates"] a')
    .allTextContents();
  expect(labels.map((label) => label.trim())).toEqual([
    "Home",
    "Introductions",
    "Connections",
    "Circles",
    "Activity",
  ]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport + 1);
}

async function expectTouchTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, "control must have a rendered box").not.toBeNull();
  expect(box!.width, `control width was ${box!.width}px`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `control height was ${box!.height}px`).toBeGreaterThanOrEqual(44);
}

async function expectVisuallyBefore(first: Locator, second: Locator) {
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(firstBox!.y + firstBox!.height).toBeLessThan(secondBox!.y);
}

async function verifyReportDialog(page: Page, trigger: string, heading: string) {
  await page.getByRole("button", { name: trigger, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: heading })).toBeVisible();
  await dialog.getByLabel("What is the concern?").selectOption("privacy");
  await dialog
    .getByLabel("What should the reviewer know? Optional")
    .fill("Rendered placement check only.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}
