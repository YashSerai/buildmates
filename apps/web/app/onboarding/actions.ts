export async function postOnboardingAction(body: Record<string, unknown>): Promise<Response> {
  return fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
