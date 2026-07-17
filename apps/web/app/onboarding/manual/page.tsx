import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { OnboardingClient } from "../OnboardingClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "../onboarding.module.css";

export const metadata: Metadata = {
  title: "Manual setup",
  description: "Complete Buildmates setup on the website when Codex is unavailable.",
  robots: { index: false, follow: false },
};

export default async function ManualOnboardingPage() {
  const user = await requireUser("/onboarding/manual");
  const { DB } = await getPlatformBindings();
  const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName);

  return (
    <><ProductHeader signedIn/><main className={styles.page}>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>Website fallback</p>
        <h1>Continue setup without Codex</h1>
        <p>These forms update the same profile and setup progress used by Codex. You can return to the guided Codex flow at any time.</p>
      </section>
      <OnboardingClient initialSnapshot={snapshot} defaultDisplayName={user.identity.displayName ?? "Builder"} />
    </main></>
  );
}
