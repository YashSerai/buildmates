import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { PrivacyClient } from "./PrivacyClient";
import { ProductHeader } from "@/components/discovery/ProductHeader";
import styles from "../settings.module.css";

export const metadata: Metadata = { title: "Privacy center | Buildmates", description: "See, change, export, or delete what Buildmates stores.", robots: { index: false, follow: false } };
export default async function PrivacyPage() { const user = await requireUser("/settings/privacy"); const { DB } = await getPlatformBindings(); const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName); return <><ProductHeader signedIn/><main className={styles.page}><section className={styles.intro}><p className={styles.eyebrow}>Privacy center</p><h1>What Buildmates knows about me</h1><p>Your source permissions, approved Work Signals, networking controls, automation settings, exports, and deletion requests.</p></section><PrivacyClient initialSnapshot={snapshot} /></main></>; }
