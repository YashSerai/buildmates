import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { SetupProgress } from "@/components/onboarding/SetupProgress";
import { CodexSetupActions } from "./CodexSetupActions";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./onboarding.module.css";

export const metadata: Metadata = { title: "Set up Buildmates", description: "Continue the guided Buildmates first run in ChatGPT or Codex.", robots: { index: false, follow: false } };
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const { DB } = await getPlatformBindings();
  const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName);
  const nextLabel = snapshot.setup.nextStep ? setupLabel(snapshot.setup.nextStep) : "setup complete";
  const profileHref = snapshot.profile?.handle ? `/builders/${snapshot.profile.handle}` : "/profile";

  return <><ProductHeader signedIn/><main className={styles.page}>
    <section className={styles.intro}>
      <p className={styles.eyebrow}>{snapshot.setup.complete ? "Setup complete" : "Guided first run"}</p>
      <h1>{snapshot.setup.complete ? "Your Buildmates profile is ready" : "Build your profile with your AI host"}</h1>
      <p>{snapshot.setup.complete ? "Return to ChatGPT or Codex whenever your work changes, or continue to your profile and conversations on Buildmates." : "Tell ChatGPT or Codex what you are building and who you would like to meet. Review each profile, page, and preference before it is saved."}</p>
    </section>
    <section className={styles.handoffWorkspace} aria-labelledby="buildmates-handoff-title">
      <SetupProgress completedSteps={snapshot.setup.completedSteps} nextStep={snapshot.setup.nextStep} />
      <div className={styles.handoffPanel}>
        <div className={styles.handoffStatus}>
          <span>{snapshot.setup.completedCount} of {snapshot.setup.totalSteps} complete</span>
          <strong>{snapshot.setup.complete ? "First run complete" : `Next: ${nextLabel}`}</strong>
        </div>
        <div className={styles.handoffContent}>
          <p className={styles.eyebrow}>Continue in ChatGPT or Codex</p>
          <h2 id="buildmates-handoff-title">Take the next guided step</h2>
          <p className={styles.description}>Continue in your AI host to finish the next step. You review everything before it is saved.</p>
          {!snapshot.codexConnected && <div className={styles.inlineNote}><strong>Connect Buildmates once</strong><p>This lets your AI host update your Buildmates profile and find relevant people for you.</p></div>}
          <CodexSetupActions
            complete={snapshot.setup.complete}
            hasProgress={snapshot.setup.completedCount > 0}
          />
          <div className={styles.websiteRole}>
            <strong>Use Buildmates on the web when you want a shared view</strong>
            <p>Publish and share your generated profile, review introductions, chat in private rooms, and manage privacy or account settings here.</p>
          </div>
          <div className={styles.fallbackRow}>
            {snapshot.setup.complete && <a href={profileHref}>View your profile</a>}
            <a href="/home">Go to Buildmates home</a>
            {!snapshot.setup.complete && <a href="/onboarding/manual">Set up manually instead</a>}
          </div>
        </div>
      </div>
    </section>
  </main></>;
}

function setupLabel(step:string){return ({identity_link:"account",storage_explanation:"what to share",source_selection:"connected apps",context_collection:"about you",signal_privacy_review:"review context",basic_profile:"profile",page_preview:"page",networking_pulse:"who to meet",acceptance_mode:"introductions",automation:"updates"} as Record<string,string>)[step]??"next step"}
