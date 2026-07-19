import { expect, test, type Page } from "@playwright/test";
import { signInTestUser } from "./helpers/auth";

test("cumulative QA scenarios stay coherent across product surfaces and reset cleanly", async ({ page }, testInfo) => {
  await signInTestUser(page, `qa-scenarios-${testInfo.project.name}`);
  await reset(page);

  const spectrum = await apply(page, "candidate_spectrum");
  expect(spectrum.changed).toBe(true);
  expect(spectrum.digest.candidates).toBe(5);
  await page.goto("/matches");
  await expect(page.getByRole("heading", { name: "Mira Chen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Amara Okafor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Theo Martin" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mira Labs" })).toHaveCount(1);
  await expect(page.getByText("Hidden Candidate", { exact: true })).toHaveCount(0);
  const duplicateReplay = await apply(page, "candidate_spectrum");
  expect(duplicateReplay.changed).toBe(false);
  expect(duplicateReplay.digest.candidates).toBe(5);

  const incoming = await apply(page, "incoming_interest");
  expect(incoming.digest.pendingProposals).toBe(1);
  await page.goto("/matches");
  await expect(page.getByText("Your interest is needed", { exact: true })).toBeVisible();
  await expect(page.getByText("QA_PRIVATE_SENTINEL_NEVER_RENDER")).toHaveCount(0);

  const reciprocal = await apply(page, "reciprocal_connection");
  expect(reciprocal.digest.connections).toBe(1);
  await page.goto("/connections");
  await expect(page.getByRole("heading", { name: "Rowan Patel" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open room" })).toHaveAttribute("href", `/rooms/${reciprocal.roomId}`);

  const message = await apply(page, "new_message");
  expect(message.digest.messages).toBe(4);
  await page.goto(`/rooms/${message.roomId}`);
  await expect(page.getByText("smallest reproducible examples", { exact: false })).toBeVisible();

  const invitation = await apply(page, "circle_invitation");
  expect(invitation.digest.circleInvitations).toBe(1);
  await page.goto("/circles");
  await expect(page.getByRole("heading", { name: "RAG Field Notes" })).toBeVisible();

  const relevance = await apply(page, "renewed_relevance");
  expect(relevance.digest.renewedRelevanceUpdates).toBe(1);
  await page.goto("/inbox");
  await expect(page.getByText("Relevant again", { exact: true })).toHaveCount(1);
  await expect(page.getByText("New message", { exact: true })).toBeVisible();
  await expect(page.getByText("Circle invitation", { exact: true })).toBeVisible();

  const feedback = await apply(page, "positive_feedback");
  expect(feedback.digest.positiveFeedback).toBe(1);
  await page.goto(`/rooms/${feedback.roomId}`);
  await page.getByText("Shared room tools", { exact: true }).click();
  await expect(page.getByText("Propose one shared tool", { exact: true })).toBeVisible();

  await apply(page, "permission_exclusion");
  await page.goto("/matches");
  await expect(page.getByText("Hidden Candidate", { exact: true })).toHaveCount(0);
  await expect(page.getByText("QA_PRIVATE_SENTINEL_NEVER_RENDER")).toHaveCount(0);

  const unchanged = await apply(page, "no_change");
  expect(unchanged.changed).toBe(false);
  expect(unchanged.digest).toEqual(feedback.digest);

  await reset(page);
  await page.goto("/connections");
  await expect(page.getByRole("heading", { name: "Rowan Patel" })).toHaveCount(0);
  await page.goto("/circles");
  await expect(page.getByRole("heading", { name: "RAG Field Notes" })).toHaveCount(0);
});

type ScenarioResult = {
  changed: boolean;
  roomId: string;
  digest: {
    candidates: number;
    pendingProposals: number;
    connections: number;
    messages: number;
    circleInvitations: number;
    unreadNotifications: number;
    positiveFeedback: number;
    renewedRelevanceUpdates: number;
  };
};

async function apply(page: Page, scenario: string): Promise<ScenarioResult> {
  const result = await page.evaluate(async (name) => {
    const response = await fetch("/api/testing/qa-scenarios", {
      method: "POST",
      headers: { "content-type": "application/json", "x-buildmates-e2e": "1" },
      body: JSON.stringify({ scenario: name }),
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  }, scenario);
  if (!result.ok) throw new Error(`qa_scenario_failed:${scenario}:${result.status}:${result.text}`);
  return JSON.parse(result.text) as ScenarioResult;
}

async function reset(page: Page) {
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/testing/qa-scenarios", {
      method: "DELETE",
      headers: { "x-buildmates-e2e": "1" },
    });
    return { ok: response.ok, status: response.status, text: await response.text() };
  });
  if (!result.ok) throw new Error(`qa_reset_failed:${result.status}:${result.text}`);
}
