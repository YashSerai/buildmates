import type { Metadata } from "next";
import { requireUser } from "@/src/auth/require-user";
import { getPlatformBindings } from "@/src/platform/bindings";
import { getOnboardingSnapshot } from "@/src/platform/onboarding-data";
import { AutomationClient } from "./AutomationClient";
import { SettingsShell } from "@/components/settings/SettingsShell";
export const metadata: Metadata = { title: "Networking and automation", robots: { index: false, follow: false } };
export default async function AutomationPage() { const user = await requireUser("/settings/automation"); const { DB } = await getPlatformBindings(); const snapshot = await getOnboardingSnapshot(DB, user.id, user.identity.displayName); return <SettingsShell current="automation" eyebrow="Networking & Work Pulse" title="Control when Buildmates looks for people" description="Set what kind of connection you want, how many introductions you receive, your quiet hours, and your Work Pulse schedule."><AutomationClient initialSnapshot={snapshot} /></SettingsShell>; }
