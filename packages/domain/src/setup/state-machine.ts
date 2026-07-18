import { z } from "zod";

export const SETUP_STEPS = [
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
] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

// Capability proof is deliberately short-lived. A weekly automation has enough
// time to refresh it, while an abandoned or revoked host cannot authorize
// interpersonal actions indefinitely.
export const AUTOMATION_CAPABILITY_TTL_MS = 8 * 24 * 60 * 60 * 1000;

export const setupStepSchema = z.enum(SETUP_STEPS);

export type SetupProgress = {
  completedSteps: SetupStep[];
  updatedAt: string;
};

export type SetupState = SetupProgress & {
  totalSteps: number;
  completedCount: number;
  complete: boolean;
  nextStep: SetupStep | null;
};

export function getSetupState(progress?: Partial<SetupProgress> | null): SetupState {
  const completed = new Set(
    (progress?.completedSteps ?? []).filter((step): step is SetupStep =>
      SETUP_STEPS.includes(step as SetupStep),
    ),
  );
  const completedSteps = SETUP_STEPS.filter((step) => completed.has(step));
  const nextStep = SETUP_STEPS.find((step) => !completed.has(step)) ?? null;
  return {
    completedSteps,
    updatedAt: progress?.updatedAt ?? new Date(0).toISOString(),
    totalSteps: SETUP_STEPS.length,
    completedCount: completedSteps.length,
    complete: nextStep === null,
    nextStep,
  };
}

export function completeSetupStep(
  progress: Partial<SetupProgress> | null | undefined,
  step: SetupStep,
  now: string,
): SetupState {
  const current = getSetupState(progress);
  if (current.completedSteps.includes(step)) return current;
  if (current.nextStep !== step) {
    throw new SetupOrderError(current.nextStep, step);
  }
  return getSetupState({ completedSteps: [...current.completedSteps, step], updatedAt: now });
}

export class SetupOrderError extends Error {
  constructor(
    readonly expected: SetupStep | null,
    readonly received: SetupStep,
  ) {
    super(expected ? `Complete ${expected} before ${received}` : "Setup is already complete");
    this.name = "SetupOrderError";
  }
}
