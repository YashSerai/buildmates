import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { SetupProgress } from "@/components/onboarding/SetupProgress";
import { CodexSetupActions } from "./CodexSetupActions";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "./onboarding.module.css";

export const metadata: Metadata = { title: "Set up Buildmates", description: "Continue the guided Buildmates first run in Codex.", robots: { index: false, follow: false } };
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const { DB } = await getPlatformBindings();
  const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName);
  const nextLabel = snapshot.setup.nextStep ? setupLabel(snapshot.setup.nextStep) : "setup complete";
  const profileHref = snapshot.profile?.handle ? `/@${snapshot.profile.handle}` : "/profile";

  return <><ProductHeader signedIn/><main className={styles.page}>
    <section className={styles.intro}>
      <p className={styles.eyebrow}>{snapshot.setup.complete ? "Setup complete" : "Guided first run"}</p>
      <h1>{snapshot.setup.complete ? "Your Buildmates profile is ready" : "Build your profile with Codex"}</h1>
      <p>{snapshot.setup.complete ? "Return to Codex whenever your work changes, or continue to your profile and conversations on Buildmates." : "Codex guides you through approved work context, a reviewed builder profile, networking preferences, and one useful first action. Your progress is saved after every step."}</p>
    </section>
    <section className={styles.handoffWorkspace} aria-labelledby="codex-handoff-title">
      <SetupProgress completedSteps={snapshot.setup.completedSteps} nextStep={snapshot.setup.nextStep} />
      <div className={styles.handoffPanel}>
        <div className={styles.handoffStatus}>
          <span>{snapshot.setup.completedCount} of {snapshot.setup.totalSteps} complete</span>
          <strong>{snapshot.setup.complete ? "First run complete" : `Next: ${nextLabel}`}</strong>
        </div>
        <div className={styles.handoffContent}>
          <p className={styles.eyebrow}>Continue in Codex</p>
          <h2 id="codex-handoff-title">Take the next guided step</h2>
          <p className={styles.description}>Buildmates only stores the structured summaries and settings you approve. It never receives your connected-app credentials, raw chats, full prompts, repository contents, email bodies, or calendar contents.</p>
          {!snapshot.codexConnected && <div className={styles.inlineNote}><strong>Account link required</strong><p>Codex will direct you through a one-time link to this signed-in Buildmates account. GitHub sign-in proves your website identity only; it does not grant repository access.</p></div>}
          <CodexSetupActions complete={snapshot.setup.complete} />
          <div className={styles.websiteRole}>
            <strong>The website is your shared space</strong>
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

function setupLabel(step:string){return ({identity_link:"account link",storage_explanation:"privacy boundary",source_selection:"connected sources",context_collection:"builder context",signal_privacy_review:"Work Signal review",basic_profile:"profile",page_preview:"page preview",networking_pulse:"Networking Pulse",acceptance_mode:"introduction approval",automation:"automation",first_useful_outcome:"first useful action"} as Record<string,string>)[step]??"next setup step"}
