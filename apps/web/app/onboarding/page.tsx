import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { OnboardingClient } from "./OnboardingClient";
import styles from "./onboarding.module.css";

export const metadata: Metadata = { title: "Set up Buildmates", description: "Create a privacy-reviewed builder profile and configure your Buildmates Work Pulse.", robots: { index: false, follow: false } };
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const { DB } = await getPlatformBindings();
  const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName);
  return <main className={styles.page}>
    <header className={styles.header}><a className={styles.wordmark} href="/">Buildmates</a><nav aria-label="Account"><a href="/settings/privacy">Privacy</a><a href="/settings/connections">Codex connection</a></nav></header>
    <section className={styles.intro}><p className={styles.eyebrow}>First run</p><h1>A clear finish line for meeting through your work</h1><p>Build a useful profile, decide exactly what Buildmates may store, and set the pace of your network. You can leave and resume without losing progress.</p></section>
    <OnboardingClient initialSnapshot={snapshot} defaultDisplayName={user.identity.displayName ?? "Builder"} />
  </main>;
}
