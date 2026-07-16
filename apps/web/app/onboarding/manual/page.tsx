import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { OnboardingClient } from "../OnboardingClient";
import styles from "../onboarding.module.css";

export const metadata: Metadata = {
  title: "Manual setup | Buildmates",
  description: "Complete Buildmates setup on the website when Codex is unavailable.",
  robots: { index: false, follow: false },
};

export default async function ManualOnboardingPage() {
  const user = await requireUser("/onboarding/manual");
  const { DB } = await getPlatformBindings();
  const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.wordmark} href="/">Buildmates</a>
        <nav aria-label="Setup">
          <a href="/onboarding">Back to Codex setup</a>
          <a href="/settings/privacy">Privacy</a>
        </nav>
      </header>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>Manual fallback</p>
        <h1>Set up Buildmates on the website</h1>
        <p>This updates the same profile and progress used by Codex. Use it when the Buildmates app is unavailable or when you prefer a form.</p>
      </section>
      <OnboardingClient initialSnapshot={snapshot} defaultDisplayName={user.identity.displayName ?? "Builder"} />
    </main>
  );
}
