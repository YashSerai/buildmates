import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { AutomationClient } from "./AutomationClient";
import styles from "../settings.module.css";
export const metadata: Metadata = { title: "Networking and automation | Buildmates", robots: { index: false, follow: false } };
export default async function AutomationPage() { const user = await requireUser("/settings/automation"); const { DB } = await getPlatformBindings(); const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName); return <main className={styles.page}><header className={styles.header}><a className={styles.wordmark} href="/">Buildmates</a><nav><a href="/onboarding">Setup</a><a href="/settings/privacy">Privacy</a><a href="/settings/connections">Codex connection</a></nav></header><section className={styles.intro}><p className={styles.eyebrow}>Networking and automation</p><h1>Control when Buildmates looks for people</h1><p>Set a temporary intent, a hard introduction budget, quiet hours, and one automation cadence.</p></section><AutomationClient initialSnapshot={snapshot} /></main>; }
