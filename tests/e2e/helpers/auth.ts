import type { Page } from "@playwright/test";

export async function signInTestUser(page: Page, subject: number | string) {
  const numericSubject = typeof subject === "number" ? subject : stableSubject(subject);
  await page.goto("/");
  const result = await page.evaluate(async (githubSubject) => {
    const response = await fetch("/api/testing/session", { method: "POST", headers: { "content-type": "application/json", "x-buildmates-e2e": "1" }, body: JSON.stringify({ subject: githubSubject }) });
    return { ok: response.ok, status: response.status, text: await response.text() };
  }, numericSubject);
  if (!result.ok) throw new Error(`e2e_session_failed:${result.status}:${result.text}`);
}

function stableSubject(value: string): number { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0) + 1; }
