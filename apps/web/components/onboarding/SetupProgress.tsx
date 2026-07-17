import { SETUP_STEPS, type SetupStep } from "@buildmates/domain";
import styles from "../../app/onboarding/onboarding.module.css";

const labels: Record<SetupStep, string> = {
  identity_link: "Account",
  storage_explanation: "Privacy boundary",
  source_selection: "Sources",
  context_collection: "Builder context",
  signal_privacy_review: "Review context",
  basic_profile: "Profile",
  page_preview: "Page preview",
  networking_pulse: "Networking Pulse",
  acceptance_mode: "Acceptance",
  automation: "Automation",
  first_useful_outcome: "First useful action",
};

export function SetupProgress({
  completedSteps,
  nextStep,
}: {
  completedSteps: SetupStep[];
  nextStep: SetupStep | null;
}) {
  return (
    <nav className={styles.progress} aria-label="Setup progress">
      <div className={styles.progressSummary}>
        <span>
          {completedSteps.length} of {SETUP_STEPS.length}
        </span>
        <strong>
          {nextStep ? labels[nextStep] : "Profile setup complete"}
        </strong>
      </div>
      <ol>
        {SETUP_STEPS.map((step, index) => {
          const complete = completedSteps.includes(step);
          const current = nextStep === step;
          return (
            <li
              key={step}
              aria-current={current ? "step" : undefined}
              className={
                current
                  ? styles.currentStep
                  : complete
                    ? styles.completeStep
                    : ""
              }
            >
              <span>{complete ? "✓" : index + 1}</span>
              <span>{labels[step]}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
