import { describe, expect, it } from "vitest";
import { completeSetupStep, getSetupState, SETUP_STEPS } from "@buildmates/domain";

const legacyCompletedSteps = [
  "identity_link",
  "storage_explanation",
  "source_selection",
  "context_collection",
  "signal_privacy_review",
  "basic_profile",
  "page_preview",
  "networking_pulse",
  "acceptance_mode",
  "automation",
  "first_useful_outcome",
];

describe("setup state machine", () => {
  it("completes onboarding after automation", () => {
    expect(SETUP_STEPS).toHaveLength(10);
    expect(getSetupState({ completedSteps: legacyCompletedSteps.slice(0, 10) as never, updatedAt: "2026-07-17T12:00:00.000Z" })).toMatchObject({
      complete: true,
      completedCount: 10,
      totalSteps: 10,
      nextStep: null,
    });
  });

  it("normalizes legacy eleven-step progress without requiring a migration", () => {
    const state = getSetupState({ completedSteps: legacyCompletedSteps as never, updatedAt: "2026-07-17T12:00:00.000Z" });
    expect(state.completedSteps).toEqual(SETUP_STEPS);
    expect(state).toMatchObject({ complete: true, completedCount: 10, totalSteps: 10, nextStep: null });
  });

  it("makes automation the final ordered write", () => {
    const before = getSetupState({ completedSteps: legacyCompletedSteps.slice(0, 9) as never, updatedAt: "2026-07-17T12:00:00.000Z" });
    expect(before.nextStep).toBe("automation");
    expect(completeSetupStep(before, "automation", "2026-07-17T12:01:00.000Z")).toMatchObject({ complete: true, completedCount: 10, nextStep: null });
  });
});
