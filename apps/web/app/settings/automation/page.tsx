import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { AutomationClient } from "./AutomationClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "../settings.module.css";
export const metadata: Metadata = { title: "Networking and automation", robots: { index: false, follow: false } };
export default async function AutomationPage() { const user = await requireUser("/settings/automation"); const { DB } = await getPlatformBindings(); const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName); return <><ProductHeader signedIn/><main className={styles.page}><section className={styles.intro}><p className={styles.eyebrow}>Networking and automation</p><h1>Control when Buildmates looks for people</h1><p>Set temporary intent, a hard introduction budget, quiet hours, and the cadence Codex should use for your single Work Pulse.</p></section><AutomationClient initialSnapshot={snapshot} /></main></>; }
