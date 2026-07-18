import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { PrivacyClient } from "./PrivacyClient";
import { SettingsShell } from "@/components/settings/SettingsShell";

export const metadata: Metadata = { title: "Privacy center", description: "See, change, export, or delete what Buildmates stores.", robots: { index: false, follow: false } };
export default async function PrivacyPage() { const user = await requireUser("/settings/privacy"); const { DB } = await getPlatformBindings(); const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName); return <SettingsShell current="privacy" eyebrow="Profile & privacy" title="Your profile and privacy" description="Review who can see your profile, what Buildmates may use, connected sources, exports, and account controls."><PrivacyClient initialSnapshot={snapshot} /></SettingsShell>; }
