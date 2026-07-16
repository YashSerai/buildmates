import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { PrivacyClient } from "./PrivacyClient";
import styles from "../settings.module.css";

export const metadata: Metadata = { title: "Privacy center | Buildmates", description: "See, change, export, or delete what Buildmates stores.", robots: { index: false, follow: false } };
export default async function PrivacyPage() { const user = await requireUser("/settings/privacy"); const { DB } = await getPlatformBindings(); const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName); return <main className={styles.page}><SettingsHeader /><section className={styles.intro}><p className={styles.eyebrow}>Privacy center</p><h1>What Buildmates knows about me</h1><p>Every source policy, approved Work Signal, networking control, automation state, and lifecycle request stored for this account.</p></section><PrivacyClient initialSnapshot={snapshot} /></main>; }
function SettingsHeader() { return <header className={styles.header}><a className={styles.wordmark} href="/">Buildmates</a><nav aria-label="Settings"><a href="/onboarding">Setup</a><a href="/settings/automation">Automation</a><a href="/settings/connections">Codex connection</a></nav></header>; }
