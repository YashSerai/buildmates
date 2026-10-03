import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { OnboardingClient } from "../OnboardingClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "../onboarding.module.css";

export const metadata: Metadata = {
  title: "Set up on the web",
  description: "Review and update your Buildmates setup from the website.",
  robots: { index: false, follow: false },
};

export default async function ManualOnboardingPage() {
  const user = await requireUser("/onboarding/manual");
  const { DB } = await getPlatformBindings();
  const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName);

  return (
    <><ProductHeader signedIn/><main className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>Web setup</p>
        <h1>Continue setting up Buildmates</h1>
        <p>Review the same profile, privacy choices, and networking preferences that Buildmates uses in ChatGPT or Codex.</p>
      </section>
      <OnboardingClient initialSnapshot={snapshot} defaultDisplayName={user.identity.displayName ?? "Builder"} />
    </main></>
  );
}
