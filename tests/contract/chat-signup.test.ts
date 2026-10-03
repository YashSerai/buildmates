import { describe, expect, it } from "vitest";
import { createMemoryMcpProductRepository, executeBuildmatesTool, type BuildmatesToolServices } from "@buildmates/mcp-core";

function account() {
  const repository = createMemoryMcpProductRepository();
  const services: BuildmatesToolServices = {
    repository, linkBaseUrl: "https://buildmates.example", now: () => new Date("2026-10-02T12:00:00Z"),
    resolveLinkedUser: async ({ mcpSubject }) => mcpSubject === "linked_builder_subject" ? { userId: "builder_alice" } : null,
    completeIdentityLink: async () => ({ linked: false, reason: "invalid_or_expired" }),
    allowAttempt: async () => true, validateTaxonomy: async () => true,
  };
  let serial = 0;
  const call = (name: string, input: unknown) => executeBuildmatesTool(name, input, "linked_builder_subject", services);
  const step = (payload: unknown) => call("complete_setup_step", { payload, idempotencyKey: `signup-step-${++serial}` });
  return { repository, services, call, step };
}

describe("chat-first signup", () => {
  it("saves private signup without connected sources, a generated page, or background tasks and resumes in a fresh session", async () => {
    const { repository, services, call, step } = account();
    await step({ step: "storage_explanation", acknowledged: true });
    await step({ step: "source_selection", sourceIds: [] });
    await step({ step: "context_collection", method: "pasted_description", summary: "I build tools for small software teams and want to meet designers." });
    await step({ step: "signal_privacy_review", reviewedSignalIds: [], acknowledged: true });
    await call("update_profile_model", { profile: {
      profileId: "profile_alice", handle: "alice_builder", displayName: "Alice", builderSummary: "Building tools for small software teams", projectOrInterest: "A collaborative developer tool", allowMatching: true, acceptanceMode: "manual", idempotencyKey: "signup-profile-save",
    } });
    await step({ step: "basic_profile", profileId: "profile_alice", handle: "alice_builder", approved: true });
    await step({ step: "page_preview", choice: "later" });
    await call("update_networking_pulse", { pulse: {
      pulseId: "pulse_alice", intentSummary: "Meet designers building developer tools", builderSimilarity: "balanced", geography: "global", maximumIntroductionsPerWeek: 3, serendipity: 20, timezone: "America/Vancouver", startsAt: "2026-10-02T12:00:00Z", expiresAt: "2026-11-01T12:00:00Z", idempotencyKey: "signup-networking-pulse",
    } });
    await step({ step: "networking_pulse", pulseId: "pulse_alice" });
    await step({ step: "acceptance_mode", mode: "manual" });
    await step({ step: "automation", enabled: false, cadence: "manual", sourceLivenessReviewed: true });
    const returned = await executeBuildmatesTool("get_setup_state", {}, "linked_builder_subject", { ...services });
    expect(returned).toMatchObject({ complete: true, completedCount: 10, nextStep: null });
    expect(await repository.listForMember("surface_revision", "builder_alice")).toEqual([]);
    expect(await call("get_automation_checkpoint", {})).toMatchObject({ checkpoint: { state: "disabled", enabled: false, cadence: "manual", nextRunAt: null } });
    expect(await call("get_profile_model", {})).toMatchObject({ profiles: [{ handle: "alice_builder", publicationStatus: "private_draft", publishedAt: null }] });
  });

  it("rejects out-of-order acceptance without altering the saved profile", async () => {
    const { call, step, repository } = account();
    await repository.write({ kind: "profile_model", id: "profile_alice", ownerUserId: "builder_alice", now: "2026-10-02T12:00:00Z", value: { acceptanceMode: "manual" } });
    await expect(step({ step: "acceptance_mode", mode: "full_autopilot" })).rejects.toThrow("Complete storage_explanation");
    expect(await call("get_profile_model", {})).toMatchObject({ profiles: [{ acceptanceMode: "manual" }] });
  });

  it("does not interpret a requested schedule as a confirmed background run", async () => {
    const { call } = account();
    await call("update_automation_checkpoint", { checkpointId: "checkpoint_alice", cursor: null, state: "succeeded", lastOutcome: "Agent says the task ran", enabled: true, cadence: "weekly", sourceLivenessReviewed: true, nextRunAt: "2026-10-09T12:00:00Z", idempotencyKey: "requested-schedule-1" });
    expect(await call("get_automation_checkpoint", {})).toMatchObject({ checkpoint: { state: "requested", reportedState: "succeeded", nextRunAt: null, hostTaskConfirmed: false, backgroundExecutionVerified: false } });
  });
});
